import os
import sqlite3
from io import BytesIO
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openpyxl import Workbook
from pydantic import EmailStr, ValidationError, TypeAdapter

from auth import COOKIE_NAME, SESSION_MAX_AGE, create_session_token, require_admin_session, verify_admin_credentials
from db import UPLOAD_DIR, get_conn, init_db
from emailer import send_invite_email
from models import InviteRequest, LoginRequest
from utils import build_saved_filename, utc_now_iso

MAX_FILE_SIZE = 10 * 1024 * 1024

app = FastAPI(title="Invoice Upload Portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.post("/api/upload-invoice")
async def upload_invoice(
    request: Request,
    employee_name: str = Form(...),
    employee_email: str = Form(...),
    invoice_no: str = Form(...),
    file: UploadFile = File(...),
):
    if not employee_name.strip() or not employee_email.strip() or not invoice_no.strip():
        raise HTTPException(status_code=400, detail="All required fields must be non-empty.")
    if len(invoice_no) > 64:
        raise HTTPException(status_code=400, detail="invoice_no must be at most 64 characters.")

    try:
        TypeAdapter(EmailStr).validate_python(employee_email)
    except ValidationError:
        raise HTTPException(status_code=400, detail="Invalid employee_email format.")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF content-type is allowed.")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Filename must end with .pdf.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds max size of 10MB.")

    saved_filename = build_saved_filename(employee_name, invoice_no)
    saved_path = Path(UPLOAD_DIR) / saved_filename

    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM invoices WHERE invoice_no = ?", (invoice_no,)).fetchone()
        if existing:
            return JSONResponse(
                status_code=409,
                content={
                    "status": "error",
                    "code": "INVOICE_EXISTS",
                    "message": "Invoice number already exists.",
                },
            )

        saved_path.write_bytes(content)
        try:
            cursor = conn.execute(
                """
                INSERT INTO invoices (
                    employee_name, employee_email, invoice_no, original_filename,
                    saved_filename, saved_path, created_at, client_ip
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    employee_name.strip(),
                    employee_email.strip(),
                    invoice_no.strip(),
                    file.filename,
                    saved_filename,
                    str(saved_path),
                    utc_now_iso(),
                    request.client.host if request.client else None,
                ),
            )
        except sqlite3.IntegrityError:
            if saved_path.exists():
                saved_path.unlink(missing_ok=True)
            return JSONResponse(
                status_code=409,
                content={
                    "status": "error",
                    "code": "INVOICE_EXISTS",
                    "message": "Invoice number already exists.",
                },
            )

    return {"status": "ok", "saved_filename": saved_filename, "id": cursor.lastrowid}


@app.post("/api/admin/login")
def admin_login(payload: LoginRequest, response: Response):
    if not verify_admin_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session_token(payload.username)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
    )
    return {"status": "ok"}


@app.post("/api/admin/logout")
def admin_logout(response: Response, _: None = Depends(require_admin_session)):
    response.delete_cookie(key=COOKIE_NAME)
    return {"status": "ok"}


@app.post("/api/admin/send-invite")
def admin_send_invite(payload: InviteRequest, _: None = Depends(require_admin_session)):
    try:
        send_invite_email(payload.customer_email, payload.lang)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}")
    return {"status": "ok", "message": "Invite sent."}


@app.get("/api/admin/invoices")
def admin_list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    _: None = Depends(require_admin_session),
):
    offset = (page - 1) * page_size

    with get_conn() as conn:
        where_clause = ""
        params: list = []
        if search:
            where_clause = " WHERE employee_name LIKE ? OR employee_email LIKE ? OR invoice_no LIKE ?"
            like = f"%{search}%"
            params.extend([like, like, like])

        query = (
            "SELECT id, employee_name, employee_email, invoice_no, original_filename, "
            "saved_filename, saved_path, created_at, client_ip FROM invoices"
            f"{where_clause} ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        params.extend([page_size, offset])
        rows = conn.execute(query, params).fetchall()

        count_query = f"SELECT COUNT(*) AS cnt FROM invoices{where_clause}"
        count_params = params[:-2]
        total = conn.execute(count_query, count_params).fetchone()["cnt"]

    items = [dict(row) for row in rows]
    return {"status": "ok", "page": page, "page_size": page_size, "total": total, "items": items}


@app.get("/api/admin/invoices/export")
def admin_export_invoices(
    search: str | None = Query(default=None),
    _: None = Depends(require_admin_session),
):
    with get_conn() as conn:
        where_clause = ""
        params: list = []
        if search:
            where_clause = " WHERE employee_name LIKE ? OR employee_email LIKE ? OR invoice_no LIKE ?"
            like = f"%{search}%"
            params.extend([like, like, like])

        query = (
            "SELECT id, employee_name, employee_email, invoice_no, original_filename, "
            "saved_filename, created_at, client_ip FROM invoices"
            f"{where_clause} ORDER BY created_at DESC"
        )
        rows = conn.execute(query, params).fetchall()

    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices"
    headers = [
        "id",
        "employee_name",
        "employee_email",
        "invoice_no",
        "original_filename",
        "saved_filename",
        "created_at",
        "client_ip",
    ]
    ws.append(headers)
    for row in rows:
        ws.append([row[h] for h in headers])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="invoices_export.xlsx"'},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
