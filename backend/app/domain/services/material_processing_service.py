"""
Service для обработки материалов (PDF/YouTube) и генерации AI контента
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.infrastructure.database.models.material import (
    Material,
    MaterialSummary,
    MaterialNotes,
    ProcessingStatus,
)
from app.infrastructure.database.models.quiz import QuizQuestion
from app.infrastructure.database.models.flashcard import Flashcard
from app.infrastructure.database.models.embedding import MaterialEmbedding
from app.infrastructure.ai.openai_service import OpenAIService
from app.core.config import settings

logger = logging.getLogger(__name__)


class MaterialProcessingService:
    """
    Сервис для обработки материалов и генерации AI контента.

    Этапы обработки:
    1. Параллельная генерация AI контента (summary, notes, flashcards, quiz)
    2. Atomic сохранение всех результатов в одной транзакции
    3. Создание векторных embeddings для RAG
    4. Завершение обработки
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_service = OpenAIService()

    async def process_material(self, material_id: UUID, full_text: str) -> None:
        """
        Основная функция обработки материала.

        Args:
            material_id: ID материала
            full_text: Извлеченный текст из PDF/YouTube

        Steps:
            1. Update status to PROCESSING
            2. Generate summary, notes, flashcards, quiz IN PARALLEL
            3. Save all results in ONE atomic transaction
            4. Create embeddings
            5. Update status to COMPLETED
        """
        try:
            # 1. Параллельная генерация AI контента
            logger.info(
                "Starting parallel AI generation",
                extra={"material_id": str(material_id)}
            )
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 35)

            results = await asyncio.gather(
                self.ai_service.generate_summary(full_text),
                self.ai_service.generate_notes(full_text),
                self.ai_service.generate_flashcards(full_text, count=15),
                self.ai_service.generate_quiz(full_text, count=10),
                return_exceptions=True,
            )

            summary_text, notes_text, flashcards_data, quiz_data = results

            # Проверить на ошибки
            for name, result in [
                ("summary", summary_text),
                ("notes", notes_text),
                ("flashcards", flashcards_data),
                ("quiz", quiz_data),
            ]:
                if isinstance(result, Exception):
                    logger.error(
                        "AI generation failed",
                        extra={"stage": name, "error": str(result), "material_id": str(material_id)}
                    )
                    raise result

            # 2. Атомарное сохранение всех результатов в ОДНОЙ транзакции
            logger.info("Saving all AI results atomically", extra={"material_id": str(material_id)})
            await self._save_all_results(
                material_id, summary_text, notes_text, flashcards_data, quiz_data
            )
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 85)

            # 3. Создание embeddings
            logger.info("Creating embeddings", extra={"material_id": str(material_id)})
            await self._create_embeddings(material_id, full_text)
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 95)

            # 4. Завершено
            await self._update_processing_status(material_id, ProcessingStatus.COMPLETED, 100)
            logger.info("Processing completed", extra={"material_id": str(material_id)})

        except Exception as e:
            logger.error(
                "Processing failed",
                extra={"material_id": str(material_id), "error": str(e)}
            )
            await self._update_processing_status(material_id, ProcessingStatus.FAILED, 0)
            raise

    async def _save_all_results(
        self,
        material_id: UUID,
        summary_text: str,
        notes_text: str,
        flashcards: List[Dict],
        quiz_questions: List[Dict],
    ) -> None:
        """
        Save all AI-generated content in a SINGLE atomic transaction.

        Using a single begin() block prevents partial saves where, for example,
        summary is saved but flashcards are not (e.g. due to a mid-save error).
        """
        async with self.session.begin():
            # ── Summary ───────────────────────────────────────────────────────
            result = await self.session.execute(
                select(MaterialSummary).where(MaterialSummary.material_id == material_id)
            )
            existing_summary = result.scalar_one_or_none()
            if existing_summary:
                existing_summary.summary = summary_text
            else:
                self.session.add(MaterialSummary(material_id=material_id, summary=summary_text))

            # ── Notes ─────────────────────────────────────────────────────────
            result = await self.session.execute(
                select(MaterialNotes).where(MaterialNotes.material_id == material_id)
            )
            existing_notes = result.scalar_one_or_none()
            if existing_notes:
                existing_notes.notes = notes_text
            else:
                self.session.add(MaterialNotes(material_id=material_id, notes=notes_text))

            # ── Flashcards (replace old ones) ─────────────────────────────────
            await self.session.execute(
                delete(Flashcard).where(Flashcard.material_id == material_id)
            )
            for card in flashcards:
                self.session.add(Flashcard(
                    material_id=material_id,
                    question=card["question"],
                    answer=card["answer"],
                ))

            # ── Quiz questions (replace old ones) ─────────────────────────────
            await self.session.execute(
                delete(QuizQuestion).where(QuizQuestion.material_id == material_id)
            )
            for q in quiz_questions:
                self.session.add(QuizQuestion(
                    material_id=material_id,
                    question=q["question"],
                    option_a=q["option_a"],
                    option_b=q["option_b"],
                    option_c=q["option_c"],
                    option_d=q["option_d"],
                    correct_option=q["correct_option"],
                    explanation=q.get("explanation"),
                ))

        logger.info(
            "Saved all results atomically",
            extra={
                "material_id": str(material_id),
                "flashcards": len(flashcards),
                "quiz_questions": len(quiz_questions),
            }
        )

    async def _update_processing_status(
        self, material_id: UUID, status: ProcessingStatus, progress: int
    ):
        """Обновить статус обработки материала."""
        await self.session.execute(
            update(Material)
            .where(Material.id == material_id)
            .values(processing_status=status, processing_progress=progress)
        )
        await self.session.commit()

    async def _create_embeddings(self, material_id: UUID, full_text: str):
        """
        Создать векторные embeddings для RAG.

        Разбивает текст на семантические чанки и создает embedding для каждого.
        """
        chunks = self._split_into_chunks(full_text, settings.EMBEDDING_CHUNK_SIZE)

        if not chunks:
            logger.warning("No chunks to embed", extra={"material_id": str(material_id)})
            return

        logger.info(
            "Creating embeddings batch",
            extra={"material_id": str(material_id), "chunks": len(chunks)}
        )
        embeddings = await self.ai_service.create_embeddings_batch(chunks)

        # Replace old embeddings atomically
        async with self.session.begin():
            await self.session.execute(
                delete(MaterialEmbedding).where(MaterialEmbedding.material_id == material_id)
            )
            for idx, (chunk_text, embedding_vector) in enumerate(zip(chunks, embeddings)):
                self.session.add(MaterialEmbedding(
                    material_id=material_id,
                    chunk_index=idx,
                    chunk_text=chunk_text,
                    embedding=embedding_vector,
                ))

        logger.info("Embeddings saved", extra={"material_id": str(material_id), "count": len(chunks)})

    def _split_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """
        Split text into semantic chunks for embeddings.

        Strategy:
          1. Split on double newlines (paragraph boundaries) to avoid cutting
             sentences mid-way.
          2. If a paragraph is longer than chunk_size, fall back to
             sentence-boundary splitting.
          3. Merge short adjacent paragraphs to fill chunks efficiently.

        Args:
            text: Full document text
            chunk_size: Target chunk size in characters

        Returns:
            List of non-empty chunk strings
        """
        if not text:
            return []

        # Step 1 – split into paragraphs
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        chunks: List[str] = []
        current_chunk = ""

        for para in paragraphs:
            # If adding this paragraph keeps us within budget → accumulate
            if len(current_chunk) + len(para) + 2 <= chunk_size:
                current_chunk = (current_chunk + "\n\n" + para).lstrip()
            else:
                # Flush current chunk if non-empty
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""

                # Paragraph alone fits → start new chunk
                if len(para) <= chunk_size:
                    current_chunk = para
                else:
                    # Large paragraph — split on sentence boundaries
                    sub_chunks = self._split_by_sentences(para, chunk_size)
                    if sub_chunks:
                        # Last sub-chunk becomes the new current chunk
                        chunks.extend(sub_chunks[:-1])
                        current_chunk = sub_chunks[-1]

        if current_chunk:
            chunks.append(current_chunk)

        logger.debug("Text split into chunks", extra={"chunks": len(chunks)})
        return chunks

    def _split_by_sentences(self, text: str, chunk_size: int) -> List[str]:
        """Split a long paragraph into sentence-boundary-aware chunks."""
        sentence_endings = ".!?\n"
        chunks: List[str] = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + chunk_size
            if end >= text_len:
                chunks.append(text[start:].strip())
                break

            # Walk back from end to find a sentence boundary
            boundary = end
            for i in range(end, max(start + chunk_size // 2, start), -1):
                if text[i] in sentence_endings:
                    boundary = i + 1
                    break

            chunk = text[start:boundary].strip()
            if chunk:
                chunks.append(chunk)
            start = boundary

        return chunks

    # ── Regeneration helpers ─────────────────────────────────────────────────

    async def regenerate_summary(self, material_id: UUID) -> str:
        """Регенерировать summary для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")
        summary_text = await self.ai_service.generate_summary(material.full_text)
        async with self.session.begin():
            result = await self.session.execute(
                select(MaterialSummary).where(MaterialSummary.material_id == material_id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.summary = summary_text
            else:
                self.session.add(MaterialSummary(material_id=material_id, summary=summary_text))
        return summary_text

    async def regenerate_notes(self, material_id: UUID) -> str:
        """Регенерировать notes для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")
        notes_text = await self.ai_service.generate_notes(material.full_text)
        async with self.session.begin():
            result = await self.session.execute(
                select(MaterialNotes).where(MaterialNotes.material_id == material_id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.notes = notes_text
            else:
                self.session.add(MaterialNotes(material_id=material_id, notes=notes_text))
        return notes_text

    async def regenerate_flashcards(self, material_id: UUID, count: int = 15) -> int:
        """Регенерировать flashcards для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")
        flashcards_data = await self.ai_service.generate_flashcards(material.full_text, count)
        async with self.session.begin():
            await self.session.execute(
                delete(Flashcard).where(Flashcard.material_id == material_id)
            )
            for card in flashcards_data:
                self.session.add(Flashcard(
                    material_id=material_id,
                    question=card["question"],
                    answer=card["answer"],
                ))
        return len(flashcards_data)

    async def regenerate_quiz(self, material_id: UUID, count: int = 10) -> int:
        """Регенерировать quiz для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")
        quiz_data = await self.ai_service.generate_quiz(material.full_text, count)
        async with self.session.begin():
            await self.session.execute(
                delete(QuizQuestion).where(QuizQuestion.material_id == material_id)
            )
            for q in quiz_data:
                self.session.add(QuizQuestion(
                    material_id=material_id,
                    question=q["question"],
                    option_a=q["option_a"],
                    option_b=q["option_b"],
                    option_c=q["option_c"],
                    option_d=q["option_d"],
                    correct_option=q["correct_option"],
                    explanation=q.get("explanation"),
                ))
        return len(quiz_data)

    async def _save_quiz(self, material_id: UUID, quiz_questions: List[Dict]) -> None:
        """Backward-compatible helper kept for tests and legacy callers."""
        await self.session.execute(
            delete(QuizQuestion).where(QuizQuestion.material_id == material_id)
        )
        for q in quiz_questions:
            self.session.add(QuizQuestion(
                material_id=material_id,
                question=q["question"],
                option_a=q["option_a"],
                option_b=q["option_b"],
                option_c=q["option_c"],
                option_d=q["option_d"],
                correct_option=q["correct_option"],
                explanation=q.get("explanation"),
            ))
        await self.session.commit()

    async def _get_material(self, material_id: UUID) -> Material:
        """Получить материал по ID."""
        result = await self.session.execute(
            select(Material).where(Material.id == material_id)
        )
        material = result.scalar_one_or_none()
        if not material:
            raise ValueError(f"Material {material_id} not found")
        return material
