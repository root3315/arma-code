"""
Materials API endpoints

Supports batch upload of multiple files (PDF, YouTube, Links) to a project.
All materials in a batch are processed together to generate unified AI content.
"""
import os
import uuid
import logging
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import UUID
from typing import List, Optional
from datetime import datetime

import httpx
from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_db, get_current_user, get_current_active_user, require_quota, require_plan

logger = logging.getLogger(__name__)
from app.infrastructure.database.models.material import (
    Material,
    MaterialType,
    ProcessingStatus,
    ProjectContent,
    TutorMessage,
    ProjectTutorMessage,
)
from app.infrastructure.database.models.user import User
from app.domain.services.tutor_service import TutorService
from app.schemas.material import (
    MaterialResponse,
    BatchUploadResponse,
    ProjectContentResponse,
    MaterialContentResponse,
    TutorMessageResponse,
    ProjectTutorMessageResponse,
    ProjectTutorChatHistoryResponse,
    TutorChatHistoryResponse,
    TutorMessageRequest,
)
from app.infrastructure.queue.tasks import process_material_batch_task
from tenacity import RetryError

router = APIRouter(prefix="/materials", tags=["Materials"])

# Constants
MAX_FILES_PER_BATCH = 10
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".html", ".htm"}

REMOTE_CONTENT_TYPE_EXTENSIONS = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/html": ".html",
}

REMOTE_TYPE_FALLBACK_EXTENSIONS = {
    MaterialType.PDF.value: ".pdf",
    MaterialType.DOCX.value: ".docx",
    MaterialType.DOC.value: ".doc",
    MaterialType.TXT.value: ".txt",
}


def _normalize_project_name(raw_name: Optional[str], fallback: str = "Imported material") -> str:
    normalized = (raw_name or "").strip()
    return normalized[:200] or fallback


def _safe_filename_stem(raw_name: str) -> str:
    stem = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in raw_name.strip())
    return stem.strip("_")[:80] or "material"


def _build_material_response(material: Material) -> MaterialResponse:
    return MaterialResponse(
        id=material.id,
        user_id=material.user_id,
        project_id=material.project_id,
        title=material.title,
        type=material.type,
        processing_status=material.processing_status,
        processing_progress=material.processing_progress,
        processing_error=material.processing_error,
        file_name=material.file_name,
        file_size=material.file_size,
        source=material.source,
        podcast_script=material.podcast_script,
        podcast_audio_url=material.podcast_audio_url,
        presentation_status=material.presentation_status,
        presentation_url=material.presentation_url,
        presentation_embed_url=material.presentation_embed_url,
        created_at=material.created_at,
        updated_at=material.updated_at,
    )


