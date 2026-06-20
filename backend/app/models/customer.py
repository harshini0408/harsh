from sqlalchemy import (
    Column, String, Boolean, TIMESTAMP, ForeignKey, Integer, BigInteger,
    Enum, text
)
from sqlalchemy.orm import relationship
from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=True)
    mobile_number = Column(String(15), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=True)
    is_guest = Column(Boolean, nullable=False, default=True)
    loyalty_credits = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))

    loyalty_ledger = relationship("LoyaltyLedger", back_populates="customer")
    orders = relationship("Order", back_populates="customer")


class LoyaltyLedger(Base):
    __tablename__ = "loyalty_ledger"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    entry_type = Column(Enum("earn", "redeem", "adjustment", name="loyalty_entry_type"), nullable=False)
    credits_delta = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    note = Column(String(255), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    customer = relationship("Customer", back_populates="loyalty_ledger")
    order = relationship("Order", back_populates="loyalty_entries")
    created_by_user = relationship("User", foreign_keys=[created_by])
