"""
Service для обработки материалов (PDF/YouTube) и генерации AI контента
"""
import logging
from typing import List, Dict, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

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
    1. Извлечение текста (PDF/YouTube transcription)
    2. Нормализация текста
    3. Генерация AI контента (summary, notes, flashcards, quiz) параллельно
    4. Создание embeddings для RAG
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_service = OpenAIService()

    async def process_material(
        self, material_id: UUID, full_text: str
    ) -> None:
        """
        Основная функция обработки материала.

        Args:
            material_id: ID материала
            full_text: Извлеченный текст из PDF/YouTube

        Steps:
            1. Update status to PROCESSING
            2. Generate summary
            3. Generate notes
            4. Generate flashcards
            5. Generate quiz
            6. Create embeddings
            7. Update status to COMPLETED
        """
        try:
            # 1. Пропускаем сброс к 10%, так как после экстракции у нас уже 30%
            # await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 10)

            # 2. Генерация summary
            logger.info(f"[MaterialProcessing] Generating summary for {material_id}")
            summary_text = await self.ai_service.generate_summary(full_text)
            await self._save_summary(material_id, summary_text)
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 45)

            # 3. Генерация notes
            logger.info(f"[MaterialProcessing] Generating notes for {material_id}")
            notes_text = await self.ai_service.generate_notes(full_text)
            await self._save_notes(material_id, notes_text)
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 60)

            # 4. Генерация flashcards
            logger.info(f"[MaterialProcessing] Generating flashcards for {material_id}")
            flashcards_data = await self.ai_service.generate_flashcards(full_text, count=15)
            await self._save_flashcards(material_id, flashcards_data)
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 75)

            # 5. Генерация quiz
            logger.info(f"[MaterialProcessing] Generating quiz for {material_id}")
            quiz_data = await self.ai_service.generate_quiz(full_text, count=10)
            await self._save_quiz(material_id, quiz_data)
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 85)

            # 6. Создание embeddings
            logger.info(f"[MaterialProcessing] Creating embeddings for {material_id}")
            await self._create_embeddings(material_id, full_text)
            await self._update_processing_status(material_id, ProcessingStatus.PROCESSING, 95)

            # 7. Завершено!
            await self._update_processing_status(material_id, ProcessingStatus.COMPLETED, 100)
            logger.info(f"[MaterialProcessing] Successfully processed material {material_id}")

        except Exception as e:
            logger.error(f"[MaterialProcessing] Error processing material {material_id}: {str(e)}")
            await self._update_processing_status(material_id, ProcessingStatus.FAILED, 0)
            raise

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

    async def _save_summary(self, material_id: UUID, summary_text: str):
        """Сохранить summary в БД."""
        # Проверить существует ли уже
        result = await self.session.execute(
            select(MaterialSummary).where(MaterialSummary.material_id == material_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.summary = summary_text
        else:
            new_summary = MaterialSummary(
                material_id=material_id,
                summary=summary_text
            )
            self.session.add(new_summary)

        await self.session.commit()
        logger.info(f"[MaterialProcessing] Saved summary ({len(summary_text)} chars)")

    async def _save_notes(self, material_id: UUID, notes_text: str):
        """Сохранить notes в БД."""
        result = await self.session.execute(
            select(MaterialNotes).where(MaterialNotes.material_id == material_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.notes = notes_text
        else:
            new_notes = MaterialNotes(
                material_id=material_id,
                notes=notes_text
            )
            self.session.add(new_notes)

        await self.session.commit()
        logger.info(f"[MaterialProcessing] Saved notes ({len(notes_text)} chars)")

    async def _save_flashcards(self, material_id: UUID, flashcards: List[Dict]):
        """Сохранить flashcards в БД."""
        # Удалить старые
        await self.session.execute(
            select(Flashcard).where(Flashcard.material_id == material_id)
        )
        # Note: В production лучше использовать soft delete или version control

        # Создать новые
        for card_data in flashcards:
            flashcard = Flashcard(
                material_id=material_id,
                question=card_data["question"],
                answer=card_data["answer"]
            )
            self.session.add(flashcard)

        await self.session.commit()
        logger.info(f"[MaterialProcessing] Saved {len(flashcards)} flashcards")

    async def _save_quiz(self, material_id: UUID, quiz_questions: List[Dict]):
        """Сохранить quiz вопросы в БД."""
        # Создать вопросы
        for q_data in quiz_questions:
            question = QuizQuestion(
                material_id=material_id,
                question=q_data["question"],
                option_a=q_data["option_a"],
                option_b=q_data["option_b"],
                option_c=q_data["option_c"],
                option_d=q_data["option_d"],
                correct_option=q_data["correct_option"],
                explanation=q_data.get("explanation"),
            )
            self.session.add(question)

        await self.session.commit()
        logger.info(f"[MaterialProcessing] Saved {len(quiz_questions)} quiz questions")

    async def _create_embeddings(self, material_id: UUID, full_text: str):
        """
        Создать векторные embeddings для RAG.

        Разбивает текст на чанки и создает embedding для каждого.
        """
        # Разбить текст на чанки
        chunks = self._split_into_chunks(full_text, settings.EMBEDDING_CHUNK_SIZE)

        if not chunks:
            logger.warning(f"[MaterialProcessing] No chunks to embed for {material_id}")
            return

        # Создать embeddings batch
        logger.info(f"[MaterialProcessing] Creating embeddings for {len(chunks)} chunks")
        embeddings = await self.ai_service.create_embeddings_batch(chunks)

        # Сохранить в БД
        for idx, (chunk_text, embedding_vector) in enumerate(zip(chunks, embeddings)):
            material_embedding = MaterialEmbedding(
                material_id=material_id,
                chunk_index=idx,
                chunk_text=chunk_text,
                embedding=embedding_vector
            )
            self.session.add(material_embedding)

        await self.session.commit()
        logger.info(f"[MaterialProcessing] Saved {len(chunks)} embeddings")

    def _split_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """
        Разбить текст на чанки для embeddings.

        Args:
            text: Полный текст
            chunk_size: Размер чанка в символах

        Returns:
            List[str]: Список чанков
        """
        if not text:
            return []

        chunks = []
        current_pos = 0
        text_length = len(text)

        while current_pos < text_length:
            # Взять чанк
            end_pos = current_pos + chunk_size

            # Попытаться найти конец предложения
            if end_pos < text_length:
                # Найти ближайшую точку, восклицательный или вопросительный знак
                for i in range(end_pos, current_pos + chunk_size // 2, -1):
                    if text[i] in ".!?\n":
                        end_pos = i + 1
                        break

            chunk = text[current_pos:end_pos].strip()
            if chunk:
                chunks.append(chunk)

            current_pos = end_pos

        logger.debug(f"[MaterialProcessing] Split text into {len(chunks)} chunks")
        return chunks

    async def regenerate_summary(self, material_id: UUID) -> str:
        """Регенерировать summary для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")

        summary_text = await self.ai_service.generate_summary(material.full_text)
        await self._save_summary(material_id, summary_text)
        return summary_text

    async def regenerate_notes(self, material_id: UUID) -> str:
        """Регенерировать notes для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")

        notes_text = await self.ai_service.generate_notes(material.full_text)
        await self._save_notes(material_id, notes_text)
        return notes_text

    async def regenerate_flashcards(self, material_id: UUID, count: int = 15) -> int:
        """Регенерировать flashcards для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")

        flashcards_data = await self.ai_service.generate_flashcards(material.full_text, count)
        await self._save_flashcards(material_id, flashcards_data)
        return len(flashcards_data)

    async def regenerate_quiz(self, material_id: UUID, count: int = 10) -> int:
        """Регенерировать quiz для материала."""
        material = await self._get_material(material_id)
        if not material.full_text:
            raise ValueError("Material has no text to process")

        quiz_data = await self.ai_service.generate_quiz(material.full_text, count)
        await self._save_quiz(material_id, quiz_data)
        return len(quiz_data)

    async def _get_material(self, material_id: UUID) -> Material:
        """Получить материал по ID."""
        result = await self.session.execute(
            select(Material).where(Material.id == material_id)
        )
        material = result.scalar_one_or_none()
        if not material:
            raise ValueError(f"Material {material_id} not found")
        return material
