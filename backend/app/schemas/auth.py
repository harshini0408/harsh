from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


# --- Auth schemas ---
class StaffLoginRequest(BaseModel):
    email: str
    password: str


class StaffLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    mobile_number: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreateRequest(BaseModel):
    name: str
    email: str
    mobile_number: str
    password: str
    role: str  # superadmin, cashier, inventory_manager

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        valid_roles = ["superadmin", "cashier", "inventory_manager"]
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        return v

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v):
        if not (10 <= len(v) <= 15):
            raise ValueError("Mobile number must be between 10 and 15 characters")
        return v


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