async def _download_remote_upload(
    source_url: str,
    fallback_title: str,
    material_type: str,
) -> tuple[Optional[UploadFile], bool]:
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=True,
    ) as client:
        response = await client.get(source_url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    resolved_path = unquote(urlparse(str(response.url)).path)
    filename = Path(resolved_path).name
    file_ext = Path(filename).suffix.lower()
    looks_like_pdf = response.content.startswith(b"%PDF")
    treat_as_link = content_type == "text/html" and material_type == MaterialType.PDF.value and not looks_like_pdf

    if treat_as_link:
        return None, True

    if not file_ext:
        file_ext = REMOTE_CONTENT_TYPE_EXTENSIONS.get(content_type) or REMOTE_TYPE_FALLBACK_EXTENSIONS.get(material_type, ".txt")

    if file_ext not in ALLOWED_EXTENSIONS:
        file_ext = REMOTE_TYPE_FALLBACK_EXTENSIONS.get(material_type, ".txt")

    filename_stem = Path(filename).stem if filename else _safe_filename_stem(fallback_title)
    safe_name = f"{_safe_filename_stem(filename_stem)}{file_ext}"
    upload = UploadFile(filename=safe_name, file=BytesIO(response.content))
    return upload, False


@router.post("/batch", status_code=status.HTTP_201_CREATED, response_model=BatchUploadResponse)
async def upload_materials_batch(
    project_id: Optional[UUID] = Form(None),
    project_name: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(default=None),
    youtube_urls: Optional[List[str]] = Form(default=None),
    link_urls: Optional[List[str]] = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload multiple materials (up to 10) to a project.

    Accepts:
    - files: PDF, DOCX, TXT, MD, HTML files (max 10)
    - youtube_urls: YouTube video URLs (max 10)
    - link_urls: Web article URLs (max 10)
    - project_id: Existing project ID (optional)
    - project_name: New project name (optional, creates new project if project_id not provided)

    Total materials (files + youtube_urls + link_urls) cannot exceed 10.

    All materials are processed together to generate unified AI content for the project.
    """
    from app.infrastructure.database.models.project import Project
    from app.core.config import settings as app_settings

    # Normalize empty lists
    files = files or []
    youtube_urls = youtube_urls or []
    link_urls = link_urls or []

    # Validate total count
    total_materials = len(files) + len(youtube_urls) + len(link_urls)

    # Check material upload quota (skip when billing bypass is on)
    if not app_settings.BILLING_BYPASS:
        from app.domain.services.usage_tracking_service import check_quota
        allowed, summary = await check_quota(current_user.id, "material_upload", db)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "quota_exceeded",
                    "resource_type": summary.resource_type,
                    "used": summary.used,
                    "limit": summary.limit,
                    "message": f"You have used {summary.used}/{summary.limit} material uploads this month.",
                    "upgrade_url": "/pricing",
                },
            )

    if total_materials == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file, YouTube URL, or link URL is required"
        )

    if total_materials > MAX_FILES_PER_BATCH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_FILES_PER_BATCH} materials per batch. You uploaded {total_materials}."
        )

    # Create project if project_id not provided
    if not project_id:
        if not project_name:
            project_name = f"Project {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        
        project = Project(
            id=uuid.uuid4(),
            owner_id=current_user.id,
            name=project_name,
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        project_id = project.id
        logger.info(f"Created new project {project_id} with name '{project_name}'")
    else:
        # Verify project exists and belongs to user
        result = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
    
    # Validate file sizes and types
    for file in files:
        # Check file size
        file_size = 0
        content = await file.read()
        file_size = len(content)
        await file.seek(0)  # Reset file pointer
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds {MAX_FILE_SIZE // (1024 * 1024)}MB limit"
            )
        
        # Check file extension
        file_ext = os.path.splitext(file.filename or "")[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not allowed. Allowed: {ALLOWED_EXTENSIONS}"
            )
    
    # Generate batch_id
    batch_id = uuid.uuid4()
    
    # Create material records
    materials = []
    material_ids = []
    
    # Process files
    for file in files:
        material_id = uuid.uuid4()

        # Read file content
        file_content = await file.read()
        await file.seek(0)  # Reset file pointer

        # Determine file type based on extension
        file_ext = os.path.splitext(file.filename or "")[1].lower().lstrip('.')

        # Map extension to MaterialType value (lowercase string)
        type_mapping = {
            'pdf': MaterialType.PDF,
            'docx': MaterialType.DOCX,
            'doc': MaterialType.DOC,
            'txt': MaterialType.TXT,
        }

        material_type = type_mapping.get(file_ext, MaterialType.PDF)

        # Debug print (always works)
        print(f"*** DEBUG: File={file.filename}, Ext={file_ext}, Type={material_type} ***")

        material = Material(
            id=material_id,
            user_id=current_user.id,
            project_id=project_id,
            batch_id=batch_id,
            title=file.filename or "Untitled",
            type=material_type,
            file_name=file.filename,
            file_size=len(file_content),
            file_path=f"storage/materials/{current_user.id}/{batch_id}/{file.filename}",
            processing_status=ProcessingStatus.QUEUED,
            processing_progress=0,
        )
        db.add(material)
        materials.append(material)
        material_ids.append(str(material_id))

        # Save file
        file_path = os.path.join("storage", "materials", str(current_user.id), str(batch_id))
        os.makedirs(file_path, exist_ok=True)
        full_path = os.path.join(file_path, file.filename or "untitled")

        with open(full_path, "wb") as f:
            f.write(file_content)
    
    # Process YouTube URLs
    if youtube_urls:
        for url in youtube_urls:
            material_id = uuid.uuid4()
            # Extract video ID for title
            video_id = url.split("v=")[-1].split("&")[0] if "v=" in url else "video"
            material = Material(
                id=material_id,
                user_id=current_user.id,
                project_id=project_id,
                batch_id=batch_id,
                title=f"YouTube: {video_id}",
                type=MaterialType.YOUTUBE,
                source=url,
                processing_status=ProcessingStatus.QUEUED,
                processing_progress=0,
            )
            db.add(material)
            materials.append(material)
            material_ids.append(str(material_id))
    
    # Process link URLs
    if link_urls:
        for url in link_urls:
            material_id = uuid.uuid4()
            material = Material(
                id=material_id,
                user_id=current_user.id,
                project_id=project_id,
                batch_id=batch_id,
                title=f"Article: {url[:50]}...",
                type=MaterialType.ARTICLE,
                source=url,
                processing_status=ProcessingStatus.QUEUED,
                processing_progress=0,
            )
            db.add(material)
            materials.append(material)
            material_ids.append(str(material_id))
    
    # Create ProjectContent record
    project_content = ProjectContent(
        project_id=project_id,
        processing_status=ProcessingStatus.QUEUED,
        processing_progress=0,
        total_materials=total_materials,
    )
    db.add(project_content)
    
    # Commit all changes
    await db.commit()
    
    # Refresh to get IDs
    for material in materials:
        await db.refresh(material)
    await db.refresh(project_content)
    
    # Queue Celery task for batch processing
    # Pass storage directory for file resolution
    process_material_batch_task.delay(
        batch_id=str(batch_id),
        material_ids=material_ids,
        user_id=str(current_user.id),
    )
    
    # Record usage for each material uploaded (skip when billing bypass is on)
    if not app_settings.BILLING_BYPASS:
        from app.domain.services.usage_tracking_service import record_usage
        await record_usage(current_user.id, "material_upload", total_materials, db)
        await db.commit()

    # Return response
    return BatchUploadResponse(
        batch_id=batch_id,
        project_id=project_id,
        materials=[_build_material_response(m) for m in materials],
        status="queued",
        total_files=total_materials,
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MaterialResponse)
async def create_material(
    title: str = Form(...),
    material_type: str = Form(...),
    file: Optional[UploadFile] = File(default=None),
    source: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Backward-compatible single material creation endpoint.

    Creates a dedicated project for a single uploaded/imported material and
    reuses the batch pipeline so frontend flows stay aligned with current
    processing behavior.
    """
    normalized_title = _normalize_project_name(title, "Imported material")

    if file is None and not source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either file or source is required",
        )

    try:
        if file is not None:
            batch_response = await upload_materials_batch(
                project_id=None,
                project_name=normalized_title,
                files=[file],
                youtube_urls=[],
                link_urls=[],
                db=db,
                current_user=current_user,
            )
        elif material_type == MaterialType.YOUTUBE.value:
            batch_response = await upload_materials_batch(
                project_id=None,
                project_name=normalized_title,
                files=[],
                youtube_urls=[source],
                link_urls=[],
                db=db,
                current_user=current_user,
            )
        elif material_type == MaterialType.ARTICLE.value:
            batch_response = await upload_materials_batch(
                project_id=None,
                project_name=normalized_title,
                files=[],
                youtube_urls=[],
                link_urls=[source],
                db=db,
                current_user=current_user,
            )
        else:
            downloaded_file, treat_as_link = await _download_remote_upload(
                source_url=source,
                fallback_title=normalized_title,
                material_type=material_type,
            )
            if treat_as_link:
                batch_response = await upload_materials_batch(
                    project_id=None,
                    project_name=normalized_title,
                    files=[],
                    youtube_urls=[],
                    link_urls=[source],
                    db=db,
                    current_user=current_user,
                )
            elif downloaded_file is not None:
                batch_response = await upload_materials_batch(
                    project_id=None,
                    project_name=normalized_title,
                    files=[downloaded_file],
                    youtube_urls=[],
                    link_urls=[],
                    db=db,
                    current_user=current_user,
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to prepare remote material",
                )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download remote material: {exc}",
        ) from exc

    if not batch_response.materials:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Material was not created",
        )

    return batch_response.materials[0]


