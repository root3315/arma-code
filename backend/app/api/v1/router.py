"""
API v1 Router - aggregates all endpoint routers
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, materials, quiz, flashcards, search, projects, billing, webhooks, project_progress


api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(materials.router, tags=["Materials"])  # No prefix - already has /materials in the router
api_router.include_router(quiz.router, tags=["Quiz"])  # No prefix - routes already include /materials/ or /quiz/
api_router.include_router(flashcards.router, tags=["Flashcards"])  # No prefix - routes already include /materials/ or /flashcards/
api_router.include_router(search.router, prefix="/search", tags=["Search"])  # Has prefix in router
api_router.include_router(projects.router, tags=["Projects"])  # No prefix - already has /projects in the router
api_router.include_router(project_progress.router, tags=["Project Progress"])  # No prefix - already has /projects in the router
api_router.include_router(billing.router, prefix="/billing", tags=["Billing"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
