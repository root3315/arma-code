"""
Celery tasks для фоновой обработки
"""
import logging
from uuid import UUID
from typing import Optional, List

from celery import Task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.infrastructure.queue.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)

# Async database session для tasks
# Using proper connection pool (pool_size=5) for better performance
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
)
AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


class DatabaseTask(Task):
    """
    Base task с автоматическим управлением database session
    """
    _session = None

    async def get_session(self):
        """Get async database session."""
        return AsyncSessionLocal()


@celery_app.task(bind=True, base=DatabaseTask, name="process_material")
def process_material_task(
    self,
    material_id: str,
    material_type: str,
    file_path: Optional[str] = None,
    source: Optional[str] = None,
) -> dict:
    """
    Фоновая задача для обработки материала (PDF или YouTube).

    Args:
        material_id: UUID материала
        material_type: Тип материала ('pdf' или 'youtube')
        file_path: Путь к файлу (для PDF)
        source: YouTube URL (для YouTube)

    Returns:
        dict с результатом обработки

    Process:
        1. Извлечение текста (PDF parsing / YouTube transcription)
        2. Нормализация текста
        3. Генерация AI контента (summary, notes, flashcards, quiz)
        4. Создание embeddings для RAG
        5. Обновление статуса материала
    """
    import asyncio
    from app.domain.services.material_processing_service import MaterialProcessingService
    from app.infrastructure.database.models.material import Material, ProcessingStatus
    from app.infrastructure.utils.text_extraction import (
        extract_text_from_pdf,
        extract_text_from_youtube,
        normalize_text
    )
    from sqlalchemy import select, update

    logger.info(f"[process_material_task] Starting processing for material {material_id}")
    logger.info(f"[process_material_task] Parameters: material_type={material_type}, file_path={file_path}, source={source}")

    # Используем словарь для хранения контекста, чтобы избежать UnboundLocalError
    # с file_path во вложенной функции
    task_context = {"file_path": file_path}

    async def async_process():
        async with AsyncSessionLocal() as session:
            try:
                material_uuid = UUID(material_id)

                # Update status to processing
                await session.execute(
                    update(Material)
                    .where(Material.id == material_uuid)
                    .values(processing_status=ProcessingStatus.PROCESSING, processing_progress=10)
                )
                await session.commit()
                logger.info(f"[process_material_task] Status updated to PROCESSING")

                # Step 1: Extract text
                full_text = None
                if material_type.lower() == "youtube":
                    logger.info(f"[process_material_task] Extracting text from YouTube: {source}")
                    full_text = extract_text_from_youtube(source)
                else:
                    # Handle file-based materials (PDF, DOCX, TXT, etc.)
                    # Получаем текущий путь из контекста
                    current_path = task_context["file_path"]

                    # Проверка пути файла
                    import os
                    if current_path and not os.path.exists(current_path):
                        # Если путь относительный (storage/...), попробуем найти его
                        if not current_path.startswith('/'):
                            # Try /app/storage first (Docker)
                            docker_path = os.path.join('/app', current_path)
                            if os.path.exists(docker_path):
                                logger.info(f"[process_material_task] Resolved path in Docker: {docker_path}")
                                task_context["file_path"] = docker_path
                                current_path = docker_path
                            else:
                                # Try backend directory (local development)
                                import sys
                                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                                local_path = os.path.join(backend_dir, current_path)
                                if os.path.exists(local_path):
                                    logger.info(f"[process_material_task] Resolved path locally: {local_path}")
                                    task_context["file_path"] = local_path
                                    current_path = local_path
                                else:
                                    logger.error(f"[process_material_task] File not found at: {local_path}")
                                    raise FileNotFoundError(f"File not found: {current_path}")

                    # Article type is stored as HTML, so use HTML extractor
                    extract_type = "html" if material_type.lower() == "article" else material_type
                    logger.info(f"[process_material_task] Extracting text from {material_type.upper()} (as {extract_type.upper()}): {current_path}")

                    # Use universal extractor
                    from app.infrastructure.utils.text_extraction import extract_text_from_document
                    full_text = extract_text_from_document(current_path, extract_type)

                # Normalize text
                full_text = normalize_text(full_text)
                logger.info(f"[process_material_task] Extracted {len(full_text)} characters")

                # Update progress
                await session.execute(
                    update(Material)
                    .where(Material.id == material_uuid)
                    .values(full_text=full_text, processing_progress=30)
                )
                await session.commit()

                # Step 2: Process material with AI
                logger.info(f"[process_material_task] Starting AI processing")
                processing_service = MaterialProcessingService(session)
                await processing_service.process_material(material_uuid, full_text)

                # Step 3: Mark as completed
                await session.execute(
                    update(Material)
                    .where(Material.id == material_uuid)
                    .values(processing_status=ProcessingStatus.COMPLETED, processing_progress=100)
                )
                await session.commit()

                logger.info(f"[process_material_task] Completed processing for material {material_id}")
                return {"status": "success", "material_id": material_id}

            except Exception as e:
                logger.error(f"[process_material_task] Error: {str(e)}", exc_info=True)

                # Update status to failed
                try:
                    await session.execute(
                        update(Material)
                        .where(Material.id == UUID(material_id))
                        .values(
                            processing_status=ProcessingStatus.FAILED,
                            processing_error=str(e)
                        )
                    )
                    await session.commit()
                except Exception as update_error:
                    logger.error(f"[process_material_task] Failed to update error status: {str(update_error)}")

                raise

    # Run async function in a new event loop
    # This is necessary because Celery runs in a sync context
    import nest_asyncio
    try:
        nest_asyncio.apply()
    except:
        pass
    
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Create new loop if current one is running
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            return new_loop.run_until_complete(async_process())
        else:
            return loop.run_until_complete(async_process())
    except RuntimeError:
        # No event loop exists, create new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(async_process())


