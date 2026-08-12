from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, quizzes, ai, attempts, sessions

api_router = APIRouter()

# Register auth and users endpoints under API V1
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["Quizzes"])
api_router.include_router(attempts.router, prefix="/quizzes", tags=["Quiz Attempts"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Quiz Generation"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Live Session Lobby"])

