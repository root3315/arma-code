"""Pydantic schemas for ProjectProgress."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProjectProgressResponse(BaseModel):
    """Schema for project learning progress response."""
    id: UUID
    project_id: UUID
    summary_read: bool
    summary_read_at: Optional[datetime] = None
    flashcards_unlocked: bool
    flashcards_unlocked_at: Optional[datetime] = None
    flashcards_completed: bool
    flashcards_completed_at: Optional[datetime] = None
    quiz_unlocked: bool
    quiz_unlocked_at: Optional[datetime] = None
    quiz_completed: bool
    quiz_completed_at: Optional[datetime] = None
    quiz_best_score: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MarkSummaryReadResponse(BaseModel):
    """Response after marking summary as read."""
    summary_read: bool
    summary_read_at: datetime
    flashcards_unlocked: bool

    model_config = ConfigDict(from_attributes=True)


class MarkFlashcardsCompleteResponse(BaseModel):
    """Response after marking flashcards as completed."""
    flashcards_completed: bool
    flashcards_completed_at: datetime
    quiz_unlocked: bool

    model_config = ConfigDict(from_attributes=True)
