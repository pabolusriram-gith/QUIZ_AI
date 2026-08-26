import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(default=None, max_length=255)

class UserRegister(UserBase):
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = Field(default=UserRole.STUDENT)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    role: UserRole
    is_active: bool
    is_verified: bool = False
    created_at: datetime
    updated_at: datetime
    dev_otp: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=10)

class ResendOtpRequest(BaseModel):
    email: EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class GuestLoginRequest(BaseModel):
    nickname: str = Field(min_length=2, max_length=50)


