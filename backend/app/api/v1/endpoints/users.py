from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


class RoleUpdateRequest(BaseModel):
    role: str


@router.get("/me", response_model=UserResponse)
async def read_user_me(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.patch("/me/role", response_model=UserResponse)
@router.put("/me/role", response_model=UserResponse)
async def update_user_role(
    payload: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Allow user to switch role between 'teacher' and 'student'."""
    new_role = payload.role.lower().strip()
    if new_role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'teacher' or 'student'"
        )
    
    current_user.role = new_role
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

