import uuid
from typing import Any, Dict
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.core.security import decode_token
from app.database.session import get_db
from app.models.user import User

# Configure OAuth2 scheme pointing to the login route
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

from app.core.blacklist import is_token_blacklisted

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """FastAPI dependency to retrieve the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check if token is blacklisted
    if is_token_blacklisted(token):
        raise credentials_exception
        
    try:
        payload = decode_token(token)
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type")
        token_version: int = payload.get("token_version")
        
        # Verify the subject exists and this is an access token
        if not user_id_str or token_type != "access":
            raise credentials_exception
            
        user_id = uuid.UUID(user_id_str)
    except (ValueError, Exception):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
        
    # Verify token version matches user's current token version in DB
    if token_version != user.token_version:
        raise credentials_exception
        
    return user


def check_role(allowed_roles: list[str]):
    """Returns a dependency that validates user roles."""
    async def role_dependency(
        current_user: User = Depends(get_current_user)
    ) -> User:
        user_role = str(current_user.role).strip().lower() if current_user.role else ""
        normalized_allowed_roles = [str(r).strip().lower() for r in allowed_roles]

        if user_role not in normalized_allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have enough permissions to access this resource."
            )
        return current_user
    return role_dependency



