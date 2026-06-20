from sqlalchemy import (
    Column, String, Boolean, Integer, Numeric, Date,
    ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from app.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(30), nullable=False, unique=True)
    discount_type = Column(Enum("percent", "fixed", name="coupon_discount_type_enum"), nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    max_uses = Column(Integer, nullable=True)
    used_count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_by_user = relationship("User", foreign_keys=[created_by])


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    scope = Column(Enum("product", "order", name="promo_scope_enum"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    min_quantity = Column(Integer, nullable=True)
    min_order_amount = Column(Numeric(10, 2), nullable=True)
    discount_type = Column(Enum("percent", "fixed", name="promo_discount_type_enum"), nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)

    product = relationship("Product", foreign_keys=[product_id])