@router.get("", response_model=List[MaterialResponse])
async def list_materials(
    project_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all materials for a project, or all user materials if project_id not provided."""
    query = select(Material).where(
        Material.user_id == current_user.id,
        Material.deleted_at.is_(None),
    )
    
    if project_id:
        query = query.where(Material.project_id == project_id)
    
    query = query.order_by(Material.created_at.desc())
    
    result = await db.execute(query)
    materials = result.scalars().all()

    return [_build_material_response(m) for m in materials]


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific material by ID."""
    result = await db.execute(
        select(Material)
        .where(
            Material.id == material_id,
            Material.user_id == current_user.id,
            Material.deleted_at.is_(None),
        )
    )
    material = result.scalar_one_or_none()
    
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found"
        )
    
    return _build_material_response(material)


@router.get("/batch/{batch_id}", response_model=List[MaterialResponse])
async def get_batch_materials(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all materials in a batch."""
    result = await db.execute(
        select(Material)
        .where(
            Material.batch_id == batch_id,
            Material.user_id == current_user.id,
            Material.deleted_at.is_(None),
        )
        .order_by(Material.created_at.asc())
    )
    materials = result.scalars().all()
    
    if not materials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No materials found for this batch"
        )
    
    return [_build_material_response(m) for m in materials]


@router.post("/{material_id}/podcast/generate-script")
async def generate_podcast_script(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_plan("student")),
):
    """Generate and persist a podcast script for a material."""
    result = await db.execute(
        select(Material).where(
            Material.id == material_id,
            Material.user_id == current_user.id,
            Material.deleted_at.is_(None),
        )
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    if not material.full_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Material text is not available yet",
        )

    from app.domain.services.podcast_service import PodcastService

    service = PodcastService()
    try:
        script = await service.generate_podcast_script(material)
    except Exception as exc:
        logger.exception("Failed to generate podcast script for material %s", material_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate podcast script: {exc}",
        ) from exc

    material.podcast_script = script

    # Record podcast usage (skip when billing bypass is on)
    from app.core.config import settings as _podcast_settings
    if not _podcast_settings.BILLING_BYPASS:
        from app.domain.services.usage_tracking_service import record_usage as _record_podcast_usage
        await _record_podcast_usage(current_user.id, "podcast_generation", 1, db)

    await db.commit()
    await db.refresh(material)

    return {"podcast_script": script}


@router.post("/{material_id}/podcast/generate-audio")
async def generate_podcast_audio(
    material_id: UUID,
    tts_provider: str = "edge",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_plan("student")),
):
    """Generate podcast audio for an existing podcast script."""
    result = await db.execute(
        select(Material).where(
            Material.id == material_id,
            Material.user_id == current_user.id,
            Material.deleted_at.is_(None),
        )
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    if not material.podcast_script:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast script has not been generated yet",
        )

    from app.domain.services.podcast_service import PodcastService

    service = PodcastService()
    podcasts_dir = os.path.join("storage", "podcasts", str(current_user.id))
    os.makedirs(podcasts_dir, exist_ok=True)
    filename = f"{material.id}.mp3"
    storage_path = os.path.join(podcasts_dir, filename)
    public_url = f"/storage/podcasts/{current_user.id}/{filename}"

    try:
        if tts_provider == "elevenlabs":
            await service.generate_podcast_audio(material.podcast_script, storage_path)
            provider = "elevenlabs"
        else:
            await service.generate_podcast_audio_edge_tts(
                material.podcast_script,
                storage_path,
                language="auto",
            )
            provider = "edge"
    except Exception as exc:
        logger.exception("Failed to generate podcast audio for material %s", material_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate podcast audio: {exc}",
        ) from exc

    material.podcast_audio_url = public_url
    await db.commit()
    await db.refresh(material)

    return {
        "podcast_audio_url": public_url,
        "provider": provider,
        "message": "Podcast generated successfully",
    }


@router.post("/{material_id}/presentation/generate")
async def generate_presentation(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_plan("student")),
):
    """Generate and persist a presentation for a material."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Material)
        .options(selectinload(Material.summary))
        .where(
            Material.id == material_id,
            Material.user_id == current_user.id,
            Material.deleted_at.is_(None),
        )
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    material.presentation_status = "generating"
    await db.commit()

    from app.domain.services.presentation_service import PresentationService

    service = PresentationService()
    summary_text = material.summary.summary if material.summary else None

    try:
        presentation_data = await service.generate_presentation(material, summary_text)
        material.presentation_status = "completed"
        material.presentation_url = presentation_data["url"]
        material.presentation_embed_url = presentation_data.get("embed_url")
        await db.commit()
        await db.refresh(material)
    except Exception as exc:
        material.presentation_status = "failed"
        await db.commit()
        logger.exception("Failed to generate presentation for material %s", material_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presentation: {exc}",
        ) from exc

    return {
        "presentation_url": material.presentation_url,
        "presentation_embed_url": material.presentation_embed_url,
        "presentation_status": material.presentation_status,
    }


# ============== Project Content Endpoints ==============

@router.get("/projects/{project_id}/content", response_model=ProjectContentResponse)
async def get_project_content(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get AI-generated content for a project (summary, notes, flashcards, quiz).

    Content is generated from all materials in the project combined.
    """
    result = await db.execute(
        select(ProjectContent)
        .where(ProjectContent.project_id == project_id)
    )
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project content not found. Wait for processing to complete."
        )

    return ProjectContentResponse(
        id=content.id,
        project_id=content.project_id,
        summary=content.summary,
        notes=content.notes,
        flashcards=content.flashcards,
        quiz=content.quiz,
        processing_status=content.processing_status,
        processing_progress=content.processing_progress,
        total_materials=content.total_materials,
        created_at=content.created_at,
        updated_at=content.updated_at,
    )


@router.get("/{material_id}/content", response_model=MaterialContentResponse)
async def get_material_content(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get AI-generated content for a single material (summary, notes, flashcards, quiz).
    """
    from sqlalchemy.orm import selectinload
    
    # Get material with all relationships
    result = await db.execute(
        select(Material)
        .options(
            selectinload(Material.summary),
            selectinload(Material.notes),
            selectinload(Material.flashcards),
            selectinload(Material.quiz_questions),
        )
        .where(Material.id == material_id)
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found"
        )

    # Check ownership
    if material.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Build response
    summary_text = material.summary.summary if material.summary else None
    notes_text = material.notes.notes if material.notes else None
    flashcards_list = [
        {"question": fc.question, "answer": fc.answer}
        for fc in material.flashcards
    ] if material.flashcards else []

    quiz_list = [
        {
            "question": q.question,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "correct_option": q.correct_option,
        }
        for q in material.quiz_questions
    ] if material.quiz_questions else []

    if not any([summary_text, notes_text, flashcards_list, quiz_list]) and material.project_id:
        material_count_result = await db.execute(
            select(func.count(Material.id))
            .where(
                Material.project_id == material.project_id,
                Material.deleted_at.is_(None),
            )
        )
        material_count = material_count_result.scalar_one()

        if material_count == 1:
            project_content_result = await db.execute(
                select(ProjectContent).where(ProjectContent.project_id == material.project_id)
            )
            project_content = project_content_result.scalar_one_or_none()
            if project_content and project_content.processing_status == ProcessingStatus.COMPLETED:
                summary_text = project_content.summary
                notes_text = project_content.notes
                flashcards_list = project_content.flashcards or []
                quiz_list = project_content.quiz or []

    return MaterialContentResponse(
        id=material.id,
        material_id=material.id,
        title=material.title,
        summary=summary_text,
        notes=notes_text,
        flashcards=flashcards_list,
        quiz=quiz_list,
        processing_status=material.processing_status.value,
        type=material.type.value if hasattr(material.type, 'value') else str(material.type),
    )


@router.post("/projects/{project_id}/content/regenerate")
async def regenerate_project_content(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Regenerate AI content for a project.
    
    This will re-process all materials and generate new content.
    """
    # Check if project content exists
    result = await db.execute(
        select(ProjectContent)
        .where(ProjectContent.project_id == project_id)
    )
    content = result.scalar_one_or_none()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project content not found"
        )
    
    # Get all materials for this project
    materials_result = await db.execute(
        select(Material)
        .where(
            Material.project_id == project_id,
            Material.user_id == current_user.id,
            Material.deleted_at.is_(None),
        )
    )
    materials = materials_result.scalars().all()
    
    if not materials:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No materials found in this project"
        )
    
    # Update status to queued
    content.processing_status = ProcessingStatus.QUEUED
    content.processing_progress = 0
    await db.commit()
    
    # Queue Celery task
    material_ids = [str(m.id) for m in materials]
    process_material_batch_task.delay(
        batch_id=content.id,  # Reuse content ID as batch_id for regeneration
        material_ids=material_ids,
        user_id=str(current_user.id),
    )
    
    return {
        "status": "queued",
        "message": "Content regeneration started",
        "project_id": str(project_id),
    }


# ============================================================================
# TUTOR CHAT ENDPOINTS
# ============================================================================

from app.schemas.material import (
    TutorMessageRequest,
    TutorMessageResponse,
    TutorChatHistoryResponse,
)
from app.schemas.common import MessageResponse
from app.domain.services.tutor_service import TutorService
from sqlalchemy import func
from app.infrastructure.database.models.project import Project


def _raise_tutor_unavailable(exc: Exception) -> None:
    logger.error("[TutorAPI] Tutor request failed: %s", exc, exc_info=True)
    detail = "AI tutor is temporarily unavailable"
    if isinstance(exc, RetryError) or "RateLimitError" in str(exc) or "insufficient_quota" in str(exc):
        detail = "AI tutor is temporarily unavailable: OpenAI quota exceeded"
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    ) from exc


@router.post("/{material_id}/tutor", response_model=TutorMessageResponse)
async def send_tutor_message(
    material_id: UUID,
    message_data: TutorMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_quota("chat_message")),
):
    """
    Send a message to the AI tutor for this material.

    Args:
        material_id: Material ID
        message_data: Message data
        db: Database session
        current_user: Current authenticated user

    Returns:
        TutorMessageResponse: AI tutor response
    """
    # Verify material ownership
    result = await db.execute(
        select(Material).where(Material.id == material_id)
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found"
        )

    if material.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    if material.processing_status != ProcessingStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Material is still being processed"
        )

    # Use TutorService to generate response
    tutor_service = TutorService(db)
    try:
        await tutor_service.send_message(
            material_id=material_id,
            user_message=message_data.message,
            context=message_data.context
        )
    except Exception as exc:
        _raise_tutor_unavailable(exc)

    # Record chat usage (skip when billing bypass is on)
    from app.core.config import settings as _app_settings
    if not _app_settings.BILLING_BYPASS:
        from app.domain.services.usage_tracking_service import record_usage as _record_chat_usage
        await _record_chat_usage(current_user.id, "chat_message", 1, db)
        await db.commit()

    # Get the last AI message from DB
    result = await db.execute(
        select(TutorMessage)
        .where(TutorMessage.material_id == material_id)
        .where(TutorMessage.role == "assistant")
        .order_by(TutorMessage.created_at.desc())
        .limit(1)
    )
    ai_message = result.scalar_one()

    return ai_message


@router.post("/{material_id}/tutor/{message_id}/speak")
async def speak_tutor_message(
    material_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate TTS audio for a stored tutor message."""
    from app.infrastructure.ai.ai_tts_service import AITTSService

    material_result = await db.execute(
        select(Material).where(Material.id == material_id)
    )
    material = material_result.scalar_one_or_none()
    if not material or material.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    message_result = await db.execute(
        select(TutorMessage)
        .where(TutorMessage.id == message_id)
        .where(TutorMessage.material_id == material_id)
    )
    message = message_result.scalar_one_or_none()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tutor message not found",
        )

    if not message.content or not message.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tutor message has no content to synthesize",
        )

    tts_service = AITTSService()
    audio_path = await tts_service.text_to_speech(message.content)
    if not audio_path:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate audio",
        )

    audio_name = Path(audio_path).name
    if not audio_name.startswith("tts_"):
        audio_name = f"tts_{message_id.hex[:12]}.mp3"

    return {
        "message_id": message.id,
        "audio_url": f"/storage/tts_audio/{audio_name}",
    }