@celery_app.task(bind=True, base=DatabaseTask, name="generate_podcast")
def generate_podcast_task(self, material_id: str, user_id: str) -> dict:
    """
    Генерация podcast для материала.

    Args:
        material_id: UUID материала
        user_id: UUID пользователя

    Returns:
        dict с URL podcast
    """
    import asyncio
    from app.domain.services.podcast_service import PodcastService

    logger.info(f"[generate_podcast] Starting for material {material_id}")

    async def async_generate():
        async with AsyncSessionLocal() as session:
            service = PodcastService(session)

            try:
                result = await service.generate_podcast(UUID(material_id))
                logger.info(f"[generate_podcast] Completed for material {material_id}")
                return result

            except Exception as e:
                logger.error(f"[generate_podcast] Error: {str(e)}")
                raise

    # Bug fix #2.4: Handle event loop properly
    try:
        loop = asyncio.get_running_loop()
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        return new_loop.run_until_complete(async_generate())
    except RuntimeError:
        return asyncio.run(async_generate())


@celery_app.task(bind=True, base=DatabaseTask, name="generate_presentation")
def generate_presentation_task(self, material_id: str, user_id: str) -> dict:
    """
    Генерация presentation для материала.

    Args:
        material_id: UUID материала
        user_id: UUID пользователя

    Returns:
        dict с URL presentation
    """
    import asyncio
    from app.domain.services.presentation_service import PresentationService

    logger.info(f"[generate_presentation] Starting for material {material_id}")

    async def async_generate():
        async with AsyncSessionLocal() as session:
            service = PresentationService(session)

            try:
                result = await service.generate_presentation(UUID(material_id))
                logger.info(f"[generate_presentation] Completed for material {material_id}")
                return result

            except Exception as e:
                logger.error(f"[generate_presentation] Error: {str(e)}")
                raise

    # Bug fix #2.4: Handle event loop properly
    try:
        loop = asyncio.get_running_loop()
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        return new_loop.run_until_complete(async_generate())
    except RuntimeError:
        return asyncio.run(async_generate())


@celery_app.task(name="cleanup_old_attempts")
def cleanup_old_attempts_task() -> dict:
    """
    Периодическая задача для очистки старых quiz attempts (опционально).

    Returns:
        dict с количеством удаленных записей
    """
    import asyncio
    from datetime import datetime, timezone, timedelta

    logger.info("[cleanup_old_attempts] Starting cleanup")

    async def async_cleanup():
        async with AsyncSessionLocal() as session:
            # Удалить attempts старше 90 дней
            cutoff_date = datetime.utcnow() - timedelta(days=90)

            # TODO: Implement cleanup logic
            # deleted_count = await repository.delete_old_attempts(cutoff_date)

            logger.info(f"[cleanup_old_attempts] Completed")
            return {"deleted_count": 0}

    # Bug fix #2.4: Handle event loop properly
    try:
        loop = asyncio.get_running_loop()
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        return new_loop.run_until_complete(async_cleanup())
    except RuntimeError:
        return asyncio.run(async_cleanup())


# ============== Batch Processing Tasks ==============

