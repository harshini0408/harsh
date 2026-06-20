from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.schemas.auth import StaffLoginRequest, StaffLoginResponse, UserCreateRequest, UserResponse, UserUpdateRequest
from app.schemas.customer import CustomerLookupRequest, CustomerRegisterRequest, CustomerResponse
from app.services.auth_service import authenticate_staff, create_staff_user
from app.models.customer import Customer
from app.models.user import User, Role
from app.core.security import hash_password
from app.core.dependencies import get_current_user, role_required
from app.core.exceptions import NotFoundError

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/staff/login", response_model=StaffLoginResponse)
async def staff_login(request: StaffLoginRequest, db: AsyncSession = Depends(get_db)):
    """Staff login — returns role-scoped JWT token."""
    result = await authenticate_staff(db, request.email, request.password)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return result


@router.post("/customer/lookup", response_model=CustomerResponse | None)
async def customer_lookup(request: CustomerLookupRequest, db: AsyncSession = Depends(get_db)):
    """Look up a customer by phone number. Returns customer or null."""
    result = await db.execute(
        select(Customer).where(Customer.mobile_number == request.mobile_number)
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        return None
    return CustomerResponse.model_validate(customer)


@router.post("/customer/register", response_model=CustomerResponse)
async def customer_register(request: CustomerRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register or find a customer by phone number.
    If phone already exists, return existing customer (reuse rule §2.2).
    """
    # Check for existing customer first
    result = await db.execute(
        select(Customer).where(Customer.mobile_number == request.mobile_number)
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        return CustomerResponse.model_validate(existing)

    # Create new customer
    is_guest = request.password is None
    customer = Customer(
        name=request.name,
        mobile_number=request.mobile_number,
        email=request.email,
        password_hash=hash_password(request.password) if request.password else None,
        is_guest=is_guest,
    )
    db.add(customer)

    try:
        await db.commit()
        await db.refresh(customer)
    except IntegrityError:
        await db.rollback()
        # Race condition — another request created the same phone number
        result = await db.execute(
            select(Customer).where(Customer.mobile_number == request.mobile_number)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return CustomerResponse.model_validate(existing)
        raise HTTPException(status_code=500, detail="Failed to create customer")

    return CustomerResponse.model_validate(customer)
