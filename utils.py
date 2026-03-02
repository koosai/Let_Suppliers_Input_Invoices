import re
from datetime import datetime, timezone

SAFE_CHARS_PATTERN = re.compile(r"[^A-Za-z0-9_-]+")
WHITESPACE_PATTERN = re.compile(r"\s+")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_part(value: str, max_len: int = 80) -> str:
    value = value.strip()
    value = WHITESPACE_PATTERN.sub("_", value)
    value = SAFE_CHARS_PATTERN.sub("", value)
    return value[:max_len] or "unknown"


def build_saved_filename(employee_name: str, invoice_no: str) -> str:
    emp = sanitize_part(employee_name)
    inv = sanitize_part(invoice_no)
    return f"{emp}_{inv}.pdf"
