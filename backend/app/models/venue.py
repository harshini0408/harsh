from sqlalchemy import (
    Column, String, Boolean, TIMESTAMP, ForeignKey, Text,
    SmallInteger, Integer, BigInteger, Numeric, Enum, text
)
from sqlalchemy.orm import relationship
from app.database import Base


class Floor(Base):
    __tablename__ = "floors"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    name = Column(String(60), nullable=False, unique=True)
    display_order = Column(SmallInteger, nullable=False, default=0)

    tables = relationship("TableMaster", back_populates="floor")


class TableMaster(Base):
    __tablename__ = "tables_master"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    floor_id = Column(SmallInteger, ForeignKey("floors.id"), nullable=False)
    table_number = Column(String(10), nullable=False)
    seats = Column(SmallInteger, nullable=False, default=2)
    is_active = Column(Boolean, nullable=False, default=True)
    qr_token = Column(String(36), nullable=False, unique=True)

    floor = relationship("Floor", back_populates="tables")
    sessions = relationship("TableSession", back_populates="table")
    orders = relationship("Order", back_populates="table")


class TableSession(Base):
    __tablename__ = "table_sessions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    table_id = Column(SmallInteger, ForeignKey("tables_master.id"), nullable=False)
    status = Column(Enum("active", "closed", name="session_status_enum"), nullable=False, default="active")
    opened_by = Column(Enum("cashier", "customer_qr", name="opened_by_enum"), nullable=False)
    opened_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lock_mode = Column(Enum("device", "pin", name="lock_mode_enum"), nullable=False, default="device")
    device_token = Column(String(36), nullable=True)
    pin_code = Column(String(4), nullable=True)
    opened_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    closed_at = Column(TIMESTAMP, nullable=True)
    last_activity_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
    # Note: active_table_id is a GENERATED column in MySQL, handled by the DB directly

    table = relationship("TableMaster", back_populates="sessions")
    opened_by_user = relationship("User", foreign_keys=[opened_by_user_id])
    orders = relationship("Order", back_populates="table_session")


class PinRateLimit(Base):
    __tablename__ = "pin_rate_limits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_session_id = Column(BigInteger, ForeignKey("table_sessions.id", ondelete="CASCADE"), nullable=False)
    ip_address = Column(String(45), nullable=False)
    failed_attempts = Column(SmallInteger, nullable=False, default=0)
    locked_until = Column(TIMESTAMP, nullable=True)
    last_attempt_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    session = relationship("TableSession")


class PosSession(Base):
    __tablename__ = "pos_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum("open", "closed", name="pos_session_status_enum"), nullable=False, default="open")
    opening_cash = Column(Numeric(10, 2), nullable=False, default=0)
    closing_cash = Column(Numeric(10, 2), nullable=True)
    notes = Column(String(500), nullable=True)
    opened_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    closed_at = Column(TIMESTAMP, nullable=True)

    user = relationship("User")
    orders = relationship("Order", back_populates="pos_session")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    type = Column(Enum("cash", "card_digital", "upi", name="payment_type_enum"), nullable=False, unique=True)
    is_enabled = Column(Boolean, nullable=False, default=False)
    upi_id = Column(String(100), nullable=True)
    display_name = Column(String(50), nullable=True)


class VenueSetting(Base):
    __tablename__ = "venue_settings"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    venue_name = Column(String(100), nullable=False, default="Cafe POS")
    self_ordering_enabled = Column(Boolean, nullable=False, default=True)
    self_ordering_mode = Column(
        Enum("online_ordering", "qr_menu", name="self_ordering_mode_enum"),
        nullable=False, default="online_ordering"
    )
    self_order_lock_mode = Column(
        Enum("device", "pin", name="self_order_lock_mode_enum"),
        nullable=False, default="device"
    )
    session_timeout_minutes = Column(SmallInteger, nullable=False, default=60)
    menu_background_color = Column(String(7), nullable=False, default="#ffffff")
    menu_background_image_url = Column(String(500), nullable=True)
    currency_symbol = Column(String(5), nullable=False, default="Rs.")
    tax_label = Column(String(20), nullable=False, default="GST")
    receipt_footer_text = Column(String(255), nullable=True)
    kds_auto_advance = Column(Boolean, nullable=False, default=False)
    loyalty_enabled = Column(Boolean, nullable=False, default=True)
    loyalty_rupees_per_credit = Column(Integer, nullable=False, default=100)
    loyalty_credits_for_reward = Column(Integer, nullable=False, default=50)
    updated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
