from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


class CouponCreateRequest(BaseModel):
    code: str
    discount_type: str  # 'percent' or 'fixed'
    value: float
    max_uses: Optional[int] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None

    @field_validator("discount_type")
    @classmethod
    def validate_type(cls, v):
        if v not in ("percent", "fixed"):
            raise ValueError("discount_type must be 'percent' or 'fixed'")
        return v

    @field_validator("value")
    @classmethod
    def validate_value(cls, v):
        if v <= 0:
            raise ValueError("Value must be positive")
        return v


class CouponUpdateRequest(BaseModel):
    code: Optional[str] = None
    discount_type: Optional[str] = None
    value: Optional[float] = None
    max_uses: Optional[int] = None
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class CouponResponse(BaseModel):
    id: int
    code: str
    discount_type: str
    value: float
    max_uses: Optional[int]
    used_count: int
    is_active: bool
    valid_from: Optional[date]
    valid_until: Optional[date]

    class Config:
        from_attributes = True


class PromotionCreateRequest(BaseModel):
    name: str
    scope: str  # 'product' or 'order'
    product_id: Optional[int] = None
    min_quantity: Optional[int] = None
    min_order_amount: Optional[float] = None
    discount_type: str  # 'percent' or 'fixed'
    value: float
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v):
        if v not in ("product", "order"):
            raise ValueError("scope must be 'product' or 'order'")
        return v


class PromotionUpdateRequest(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    product_id: Optional[int] = None
    min_quantity: Optional[int] = None
    min_order_amount: Optional[float] = None
    discount_type: Optional[str] = None
    value: Optional[float] = None
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class PromotionResponse(BaseModel):
    id: int
    name: str
    scope: str
    product_id: Optional[int]
    product_name: Optional[str] = None
    min_quantity: Optional[int]
    min_order_amount: Optional[float]
    discount_type: str
    value: float
    is_active: bool
    valid_from: Optional[date]
    valid_until: Optional[date]

    class Config:
        from_attributes = True
