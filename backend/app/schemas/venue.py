from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FloorCreateRequest(BaseModel):
    name: str
    display_order: int = 0


class FloorResponse(BaseModel):
    id: int
    name: str
    display_order: int
    tables: list["TableResponse"] = []

    class Config:
        from_attributes = True


class TableCreateRequest(BaseModel):
    floor_id: int
    table_number: str
    seats: int = 2


class TableUpdateRequest(BaseModel):
    table_number: Optional[str] = None
    seats: Optional[int] = None
    is_active: Optional[bool] = None


class TableResponse(BaseModel):
    id: int
    floor_id: int
    table_number: str
    seats: int
    is_active: bool
    qr_token: str
    has_active_session: bool = False
    session_opened_by: Optional[str] = None  # 'cashier' or 'customer_qr'
    session_id: Optional[int] = None

    class Config:
        from_attributes = True


class TableStatusResponse(BaseModel):
    occupied: bool
    table_id: int
    table_number: str
    floor_name: str


class SessionCreateResponse(BaseModel):
    session_id: int
    table_id: int
    table_number: str
    device_token: Optional[str] = None


class VenueSettingsResponse(BaseModel):
    id: int
    venue_name: str
    self_ordering_enabled: bool
    self_ordering_mode: str
    self_order_lock_mode: str
    session_timeout_minutes: int
    menu_background_color: str
    menu_background_image_url: Optional[str]
    currency_symbol: str
    tax_label: str
    receipt_footer_text: Optional[str]
    kds_auto_advance: bool
    loyalty_enabled: bool
    loyalty_rupees_per_credit: int
    loyalty_credits_for_reward: int

    class Config:
        from_attributes = True


class VenueSettingsUpdateRequest(BaseModel):
    venue_name: Optional[str] = None
    self_ordering_enabled: Optional[bool] = None
    self_ordering_mode: Optional[str] = None
    self_order_lock_mode: Optional[str] = None
    session_timeout_minutes: Optional[int] = None
    menu_background_color: Optional[str] = None
    menu_background_image_url: Optional[str] = None
    currency_symbol: Optional[str] = None
    tax_label: Optional[str] = None
    receipt_footer_text: Optional[str] = None
    kds_auto_advance: Optional[bool] = None
    loyalty_enabled: Optional[bool] = None
    loyalty_rupees_per_credit: Optional[int] = None
    loyalty_credits_for_reward: Optional[int] = None


class PaymentMethodResponse(BaseModel):
    id: int
    type: str
    is_enabled: bool
    upi_id: Optional[str]
    display_name: Optional[str]

    class Config:
        from_attributes = True
