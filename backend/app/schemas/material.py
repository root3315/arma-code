from pydantic import BaseModel, HttpUrl, ConfigDict, Field
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any
from enum import Enum

from app.schemas.common import BaseSchema, TimestampSchema


class MaterialType(str, Enum):
    """Material type enum."""
    PDF = "pdf"
    YOUTUBE = "youtube"
    ARTICLE = "article"
    DOCX = "docx"
    DOC = "doc"
    TXT = "txt"


class ProcessingStatus(str, Enum):
    """Processing status enum."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MaterialBase(BaseModel):
    """Base material schema."""
    title: str = Field(..., min_length=1, max_length=200)
    type: MaterialType

    model_config = ConfigDict(use_enum_values=True)


class MaterialCreate(MaterialBase):
    """Schema for creating a material."""
    # For PDF uploads, file will be handled separately via multipart/form-data
    # For YouTube, we need the URL
    source: Optional[str] = Field(None, description="YouTube URL for youtube type")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Introduction to Python",
                "type": "youtube",
                "source": "https://www.youtube.com/watch?v=xyz123"
            }
        }
    )


class MaterialUpdate(BaseModel):
    """Schema for updating a material."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Updated Title"
            }
        }
    )


class MaterialSummaryResponse(TimestampSchema):
    """Schema for material summary response."""
    id: UUID
    material_id: UUID
    summary: str


class MaterialNotesResponse(TimestampSchema):
    """Schema for material notes response."""
    id: UUID
    material_id: UUID
    notes: str


class MaterialResponse(TimestampSchema):
    """Schema for material list response."""
    id: UUID
    user_id: UUID
    project_id: Optional[UUID] = None
    title: str
    type: MaterialType
    processing_status: ProcessingStatus
    processing_progress: int
    processing_error: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    source: Optional[str] = None
    # Podcast fields
    podcast_script: Optional[List[Dict[str, str]]] = None
    podcast_audio_url: Optional[str] = None
    # Presentation fields
    presentation_status: Optional[str] = None
    presentation_url: Optional[str] = None
    presentation_embed_url: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "123e4567-e89b-12d3-a456-426614174001",
                "title": "Introduction to Python",
                "type": "youtube",
                "processing_status": "completed",
                "processing_progress": 100,
                "processing_error": None,
                "file_name": None,
                "file_size": None,
                "source": "https://www.youtube.com/watch?v=xyz123",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    )


class MaterialDetailResponse(MaterialResponse):
    """Schema for detailed material response with content."""
    full_text: Optional[str] = None
    rich_content: Optional[Dict[str, Any]] = None
    summary: Optional[MaterialSummaryResponse] = None
    notes: Optional[MaterialNotesResponse] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "123e4567-e89b-12d3-a456-426614174001",
                "title": "Introduction to Python",
                "type": "youtube",
                "processing_status": "completed",
                "processing_progress": 100,
                "processing_error": None,
                "file_name": None,
                "file_size": None,
                "source": "https://www.youtube.com/watch?v=xyz123",
                "full_text": "Python is a high-level programming language...",
                "rich_content": {"headings": [], "sections": []},
                "summary": None,
                "notes": None,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    )


class MaterialProcessingUpdate(BaseModel):
    """Schema for updating material processing status."""
    processing_status: ProcessingStatus
    processing_progress: int = Field(..., ge=0, le=100)
    processing_error: Optional[str] = None
    full_text: Optional[str] = None
    rich_content: Optional[Dict[str, Any]] = None


class TutorMessageRequest(BaseModel):
    """Schema for tutor chat message request."""
    message: str = Field(..., min_length=1, max_length=5000)
    context: str = Field(default="chat", pattern="^(chat|selection)$")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "Can you explain this concept in simpler terms?",
                "context": "chat"
            }
        }
    )


class TutorMessageResponse(TimestampSchema):
    """Schema for tutor message response."""
    id: UUID
    material_id: UUID
    role: str
    content: str
    context: str

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "material_id": "123e4567-e89b-12d3-a456-426614174001",
                "role": "assistant",
                "content": "Sure! Let me explain...",
                "context": "chat",
                "created_at": "2024-01-01T00:00:00"
            }
        }
    )


class ProjectTutorMessageResponse(TimestampSchema):
    """Schema for project tutor message response."""
    id: UUID
    project_id: UUID
    role: str
    content: str
    context: str

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "project_id": "123e4567-e89b-12d3-a456-426614174001",
                "role": "assistant",
                "content": "Sure! Let me explain...",
                "context": "chat",
                "created_at": "2024-01-01T00:00:00"
            }
        }
    )


class ProjectTutorChatHistoryResponse(BaseModel):
    """Schema for project tutor chat history response."""
    messages: List[ProjectTutorMessageResponse]
    total: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "messages": [],
                "total": 0
            }
        }
    )


class TutorChatHistoryResponse(BaseModel):
    """Schema for tutor chat history response."""
    messages: List[TutorMessageResponse]
    total: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "messages": [],
                "total": 0
            }
        }
    )


# ============== Batch Upload Schemas ==============

class BatchUploadRequest(BaseModel):
    """Schema for batch material upload response."""
    pass


class BatchUploadResponse(BaseModel):
    """Schema for batch upload response."""
    batch_id: UUID
    project_id: UUID
    materials: List[MaterialResponse]
    status: str  # "queued", "processing"
    total_files: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "batch_id": "123e4567-e89b-12d3-a456-426614174000",
                "project_id": "123e4567-e89b-12d3-a456-426614174001",
                "materials": [],
                "status": "queued",
                "total_files": 5
            }
        }
    )


# ============== Project Content Schemas ==============

class ProjectContentResponse(BaseModel):
    """Schema for project-level AI content response."""
    id: UUID
    project_id: UUID
    summary: Optional[str] = None
    notes: Optional[str] = None
    flashcards: Optional[List[Dict[str, str]]] = None  # [{question, answer}, ...]
    quiz: Optional[List[Dict[str, Any]]] = None  # [{question, options, correct_option}, ...]
    processing_status: ProcessingStatus
    processing_progress: int
    total_materials: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "project_id": "123e4567-e89b-12d3-a456-426614174001",
                "summary": "Combined summary of all materials...",
                "notes": "Combined notes...",
                "flashcards": [{"question": "Q1", "answer": "A1"}],
                "quiz": [{"question": "Q1", "options": {"a": "A", "b": "B"}, "correct_option": "a"}],
                "processing_status": "completed",
                "processing_progress": 100,
                "total_materials": 5,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    )


class ProjectContentRegenerateRequest(BaseModel):
    """Schema for regenerating project content."""
    pass


# ============== Material Content Schema ==============

class MaterialContentResponse(BaseModel):
    """Schema for single material content response."""
    id: UUID
    material_id: UUID
    title: str
    summary: Optional[str] = None
    notes: Optional[str] = None
    flashcards: Optional[List[Dict[str, str]]] = None
    quiz: Optional[List[Dict[str, Any]]] = None
    processing_status: str
    type: str

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "material_id": "123e4567-e89b-12d3-a456-426614174001",
                "title": "Introduction to Python",
                "summary": "Summary of this material...",
                "notes": "Notes for this material...",
                "flashcards": [{"question": "Q1", "answer": "A1"}],
                "quiz": [{"question": "Q1", "options": {"a": "A", "b": "B"}, "correct_option": "a"}],
                "processing_status": "completed",
                "type": "pdf"
            }
        }
    )
