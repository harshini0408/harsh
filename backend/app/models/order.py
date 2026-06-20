from sqlalchemy import (
    Column, String, Boolean, TIMESTAMP, ForeignKey, Text,
    SmallInteger, Integer, BigInteger, Numeric, Enum, text
)
from sqlalchemy.orm import relationship
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(String(20), nullable=False, unique=True)
    source = Column(Enum("cashier", "self_order", name="order_source_enum"), nullable=False)
    table_id = Column(SmallInteger, ForeignKey("tables_master.id"), nullable=True)
    table_session_id = Column(BigInteger, ForeignKey("table_sessions.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    pos_session_id = Column(Integer, ForeignKey("pos_sessions.id"), nullable=True)
    placed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(
        Enum("draft", "sent_to_kitchen", "paid", "cancelled", name="order_status_enum"),
        nullable=False, default="draft"
    )
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    tax_total = Column(Numeric(10, 2), nullable=False, default=0)
    discount_total = Column(Numeric(10, 2), nullable=False, default=0)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    loyalty_credits_earned = Column(Integer, nullable=False, default=0)
    loyalty_credits_redeemed = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    table = relationship("TableMaster", back_populates="orders")
    table_session = relationship("TableSession", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    pos_session = relationship("PosSession", back_populates="orders")
    placed_by_user = relationship("User", foreign_keys=[placed_by_user_id])
    coupon = relationship("Coupon")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order")
    loyalty_entries = relationship("LoyaltyLedger", back_populates="order")
    receipt_logs = relationship("ReceiptLog", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(8, 2), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_discount = Column(Numeric(10, 2), nullable=False, default=0)
    line_total = Column(Numeric(10, 2), nullable=False)
    kitchen_status = Column(
        Enum("to_cook", "preparing", "completed", name="kitchen_status_enum"),
        nullable=False, default="to_cook"
    )
    is_loyalty_redemption = Column(Boolean, nullable=False, default=False)
    notes = Column(String(255), nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    payment_method_id = Column(SmallInteger, ForeignKey("payment_methods.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    amount_received = Column(Numeric(10, 2), nullable=True)
    change_due = Column(Numeric(10, 2), nullable=True)
    reference_code = Column(String(100), nullable=True)
    status = Column(
        Enum("pending", "success", "failed", name="payment_status_enum"),
        nullable=False, default="pending"
    )
    received_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    order = relationship("Order", back_populates="payments")
    payment_method = relationship("PaymentMethod")
    received_by_user = relationship("User", foreign_keys=[received_by])


class ReceiptLog(Base):
    __tablename__ = "receipt_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    recipient_email = Column(String(150), nullable=False)
    sent_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    delivery_status = Column(
        Enum("sent", "failed", "unknown", name="delivery_status_enum"),
        nullable=False, default="unknown"
    )
    error_message = Column(Text, nullable=True)

    order = relationship("Order", back_populates="receipt_logs")
