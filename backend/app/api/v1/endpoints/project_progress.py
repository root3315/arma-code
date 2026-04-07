"""Project learning progress endpoints.

These endpoints track the user's progression through a project's
AI-generated content: summary → flashcards → quiz.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, get_current_user
from app.infrastructure.database.models.project import Project, ProjectProgress
from app.infrastructure.database.models.user import User
from app.schemas.project_progress import (
    MarkFlashcardsCompleteResponse,
    MarkSummaryReadResponse,
    ProjectProgressResponse,
)

router = APIRouter(prefix="/projects", tags=["Project Progress"])


async def _get_or_create_progress(
    project_id: UUID,
    user_id: UUID,
    db: AsyncSession,
) -> ProjectProgress:
    """Fetch existing progress record or create a new one."""
    result = await db.execute(
        select(ProjectProgress).where(
            ProjectProgress.project_id == project_id,
            ProjectProgress.user_id == user_id,
        )
    )
    progress = result.scalar_one_or_none()

    if not progress:
        progress = ProjectProgress(
            project_id=project_id,
            user_id=user_id,
        )
        db.add(progress)
        await db.commit()
        await db.refresh(progress)

    return progress


async def _verify_project_owner(
    project_id: UUID,
    user_id: UUID,
    db: AsyncSession,
) -> Project:
    """Ensure the project belongs to the current user."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.get(
    "/{project_id}/progress",
    response_model=ProjectProgressResponse,
)
async def get_project_progress(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the learning progress for a project.

    Returns the current state of summary/flashcards/quiz progression.
    If no progress record exists yet, a fresh one is created automatically.
    """
    await _verify_project_owner(project_id, current_user.id, db)
    progress = await _get_or_create_progress(project_id, current_user.id, db)

    return ProjectProgressResponse.model_validate(progress)


@router.post(
    "/{project_id}/progress/mark-summary-read",
    response_model=MarkSummaryReadResponse,
)
async def mark_summary_read(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark the project summary as read.

    This unlocks the flashcards tab for the user.
    """
    await _verify_project_owner(project_id, current_user.id, db)
    progress = await _get_or_create_progress(project_id, current_user.id, db)

    now = datetime.utcnow()
    progress.summary_read = True
    progress.summary_read_at = now
    progress.flashcards_unlocked = True
    progress.flashcards_unlocked_at = now

    await db.commit()
    await db.refresh(progress)

    return MarkSummaryReadResponse(
        summary_read=progress.summary_read,
        summary_read_at=progress.summary_read_at,
        flashcards_unlocked=progress.flashcards_unlocked,
    )


@router.post(
    "/{project_id}/progress/mark-flashcards-complete",
    response_model=MarkFlashcardsCompleteResponse,
)
async def mark_flashcards_complete(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark the flashcards review as completed.

    This unlocks the quiz tab for the user.
    """
    await _verify_project_owner(project_id, current_user.id, db)
    progress = await _get_or_create_progress(project_id, current_user.id, db)

    now = datetime.utcnow()
    progress.flashcards_completed = True
    progress.flashcards_completed_at = now
    progress.quiz_unlocked = True
    progress.quiz_unlocked_at = now

    await db.commit()
    await db.refresh(progress)

    return MarkFlashcardsCompleteResponse(
        flashcards_completed=progress.flashcards_completed,
        flashcards_completed_at=progress.flashcards_completed_at,
        quiz_unlocked=progress.quiz_unlocked,
    )
