from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class InviteRequest(BaseModel):
    customer_email: EmailStr
    lang: str = Field(pattern="^(en|tr|zh)$")
