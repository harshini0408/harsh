from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
import os, uuid

from app.database import get_db
from app.models.user import User, Role
from app.models.catalog import Category, Product
from app.models.order import Order
from app.models.customer import Customer
from app.models.coupon import Coupon, Promotion
from app.models.venue import VenueSetting, PaymentMethod, Floor, TableMaster
from app.schemas.catalog import (
    CategoryCreateRequest, CategoryUpdateRequest, CategoryResponse,
    ProductCreateRequest, ProductUpdateRequest, ProductResponse,
)
from app.schemas.coupon import (
    CouponCreateRequest, CouponUpdateRequest, CouponResponse,
    PromotionCreateRequest, PromotionUpdateRequest, PromotionResponse,
)
from app.schemas.venue import VenueSettingsResponse, VenueSettingsUpdateRequest, FloorCreateRequest, TableCreateRequest, TableUpdateRequest, PaymentMethodResponse
from app.schemas.auth import UserCreateRequest, UserResponse, UserUpdateRequest
from app.services.auth_service import create_staff_user
from app.services.inventory_service import get_low_stock_items
from app.core.dependencies import role_required
from app.core.exceptions import NotFoundError
from app.core.security import hash_password
from app.utils.qr import generate_qr_token
from app.config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


# --- Dashboard ---
@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    """Dashboard data: sales overview, low stock alerts."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's sales
    today_result = await db.execute(
        select(func.count(Order.id), func.coalesce(func.sum(Order.total), 0))
        .where(Order.status == "paid", Order.created_at >= today_start)
    )
    today_row = today_result.one()
    today_orders = today_row[0]
    today_revenue = float(today_row[1])

    # Total orders
    total_result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "paid")
    )
    total_orders = total_result.scalar()

    # Low stock
    low_stock = await get_low_stock_items(db)

    # Recent orders
    recent_result = await db.execute(
        select(Order).order_by(Order.created_at.desc()).limit(10)
    )
    recent_orders = recent_result.scalars().all()

    return {
        "today_orders": today_orders,
        "today_revenue": today_revenue,
        "avg_order_value": round(today_revenue / today_orders, 2) if today_orders > 0 else 0,
        "total_orders": total_orders,
        "low_stock_items": low_stock,
        "recent_orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "source": o.source,
                "status": o.status,
                "total": float(o.total),
                "created_at": o.created_at,
            }
            for o in recent_orders
        ],
    }


# --- Categories ---
@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.display_order))
    return [CategoryResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/categories")
async def create_category(
    request: CategoryCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    category = Category(**request.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return {"id": category.id, "message": "Category created."}


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    request: CategoryUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category")
    for k, v in request.model_dump(exclude_unset=True).items():
        setattr(category, k, v)
    await db.commit()
    return {"message": "Category updated."}


# --- Products ---
@router.get("/products")
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).options(selectinload(Product.category)).order_by(Product.name)
    )
    products = result.scalars().all()
    return [
        {
            "id": p.id,
            "category_id": p.category_id,
            "category_name": p.category.name if p.category else None,
            "name": p.name,
            "price": float(p.price),
            "uom": p.uom,
            "tax_percent": float(p.tax_percent),
            "description": p.description,
            "image_url": p.image_url,
            "kds_visible": p.kds_visible,
            "is_active": p.is_active,
            "is_loyalty_reward": p.is_loyalty_reward,
            "created_at": p.created_at,
        }
        for p in products
    ]


@router.post("/products")
async def create_product(
    request: ProductCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    product = Product(**request.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return {"id": product.id, "message": "Product created."}


@router.put("/products/{product_id}")
async def update_product(
    product_id: int,
    request: ProductUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product")
    for k, v in request.model_dump(exclude_unset=True).items():
        setattr(product, k, v)
    await db.commit()
    return {"message": "Product updated."}


@router.post("/products/{product_id}/image")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    """Upload a product image."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product")

    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    product.image_url = f"/uploads/{filename}"
    await db.commit()
    return {"image_url": product.image_url}