# ============================================================================
# PROJECT-LEVEL TUTOR CHAT ENDPOINTS
# ============================================================================

@router.post("/projects/{project_id}/tutor", response_model=ProjectTutorMessageResponse)
async def send_project_tutor_message(
    project_id: UUID,
    message_data: TutorMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message to the AI tutor for ALL materials in a project.

    Uses RAG across all materials in the project to provide comprehensive answers.

    Args:
        project_id: Project ID
        message_data: Message data
        db: Database session
        current_user: Current authenticated user

    Returns:
        TutorMessageResponse: AI tutor response
    """
    from app.infrastructure.database.models.project import Project

    # Verify project ownership
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get all completed materials in the project
    materials_result = await db.execute(
        select(Material).where(
            Material.project_id == project_id,
            Material.processing_status == ProcessingStatus.COMPLETED
        )
    )
    materials = materials_result.scalars().all()

    if not materials:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No completed materials in this project"
        )

    # Create custom TutorService that searches across all materials
    tutor_service = TutorService(db)
    try:
        await tutor_service.send_message_project_wide(
            project_id=project_id,
            material_ids=[m.id for m in materials],
            user_message=message_data.message,
            context=message_data.context
        )
    except Exception as exc:
        _raise_tutor_unavailable(exc)

    # Get the last AI message from project tutor messages
    result = await db.execute(
        select(ProjectTutorMessage)
        .where(ProjectTutorMessage.project_id == project_id)
        .where(ProjectTutorMessage.role == "assistant")
        .order_by(ProjectTutorMessage.created_at.desc())
        .limit(1)
    )
    ai_message = result.scalar_one()

    return ai_message


@router.post("/projects/{project_id}/tutor/{message_id}/speak")
async def speak_project_tutor_message(
    project_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate TTS audio for a stored project tutor message."""
    from app.infrastructure.ai.ai_tts_service import AITTSService

    project_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    message_result = await db.execute(
        select(ProjectTutorMessage)
        .where(ProjectTutorMessage.id == message_id)
        .where(ProjectTutorMessage.project_id == project_id)
    )
    message = message_result.scalar_one_or_none()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tutor message not found",
        )

    if not message.content or not message.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tutor message has no content to synthesize",
        )

    tts_service = AITTSService()
    audio_path = await tts_service.text_to_speech(message.content)
    if not audio_path:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate audio",
        )

    audio_name = Path(audio_path).name
    if not audio_name.startswith("tts_"):
        audio_name = f"tts_{message_id.hex[:12]}.mp3"

    return {
        "message_id": message.id,
        "audio_url": f"/storage/tts_audio/{audio_name}",
    }