@celery_app.task(bind=True, base=DatabaseTask, name="process_material_batch")
def process_material_batch_task(
    self,
    batch_id: str,
    material_ids: List[str],
    user_id: str,
) -> dict:
    """
    Process a batch of materials together.
    
    Steps:
    1. Process each material individually (extract text)
    2. Combine all extracted text
    3. Generate AI content from combined text (summary, notes, flashcards, quiz)
    4. Save to ProjectContent
    5. Update all material statuses to COMPLETED
    
    Args:
        batch_id: Batch UUID
        material_ids: List of material UUIDs
        user_id: User UUID
    
    Returns:
        dict with processing result
    """
    import asyncio
    import os
    from uuid import UUID
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.infrastructure.database.models.material import (
        Material,
        MaterialType,
        ProcessingStatus,
        ProjectContent,
    )
    from app.infrastructure.utils.text_extraction import (
        extract_text_from_document,
        extract_text_from_youtube,
        normalize_text,
    )
    from app.domain.services.material_processing_service import MaterialProcessingService
    from app.core.config import settings
    
    logger.info(f"[process_material_batch] Starting batch {batch_id} with {len(material_ids)} materials")
    
    async def async_process_batch():
        async with AsyncSessionLocal() as session:
            try:
                batch_uuid = UUID(batch_id)
                user_uuid = UUID(user_id)
                
                # Get all materials
                result = await session.execute(
                    select(Material).where(Material.id.in_([UUID(mid) for mid in material_ids]))
                )
                materials = result.scalars().all()
                
                if not materials:
                    raise ValueError(f"No materials found for batch {batch_id}")
                
                # Update ProjectContent status
                project_content_result = await session.execute(
                    select(ProjectContent).where(ProjectContent.project_id == materials[0].project_id)
                )
                project_content = project_content_result.scalar_one_or_none()
                
                if project_content:
                    project_content.processing_status = ProcessingStatus.PROCESSING
                    project_content.processing_progress = 10
                    await session.commit()
                
                # Step 1: Process each material (extract text)
                logger.info(f"[process_material_batch] Extracting text from {len(materials)} materials")
                all_texts = []
                extracted_materials: List[tuple[UUID, str]] = []
                
                for i, material in enumerate(materials):
                    try:
                        logger.info(f"[process_material_batch] Processing material {i+1}/{len(materials)}: {material.id}")
                        
                        # Update individual material status
                        await session.execute(
                            update(Material)
                            .where(Material.id == material.id)
                            .values(processing_status=ProcessingStatus.PROCESSING, processing_progress=20)
                        )
                        await session.commit()
                        
                        full_text = None
                        
                        if material.type == MaterialType.YOUTUBE and material.source:
                            # Extract from YouTube
                            logger.info(f"[process_material_batch] Extracting from YouTube: {material.source}")
                            full_text = extract_text_from_youtube(material.source)
                        
                        elif material.type in [MaterialType.PDF, MaterialType.DOCX, MaterialType.DOC, 
                                              MaterialType.TXT, MaterialType.MD, MaterialType.HTML, 
                                              MaterialType.RTF, MaterialType.ODT, MaterialType.EPUB]:
                            # Extract from file
                            file_path = material.file_path
                            if file_path:
                                # Resolve file path (try different locations)
                                if not os.path.exists(file_path):
                                    # Try /app/storage (Docker)
                                    docker_path = os.path.join("/app", file_path)
                                    if os.path.exists(docker_path):
                                        file_path = docker_path
                                    else:
                                        # Try backend directory
                                        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                                        local_path = os.path.join(backend_dir, file_path)
                                        if os.path.exists(local_path):
                                            file_path = local_path
                                
                                logger.info(f"[process_material_batch] Extracting from file: {file_path}")
                                extract_type = "html" if material.type == MaterialType.ARTICLE else material.type.value
                                full_text = extract_text_from_document(file_path, extract_type)
                        
                        elif material.type == MaterialType.ARTICLE and material.source:
                            logger.info(f"[process_material_batch] Article from URL: {material.source}")
                            import httpx
                            from bs4 import BeautifulSoup

                            async with httpx.AsyncClient(
                                timeout=httpx.Timeout(20.0, connect=10.0),
                                follow_redirects=True,
                            ) as client:
                                response = await client.get(
                                    material.source,
                                    headers={
                                        "User-Agent": (
                                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                                            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                                        )
                                    },
                                )
                                response.raise_for_status()

                            soup = BeautifulSoup(response.text, "html.parser")
                            for tag in soup(["script", "style", "noscript"]):
                                tag.decompose()

                            title = soup.title.string.strip() if soup.title and soup.title.string else ""
                            article_text = soup.get_text(separator="\n\n", strip=True)
                            full_text = "\n\n".join(part for part in [title, article_text] if part).strip()
                        
                        if full_text:
                            full_text = normalize_text(full_text)
                            all_texts.append(full_text)
                            extracted_materials.append((material.id, full_text))
                            
                            # Update material with extracted text
                            await session.execute(
                                update(Material)
                                .where(Material.id == material.id)
                                .values(
                                    full_text=full_text,
                                    processing_status=ProcessingStatus.PROCESSING,
                                    processing_progress=50
                                )
                            )
                            await session.commit()
                            
                            logger.info(f"[process_material_batch] Extracted {len(full_text)} chars from {material.id}")
                        else:
                            logger.warning(f"[process_material_batch] No text extracted from {material.id}")
                            await session.execute(
                                update(Material)
                                .where(Material.id == material.id)
                                .values(
                                    processing_status=ProcessingStatus.FAILED,
                                    processing_error="No text could be extracted"
                                )
                            )
                            await session.commit()
                    
                    except Exception as e:
                        logger.error(f"[process_material_batch] Error processing {material.id}: {str(e)}")
                        await session.execute(
                            update(Material)
                            .where(Material.id == material.id)
                            .values(
                                processing_status=ProcessingStatus.FAILED,
                                processing_error=str(e)
                            )
                        )
                        await session.commit()
                
                # Step 2: Combine all texts
                combined_text = "\n\n---\n\n".join(all_texts)
                logger.info(f"[process_material_batch] Combined text length: {len(combined_text)} chars")
                
                if not combined_text or len(combined_text.strip()) == 0:
                    raise ValueError("No text could be extracted from any material")
                
                # Update ProjectContent progress
                if project_content:
                    project_content.processing_progress = 60
                    await session.commit()
                
                # Step 4: Generate AI content from combined text
                logger.info(f"[process_material_batch] Generating AI content")

                processing_service = MaterialProcessingService(session)

                # Generate content in parallel
                import asyncio
                results = await asyncio.gather(
                    processing_service.ai_service.generate_summary(combined_text),
                    processing_service.ai_service.generate_notes(combined_text),
                    processing_service.ai_service.generate_flashcards(combined_text, count=20),
                    processing_service.ai_service.generate_quiz(combined_text, count=15),
                    return_exceptions=True,
                )

                summary_text, notes_text, flashcards_data, quiz_data = results

                # Check for errors
                for name, result in [("summary", summary_text), ("notes", notes_text),
                                    ("flashcards", flashcards_data), ("quiz", quiz_data)]:
                    if isinstance(result, Exception):
                        logger.error(f"[process_material_batch] AI generation failed: {name}")
                        raise result

                # Step 5: Save to ProjectContent
                logger.info(f"[process_material_batch] Saving project content")

                if project_content:
                    project_content.summary = summary_text
                    project_content.notes = notes_text
                    project_content.flashcards = flashcards_data
                    project_content.quiz = quiz_data
                    project_content.processing_status = ProcessingStatus.COMPLETED
                    project_content.processing_progress = 100
                    await session.commit()

                if len(extracted_materials) == 1:
                    material_id, _ = extracted_materials[0]
                    await processing_service._save_all_results(
                        material_id,
                        summary_text,
                        notes_text,
                        flashcards_data,
                        quiz_data,
                    )

                # Step 6: Create embeddings for each material (for RAG)
                logger.info(f"[process_material_batch] Creating embeddings for RAG")
                for material in materials:
                    if material.processing_status != ProcessingStatus.FAILED and material.full_text:
                        try:
                            logger.info(f"[process_material_batch] Creating embeddings for {material.id}")
                            await processing_service._create_embeddings(material.id, material.full_text)
                        except Exception as e:
                            logger.error(f"[process_material_batch] Failed to create embeddings for {material.id}: {str(e)}")

                # Update all materials to completed
                for material in materials:
                    if material.processing_status != ProcessingStatus.FAILED:
                        await session.execute(
                            update(Material)
                            .where(Material.id == material.id)
                            .values(processing_status=ProcessingStatus.COMPLETED, processing_progress=100)
                        )

                await session.commit()
                
                logger.info(f"[process_material_batch] Batch {batch_id} completed successfully")
                
                return {
                    "status": "success",
                    "batch_id": batch_id,
                    "materials_processed": len(materials),
                    "combined_text_length": len(combined_text),
                }
                
            except Exception as e:
                logger.error(f"[process_material_batch] Batch {batch_id} failed: {str(e)}", exc_info=True)
                
                # Update ProjectContent status
                try:
                    if project_content:
                        project_content.processing_status = ProcessingStatus.FAILED
                        project_content.processing_error = str(e)
                        await session.commit()

                    if "materials" in locals():
                        for material in materials:
                            if material.processing_status != ProcessingStatus.FAILED:
                                await session.execute(
                                    update(Material)
                                    .where(Material.id == material.id)
                                    .values(
                                        processing_status=ProcessingStatus.FAILED,
                                        processing_error=str(e),
                                    )
                                )
                        await session.commit()
                except Exception as update_error:
                    logger.error(f"[process_material_batch] Failed to update error status: {str(update_error)}")
                
                return {
                    "status": "failed",
                    "batch_id": batch_id,
                    "error": str(e),
                }
    
    # Run async function
    import nest_asyncio
    try:
        nest_asyncio.apply()
    except:
        pass
    
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            return new_loop.run_until_complete(async_process_batch())
        else:
            return loop.run_until_complete(async_process_batch())
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(async_process_batch())
