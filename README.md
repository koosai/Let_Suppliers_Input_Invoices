# Invoice Upload Portal Backend

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables:

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD_HASH='<bcrypt-hash>'
export SESSION_SECRET='a-long-random-secret'

export SMTP_HOST='smtp.example.com'
export SMTP_PORT='587'
export SMTP_USER='smtp-user'
export SMTP_PASS='smtp-pass'
export SMTP_FROM='noreply@example.com'
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Database is stored at `/var/app/data/invoices.db` and uploads in `/var/app/uploads`.