@router.get("/projects/{project_id}/tutor/history", response_model=ProjectTutorChatHistoryResponse)
async def get_project_tutor_history(
    project_id: UUID,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get tutor chat history for a project (all materials).
    """
    from app.infrastructure.database.models.project import Project

    # Verify project ownership
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get messages from project tutor messages table
    messages_result = await db.execute(
        select(ProjectTutorMessage)
        .where(ProjectTutorMessage.project_id == project_id)
        .order_by(ProjectTutorMessage.created_at.asc())
        .limit(limit)
    )
    messages = messages_result.scalars().all()

    return {"messages": messages, "total": len(messages)}


# ============================================================================
# MATERIAL-LEVEL TUTOR CHAT ENDPOINTS
# ============================================================================

@router.get("/{material_id}/tutor/history", response_model=TutorChatHistoryResponse)
async def get_tutor_history(
    material_id: UUID,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get tutor chat history for material.

    Args:
        material_id: Material ID
        limit: Maximum number of messages to return
        db: Database session
        current_user: Current authenticated user

    Returns:
        TutorChatHistoryResponse: Chat history

    Raises:
        HTTPException: If material not found or access denied
    """
    # Verify material ownership
    result = await db.execute(
        select(Material).where(Material.id == material_id)
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found"
        )

    if material.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get messages
    tutor_service = TutorService(db)
    messages = await tutor_service.get_history(material_id, limit)

    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(TutorMessage).where(TutorMessage.material_id == material_id)
    )
    total = count_result.scalar()

    return {"messages": messages, "total": total}


