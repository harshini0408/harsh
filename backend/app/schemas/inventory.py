from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date


class InventoryItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    sku: str
    unit: str
    current_stock: float
    reorder_level: float
    max_stock: Optional[float]
    is_perishable: bool
    expiry_date: Optional[date]

    class Config:
        from_attributes = True


class InventoryItemCreateRequest(BaseModel):
    product_id: int
    sku: str
    unit: str = "piece"
    current_stock: float = 0
    reorder_level: float = 0
    max_stock: Optional[float] = None
    is_perishable: bool = False
    expiry_date: Optional[date] = None


class InventoryItemUpdateRequest(BaseModel):
    sku: Optional[str] = None
    unit: Optional[str] = None
    reorder_level: Optional[float] = None
    max_stock: Optional[float] = None
    is_perishable: Optional[bool] = None
    expiry_date: Optional[date] = None


class StockAdjustmentRequest(BaseModel):
    inventory_item_id: int
    movement_type: str  # adjustment, wastage, return_in, purchase_in
    quantity: float
    note: str

    @field_validator("quantity")
    @classmethod
    def validate_qty(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v

    @field_validator("note")
    @classmethod
    def validate_note(cls, v):
        if not v or not v.strip():
            raise ValueError("Note is required for stock adjustments")
        return v.strip()

    @field_validator("movement_type")
    @classmethod
    def validate_type(cls, v):
        valid = ["purchase_in", "wastage", "adjustment", "return_in"]
        if v not in valid:
            raise ValueError(f"movement_type must be one of: {', '.join(valid)}")
        return v


class StockMovementResponse(BaseModel):
    id: int
    inventory_item_id: int
    product_name: Optional[str] = None
    movement_type: str
    quantity: float
    reference_order_id: Optional[int]
    performed_by: Optional[int]
    performer_name: Optional[str] = None
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SupplierCreateRequest(BaseModel):
    name: str
    contact_person: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class SupplierUpdateRequest(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    id: int
    name: str
    contact_person: Optional[str]
    mobile_number: Optional[str]
    email: Optional[str]
    address: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class PurchaseOrderItemRequest(BaseModel):
    inventory_item_id: int
    quantity: float
    unit_cost: float

    @field_validator("quantity")
    @classmethod
    def validate_qty(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v


class PurchaseOrderCreateRequest(BaseModel):
    supplier_id: int
    notes: Optional[str] = None
    items: list[PurchaseOrderItemRequest]


class PurchaseOrderResponse(BaseModel):
    id: int
    supplier_id: int
    supplier_name: Optional[str] = None
    status: str
    notes: Optional[str]
    created_by: int
    created_at: datetime
    received_at: Optional[datetime]
    items: list[dict] = []

    class Config:
        from_attributes = True
