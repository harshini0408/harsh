from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class OrderItemRequest(BaseModel):
    product_id: int
    quantity: float
    notes: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def validate_qty(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v


class OrderCreateRequest(BaseModel):
    source: str  # 'cashier' or 'self_order'
    table_id: Optional[int] = None
    table_session_id: Optional[int] = None
    customer_id: Optional[int] = None
    pos_session_id: Optional[int] = None
    items: list[OrderItemRequest] = []
    notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v):
        if v not in ("cashier", "self_order"):
            raise ValueError("Source must be 'cashier' or 'self_order'")
        return v


class OrderItemUpdateRequest(BaseModel):
    """Single item update — add, update quantity, or remove."""
    action: str  # 'add', 'update', 'remove'
    product_id: Optional[int] = None  # required for 'add'
    order_item_id: Optional[int] = None  # required for 'update' and 'remove'
    quantity: Optional[float] = None  # required for 'add' and 'update'
    notes: Optional[str] = None


class OrderItemsUpdateRequest(BaseModel):
    items: list[OrderItemUpdateRequest]


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity: float
    unit_price: float
    line_discount: float
    line_total: float
    kitchen_status: str
    is_loyalty_redemption: bool
    notes: Optional[str]

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    order_number: str
    source: str
    table_id: Optional[int]
    table_number: Optional[str] = None
    table_session_id: Optional[int]
    customer_id: Optional[int]
    customer_name: Optional[str] = None
    pos_session_id: Optional[int]
    placed_by_user_id: Optional[int]
    status: str
    coupon_id: Optional[int]
    subtotal: float
    tax_total: float
    discount_total: float
    total: float
    loyalty_credits_earned: int
    loyalty_credits_redeemed: int
    notes: Optional[str]
    created_at: datetime
    items: list[OrderItemResponse] = []

    class Config:
        from_attributes = True


class PaymentRequest(BaseModel):
    payment_method_id: int
    amount: float
    amount_received: Optional[float] = None
    reference_code: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError("Amount must be >= 0")
        return v


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    payment_method_id: int
    payment_method_name: Optional[str] = None
    amount: float
    amount_received: Optional[float]
    change_due: Optional[float]
    reference_code: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class KDSTicketItem(BaseModel):
    id: int
    product_name: str
    quantity: float
    kitchen_status: str
    notes: Optional[str]
    is_loyalty_redemption: bool


class KDSTicket(BaseModel):
    order_id: int
    order_number: str
    table_number: Optional[str]
    source: str
    created_at: datetime
    items: list[KDSTicketItem]


class KitchenStatusUpdate(BaseModel):
    kitchen_status: str

    @field_validator("kitchen_status")
    @classmethod
    def validate_status(cls, v):
        valid = ["to_cook", "preparing", "completed"]
        if v not in valid:
            raise ValueError(f"kitchen_status must be one of: {', '.join(valid)}")
        return v
