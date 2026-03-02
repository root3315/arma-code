"""
API v1 Router - aggregates all endpoint routers
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, materials, quiz, flashcards, search
from app.api.v1.endpoints.voice import voice_chat


api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(materials.router, prefix="/materials", tags=["Materials"])
api_router.include_router(quiz.router, tags=["Quiz"])  # No prefix - routes already include /materials/ or /quiz/
api_router.include_router(flashcards.router, tags=["Flashcards"])  # No prefix - routes already include /materials/ or /flashcards/
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(voice_chat.router, prefix="/voice", tags=["Voice Chat"])