# --- Coupons ---
@router.get("/coupons", response_model=list[CouponResponse])
async def list_coupons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(Coupon))
    return [CouponResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/coupons")
async def create_coupon(
    request: CouponCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    coupon = Coupon(**request.model_dump(), created_by=current_user.id)
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return {"id": coupon.id, "message": "Coupon created."}


@router.put("/coupons/{coupon_id}")
async def update_coupon(
    coupon_id: int,
    request: CouponUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise NotFoundError("Coupon")
    for k, v in request.model_dump(exclude_unset=True).items():
        setattr(coupon, k, v)
    await db.commit()
    return {"message": "Coupon updated."}


# --- Promotions ---
@router.get("/promotions", response_model=list[PromotionResponse])
async def list_promotions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(Promotion).options(selectinload(Promotion.product)))
    promos = result.scalars().all()
    return [
        PromotionResponse(
            id=p.id, name=p.name, scope=p.scope, product_id=p.product_id,
            product_name=p.product.name if p.product else None,
            min_quantity=p.min_quantity, min_order_amount=float(p.min_order_amount) if p.min_order_amount else None,
            discount_type=p.discount_type, value=float(p.value),
            is_active=p.is_active, valid_from=p.valid_from, valid_until=p.valid_until,
        )
        for p in promos
    ]


@router.post("/promotions")
async def create_promotion(
    request: PromotionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    promo = Promotion(**request.model_dump())
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return {"id": promo.id, "message": "Promotion created."}


@router.put("/promotions/{promo_id}")
async def update_promotion(
    promo_id: int,
    request: PromotionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(Promotion).where(Promotion.id == promo_id))
    promo = result.scalar_one_or_none()
    if not promo:
        raise NotFoundError("Promotion")
    for k, v in request.model_dump(exclude_unset=True).items():
        setattr(promo, k, v)
    await db.commit()
    return {"message": "Promotion updated."}


# --- Venue Settings ---
@router.get("/venue-settings", response_model=VenueSettingsResponse)
async def get_venue_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VenueSetting))
    vs = result.scalar_one_or_none()
    if not vs:
        raise NotFoundError("Venue settings")
    return VenueSettingsResponse.model_validate(vs)


@router.put("/venue-settings")
async def update_venue_settings(
    request: VenueSettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(VenueSetting))
    vs = result.scalar_one_or_none()
    if not vs:
        raise NotFoundError("Venue settings")
    for k, v in request.model_dump(exclude_unset=True).items():
        setattr(vs, k, v)
    await db.commit()
    return {"message": "Venue settings updated."}


# --- Payment Methods ---
@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
async def list_payment_methods(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PaymentMethod))
    return [PaymentMethodResponse.model_validate(pm) for pm in result.scalars().all()]


# --- Floors & Tables ---
@router.get("/floors")
async def list_floors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Floor).options(selectinload(Floor.tables)).order_by(Floor.display_order)
    )
    floors = result.scalars().all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "display_order": f.display_order,
            "tables": [
                {
                    "id": t.id,
                    "table_number": t.table_number,
                    "seats": t.seats,
                    "is_active": t.is_active,
                    "qr_token": t.qr_token,
                }
                for t in f.tables
            ],
        }
        for f in floors
    ]


@router.post("/floors")
async def create_floor(
    request: FloorCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    floor = Floor(name=request.name, display_order=request.display_order)
    db.add(floor)
    await db.commit()
    await db.refresh(floor)
    return {"id": floor.id, "message": "Floor created."}


@router.post("/tables")
async def create_table(
    request: TableCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    table = TableMaster(
        floor_id=request.floor_id,
        table_number=request.table_number,
        seats=request.seats,
        qr_token=generate_qr_token(),
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return {"id": table.id, "qr_token": table.qr_token, "message": "Table created."}


@router.put("/tables/{table_id}")
async def update_table(
    table_id: int,
    request: TableUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(TableMaster).where(TableMaster.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise NotFoundError("Table")
    for k, v in request.model_dump(exclude_unset=True).items():
        setattr(table, k, v)
    await db.commit()
    return {"message": "Table updated."}


# --- Users ---
@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(User).options(selectinload(User.role)))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "mobile_number": u.mobile_number,
            "role": u.role.name,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("/users")
async def create_user(
    request: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    user = await create_staff_user(
        db, request.name, request.email, request.mobile_number,
        request.password, request.role,
    )
    return {"id": user.id, "message": f"User '{user.name}' created with role '{request.role}'."}


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    request: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("User")
    update_data = request.model_dump(exclude_unset=True)
    if "role" in update_data:
        role_result = await db.execute(select(Role).where(Role.name == update_data.pop("role")))
        role = role_result.scalar_one_or_none()
        if role:
            user.role_id = role.id
    for k, v in update_data.items():
        setattr(user, k, v)
    await db.commit()
    return {"message": "User updated."}


# --- Customers (for admin search) ---
@router.get("/customers")
async def search_customers(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("superadmin", "cashier")),
):
    """Search customers by name or phone."""
    query = select(Customer)
    if q:
        query = query.where(
            (Customer.name.ilike(f"%{q}%")) | (Customer.mobile_number.ilike(f"%{q}%"))
        )
    result = await db.execute(query.limit(50))
    customers = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "mobile_number": c.mobile_number,
            "is_guest": c.is_guest,
            "loyalty_credits": c.loyalty_credits,
            "created_at": c.created_at,
        }
        for c in customers
    ]
