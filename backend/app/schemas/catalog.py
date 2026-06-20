from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class CategoryCreateRequest(BaseModel):
    name: str
    color_hex: str = "#CCCCCC"
    display_order: int = 0

    @field_validator("color_hex")
    @classmethod
    def validate_color(cls, v):
        import re
        if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError("color_hex must be a valid hex color (e.g. #FF5733)")
        return v


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    color_hex: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    color_hex: str
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True


class ProductCreateRequest(BaseModel):
    category_id: int
    name: str
    price: float
    uom: str = "piece"
    tax_percent: float = 0.0
    description: Optional[str] = None
    image_url: Optional[str] = None
    kds_visible: bool = True
    is_loyalty_reward: bool = False

    @field_validator("price")
    @classmethod
    def validate_price(cls, v):
        if v < 0:
            raise ValueError("Price must be >= 0")
        return v

    @field_validator("tax_percent")
    @classmethod
    def validate_tax(cls, v):
        if v < 0 or v > 100:
            raise ValueError("Tax percent must be between 0 and 100")
        return v


class ProductUpdateRequest(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    price: Optional[float] = None
    uom: Optional[str] = None
    tax_percent: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    kds_visible: Optional[bool] = None
    is_active: Optional[bool] = None
    is_loyalty_reward: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    category_id: int
    category_name: Optional[str] = None
    name: str
    price: float
    uom: str
    tax_percent: float
    description: Optional[str]
    image_url: Optional[str]
    kds_visible: bool
    is_active: bool
    is_loyalty_reward: bool
    created_at: datetime

    class Config:
        from_attributes = True
