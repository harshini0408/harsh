from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, Role, UserSessionLog
from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import NotFoundError


async def authenticate_staff(db: AsyncSession, email: str, password: str) -> dict | None:
    """Authenticate a staff user by email and password. Returns token data or None."""
    result = await db.execute(
        select(User).where(User.email == email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        return None

    # Load role
    await db.refresh(user, ["role"])

    # Log the session
    session_log = UserSessionLog(user_id=user.id)
    db.add(session_log)
    await db.commit()

    # Create JWT
    token = create_access_token({
        "user_id": user.id,
        "role": user.role.name,
        "name": user.name,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "mobile_number": user.mobile_number,
            "role": user.role.name,
            "is_active": user.is_active,
            "created_at": user.created_at,
        },
    }


async def create_staff_user(
    db: AsyncSession, name: str, email: str, mobile_number: str,
    password: str, role_name: str
) -> User:
    """Create a new staff user."""
    # Find role
    result = await db.execute(select(Role).where(Role.name == role_name))
    role = result.scalar_one_or_none()
    if role is None:
        raise NotFoundError("Role")

    user = User(
        name=name,
        email=email,
        mobile_number=mobile_number,
        password_hash=hash_password(password),
        role_id=role.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await db.refresh(user, ["role"])
    return user