@router.delete("/{material_id}/tutor/history", response_model=MessageResponse)
async def clear_tutor_history(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clear all tutor chat history for a material.

    Args:
        material_id: Material ID
        db: Database session
        current_user: Current authenticated user

    Returns:
        MessageResponse: Success message

    Raises:
        HTTPException: If material not found or access denied
    """
    # Verify material ownership
    result = await db.execute(
        select(Material).where(Material.id == material_id)
    )
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found"
        )

    if material.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Clear history
    tutor_service = TutorService(db)
    await tutor_service.clear_history(material_id)

    return {"message": "Chat history cleared successfully"}


@router.get("/{material_id}/processing-status", response_model=dict)
async def get_material_processing_status(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the processing status and progress for a material.

    This endpoint is used by the frontend to show real-time progress
    during material processing with fake progress smoothing.

    Args:
        material_id: Material UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        dict: Processing status with progress percentage and stage info

    Raises:
        HTTPException: If material not found or access denied
    """
    # Verify material ownership and load relationships
    result = await db.execute(
        select(Material)
        .options(
            selectinload(Material.flashcards),
        )
        .where(Material.id == material_id)
    )
    material = result.unique().scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found"
        )

    if material.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Map processing status to stage information
    stage_mapping = {
        ProcessingStatus.QUEUED: {
            "stage": 0,
            "stage_key": "queued",
            "stage_text": "Waiting to start processing...",
        },
        ProcessingStatus.PROCESSING: {
            "stage": min(max(material.processing_progress // 14, 1), 6),
            "stage_key": "processing",
            "stage_text": "Processing content...",
        },
        ProcessingStatus.COMPLETED: {
            "stage": 7,
            "stage_key": "complete",
            "stage_text": "Processing complete!",
        },
        ProcessingStatus.FAILED: {
            "stage": -1,
            "stage_key": "failed",
            "stage_text": "Processing failed",
        },
    }
    
    stage_info = stage_mapping.get(material.processing_status, stage_mapping[ProcessingStatus.QUEUED])

    return {
        "material_id": str(material.id),
        "status": material.processing_status.value,
        "progress": material.processing_progress or 0,
        "error": material.processing_error,
        "stage": stage_info["stage"],
        "stage_key": stage_info["stage_key"],
        "stage_text": stage_info["stage_text"],
        "has_summary": material.full_text is not None,
        "has_flashcards": hasattr(material, 'flashcards') and bool(material.flashcards),
        "has_quiz": hasattr(material, 'quizzes') and bool(material.quizzes),
    }
