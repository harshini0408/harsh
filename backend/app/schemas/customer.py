from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class CustomerLookupRequest(BaseModel):
    mobile_number: str

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v):
        if not (10 <= len(v) <= 15):
            raise ValueError("Mobile number must be between 10 and 15 characters")
        return v


class CustomerRegisterRequest(BaseModel):
    name: str
    mobile_number: str
    email: Optional[str] = None
    password: Optional[str] = None  # If provided, customer is registered (is_guest=False)

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v):
        if not (10 <= len(v) <= 15):
            raise ValueError("Mobile number must be between 10 and 15 characters")
        return v


class CustomerResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    mobile_number: str
    is_guest: bool
    loyalty_credits: int
    created_at: datetime

    class Config:
        from_attributes = True


class LoyaltyLedgerEntry(BaseModel):
    id: int
    order_id: Optional[int]
    entry_type: str
    credits_delta: int
    balance_after: int
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LoyaltyBalanceResponse(BaseModel):
    customer_id: int
    customer_name: str
    loyalty_credits: int
    is_guest: bool
    ledger: list[LoyaltyLedgerEntry]


class LoyaltyAdjustmentRequest(BaseModel):
    credits_delta: int
    note: str

    @field_validator("credits_delta")
    @classmethod
    def validate_delta(cls, v):
        if v == 0:
            raise ValueError("Credits delta cannot be zero")
        return v

    @field_validator("note")
    @classmethod
    def validate_note(cls, v):
        if not v or not v.strip():
            raise ValueError("Note is required for manual adjustments")
        return v.strip()
