from typing import Any
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def read_user_me(
    current_user: User = Depends(get_current_user)
):
    print("================================")
    print("Email :", current_user.email)
    print("Role  :", current_user.role)
    print("================================")
    return current_user
