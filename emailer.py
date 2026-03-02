import os
import smtplib
from email.mime.text import MIMEText
from pathlib import Path

TEMPLATE_DIR = Path(__file__).parent / "templates"


def _load_template(lang: str) -> str:
    template_path = TEMPLATE_DIR / f"invite_{lang}.html"
    if not template_path.exists():
        raise ValueError("Unsupported language template")
    return template_path.read_text(encoding="utf-8")


def send_invite_email(customer_email: str, lang: str) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_from = os.getenv("SMTP_FROM")

    if not all([smtp_host, smtp_user, smtp_pass, smtp_from]):
        raise RuntimeError("SMTP settings are not fully configured")

    upload_link = f"https://your-domain.com/upload?lang={lang}"
    html = _load_template(lang).replace("{{UPLOAD_LINK}}", upload_link)

    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = "Invoice Upload Invitation"
    msg["From"] = smtp_from
    msg["To"] = customer_email

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [customer_email], msg.as_string())
