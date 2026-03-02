import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

DB_PATH = Path("/var/app/data/invoices.db")
UPLOAD_DIR = Path("/var/app/uploads")


def ensure_paths() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def init_db() -> None:
    ensure_paths()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_name TEXT NOT NULL,
                employee_email TEXT NOT NULL,
                invoice_no TEXT NOT NULL UNIQUE,
                original_filename TEXT NOT NULL,
                saved_filename TEXT NOT NULL,
                saved_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                client_ip TEXT
            )
            """
        )
        conn.commit()


@contextmanager
def get_conn() -> Generator[sqlite3.Connection, None, None]:
    ensure_paths()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
