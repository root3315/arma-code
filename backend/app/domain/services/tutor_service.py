"""
Service для RAG-based чата с AI тьютором
"""
import json
import logging
import math
from datetime import datetime
from typing import List, Dict, Optional, Sequence
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from app.infrastructure.database.models.material import Material, TutorMessage, ProjectTutorMessage
from app.infrastructure.database.models.embedding import MaterialEmbedding
from app.infrastructure.ai.openai_service import OpenAIService, get_redis
from app.core.config import settings

logger = logging.getLogger(__name__)

_DISTANCE_THRESHOLD = 0.35


class TutorService:
    """
    Сервис для RAG-based AI тьютора.

    Использует vector similarity search для поиска релевантных кусков текста
    и генерации контекстных ответов.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_service = OpenAIService()

    async def _get_redis(self):
        return await get_redis()

    @staticmethod
    def _cosine_distance(a: Sequence[float], b: Sequence[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 1.0
        return 1.0 - dot / (norm_a * norm_b)

    async def _check_semantic_cache(
        self,
        material_id: UUID,
        user_message: str,
        query_embedding: Sequence[float],
    ) -> Optional[str]:
        redis = await self._get_redis()
        if not redis:
            return None

        keys = await redis.keys(f"semantic_cache:{material_id}:*")
        for key in keys:
            raw_entry = await redis.get(key)
            if not raw_entry:
                continue
            if isinstance(raw_entry, bytes):
                raw_entry = raw_entry.decode("utf-8")
            entry = json.loads(raw_entry)
            cached_embedding = entry.get("embedding") or []
            if not cached_embedding:
                continue
            if self._cosine_distance(query_embedding, cached_embedding) < _DISTANCE_THRESHOLD:
                return entry.get("answer")
        return None

    async def _fallback_context(self, material_id: UUID) -> str:
        result = await self.session.execute(
            select(Material.full_text).where(Material.id == material_id)
        )
        full_text = result.scalar_one_or_none()
        return full_text or ""

    async def send_message(
        self,
        material_id: UUID,
        user_message: str,
        context: str = "chat",
        max_history: int = 10,
    ) -> str:
        """
        Отправить сообщение тьютору и получить ответ.

        Args:
            material_id: ID материала
            user_message: Сообщение пользователя
            context: Контекст ('chat' или 'selection')
            max_history: Максимум сообщений истории для контекста

        Returns:
            str: Ответ AI тьютора
        """
        try:
            logger.info(f"[TutorService] Processing message for material {material_id}")

            # 1. Получить релевантный контекст из embeddings
            relevant_context = await self._find_relevant_context(material_id, user_message)

            # 2. Получить историю диалога
            conversation_history = await self._get_conversation_history(
                material_id, max_history
            )

            # 3. Сгенерировать ответ с помощью OpenAI
            logger.info(f"[TutorService] Generating AI response with context length: {len(relevant_context)}")
            ai_response = await self.ai_service.chat_with_context(
                question=user_message,
                context=relevant_context,
                conversation_history=conversation_history,
            )

            # 4. Сохранить сообщения в БД
            await self._save_messages(material_id, user_message, ai_response, context)

            logger.info(f"[TutorService] Saved conversation for material {material_id}")
            return ai_response
        except Exception as e:
            logger.error(f"[TutorService] Error in send_message: {str(e)}")
            await self.session.rollback()
            raise

    async def send_message_project_wide(
        self,
        project_id: UUID,
        material_ids: List[UUID],
        user_message: str,
        context: str = "chat",
        max_history: int = 10,
    ) -> str:
        """
        Отправить сообщение тьютору с поиском по всем материалам проекта.
        """
        logger.info(f"[TutorService] Processing project-wide message for project {project_id}")

        # 1. Получить релевантный контекст из ВСЕХ материалов проекта
        relevant_context = await self._find_relevant_context_project_wide(
            material_ids, user_message
        )

        # 2. Получить историю диалога из проекта
        conversation_history = await self._get_project_conversation_history(
            project_id, max_history
        )

        # 3. Сгенерировать ответ с помощью OpenAI
        logger.info(f"[TutorService] Generating AI response with project-wide context")
        ai_response = await self.ai_service.chat_with_context(
            question=user_message,
            context=relevant_context,
            conversation_history=conversation_history,
        )

        # 4. Сохранить сообщения в таблицу проекта
        await self._save_project_messages(project_id, user_message, ai_response, context)

        logger.info(f"[TutorService] Saved project-wide conversation")
        return ai_response

    async def _find_relevant_context_project_wide(
        self, material_ids: List[UUID], query: str, top_k: int = 10
    ) -> str:
        """
        Найти релевантные куски текста во всех материалах проекта.
        """
        try:
            # 1. Создать embedding для запроса
            query_embedding = await self.ai_service.create_embedding(query)
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

            # 2. Поиск по ВСЕМ материалам проекта
            # CAST embedding_str к vector типу для pgvector
            # Важно: явно приводим material_ids к UUID[] для PostgreSQL
            material_ids_str = ",".join(f"'{mid}'::uuid" for mid in material_ids)

            search_query = text(f"""
                SELECT chunk_text, chunk_index, material_id,
                       (embedding <=> '{embedding_str}'::vector) AS distance
                FROM material_embeddings
                WHERE material_id = ANY(ARRAY[{material_ids_str}])
                ORDER BY distance ASC
                LIMIT :top_k
            """)

            result = await self.session.execute(
                search_query,
                {"top_k": top_k}
            )

            rows = result.all()

            if not rows:
                logger.warning(f"[TutorService] No embeddings found for project materials")
                return ""

            # 3. Объединить найденные chunks с указанием материала
            context_chunks = [
                f"[Material {row.material_id}, Chunk {row.chunk_index + 1}] {row.chunk_text}"
                for row in rows
            ]

            combined_context = "\n\n".join(context_chunks)
            logger.info(f"[TutorService] Found {len(rows)} relevant chunks across {len(material_ids)} materials")

            return combined_context

        except Exception as e:
            logger.error(f"[TutorService] Error in project-wide vector search: {str(e)}")
            # Rollback to clear the failed transaction
            await self.session.rollback()
            return ""

    async def _find_relevant_context(
        self, material_id: UUID, query: str | Sequence[float], top_k: int = 5
    ) -> str:
        """
        Найти релевантные куски текста используя vector similarity search.

        Args:
            material_id: ID материала
            query: Запрос пользователя
            top_k: Количество топ результатов

        Returns:
            str: Объединенный контекст из найденных кусков
        """
        try:
            logger.info(f"[TutorService] Finding relevant context for material {material_id}")

            # 1. Создать embedding для запроса
            if isinstance(query, str):
                query_embedding = await self.ai_service.create_embedding(query)
            else:
                query_embedding = list(query)

            # 2. Выполнить vector similarity search
            # Используем pgvector cosine similarity (оператор <=>)
            # Форматируем embedding как строку для PostgreSQL
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

            search_query = text(f"""
                SELECT chunk_text, chunk_index,
                       (embedding <=> '{embedding_str}'::vector) AS distance
                FROM material_embeddings
                WHERE material_id = :material_id
                ORDER BY distance ASC
                LIMIT :top_k
            """)

            result = await self.session.execute(
                search_query,
                {
                    "material_id": material_id,
                    "top_k": top_k
                }
            )

            rows = result.fetchall() if hasattr(result, "fetchall") else result.all()

            if not rows:
                logger.warning(f"[TutorService] No embeddings found for material {material_id}")
                return await self._fallback_context(material_id)

            # 3. Объединить найденные chunks
            context_chunks = []
            for row in rows:
                if hasattr(row, "_mapping"):
                    chunk_text = row._mapping["chunk_text"]
                    chunk_index = row._mapping["chunk_index"]
                    distance = float(row._mapping["distance"])
                else:
                    chunk_text, chunk_index, distance = row

                if distance < _DISTANCE_THRESHOLD:
                    context_chunks.append(f"[Chunk {chunk_index + 1}] {chunk_text}")

            if not context_chunks:
                return await self._fallback_context(material_id)

            combined_context = "\n\n".join(context_chunks)
            logger.info(f"[TutorService] Found {len(rows)} relevant chunks for material {material_id}")

            return combined_context

        except Exception as e:
            logger.error(f"[TutorService] Error in vector search: {str(e)}")
            # Rollback to clear the failed transaction
            await self.session.rollback()
            return ""

    async def _get_conversation_history(
        self, material_id: UUID, max_messages: int = 10
    ) -> List[Dict[str, str]]:
        """
        Получить историю диалога для контекста.

        Args:
            material_id: ID материала
            max_messages: Максимум сообщений для загрузки

        Returns:
            List[Dict]: Список сообщений в формате OpenAI
        """
        try:
            result = await self.session.execute(
                select(TutorMessage)
                .where(TutorMessage.material_id == material_id)
                .order_by(TutorMessage.created_at.desc())
                .limit(max_messages)
            )

            messages = result.scalars().all()
            
            # Преобразовать в формат OpenAI (развернуть чтобы старые были первыми)
            conversation = [
                {"role": msg.role, "content": msg.content}
                for msg in reversed(messages)
            ]

            logger.info(f"[TutorService] Loaded {len(conversation)} messages from history")
            return conversation

        except Exception as e:
            logger.error(f"[TutorService] Error loading conversation history: {str(e)}")
            # Rollback to clear the failed transaction
            await self.session.rollback()
            return []

    async def _save_messages(
        self,
        material_id: UUID,
        user_message: str,
        ai_response: str,
        context: str
    ):
        """
        Сохранить сообщения пользователя и AI в БД.
        """
        from datetime import datetime

        # Создать сообщение пользователя
        user_msg = TutorMessage(
            material_id=material_id,
            role="user",
            content=user_message,
            context=context,
            created_at=datetime.utcnow()
        )

        # Создать сообщение AI
        ai_msg = TutorMessage(
            material_id=material_id,
            role="assistant",
            content=ai_response,
            context=context,
            created_at=datetime.utcnow()
        )

        # Добавить сообщения и закоммитить
        self.session.add(user_msg)
        self.session.add(ai_msg)
        await self.session.commit()

        logger.info(
            f"[TutorService] Saved conversation pair for material {material_id}"
        )

    async def get_history(
        self, material_id: UUID, limit: int = 50
    ) -> List[TutorMessage]:
        """
        Получить историю чата.

        Args:
            material_id: ID материала
            limit: Максимум сообщений

        Returns:
            List[TutorMessage]: История сообщений (от старых к новым)
        """
        result = await self.session.execute(
            select(TutorMessage)
            .where(TutorMessage.material_id == material_id)
            .order_by(TutorMessage.created_at.asc())
            .limit(limit)
        )

        return list(result.scalars().all())

    async def clear_history(self, material_id: UUID) -> int:
        """
        Очистить историю чата.

        Args:
            material_id: ID материала

        Returns:
            int: Количество удаленных сообщений
        """
        from sqlalchemy import delete

        result = await self.session.execute(
            delete(TutorMessage).where(TutorMessage.material_id == material_id)
        )
        await self.session.commit()

        count = result.rowcount
        logger.info(f"[TutorService] Cleared {count} messages for material {material_id}")

        return count

    # ========================================================================
    # PROJECT-LEVEL CHAT METHODS
    # ========================================================================

    async def _save_project_messages(
        self,
        project_id: UUID,
        user_message: str,
        ai_response: str,
        context: str
    ):
        """
        Сохранить сообщения пользователя и AI в таблицу проекта.
        """
        from datetime import datetime

        # Создать сообщение пользователя
        user_msg = ProjectTutorMessage(
            project_id=project_id,
            role="user",
            content=user_message,
            context=context,
            created_at=datetime.utcnow()
        )

        # Создать сообщение AI
        ai_msg = ProjectTutorMessage(
            project_id=project_id,
            role="assistant",
            content=ai_response,
            context=context,
            created_at=datetime.utcnow()
        )

        # Добавить сообщения и закоммитить
        self.session.add(user_msg)
        self.session.add(ai_msg)
        await self.session.commit()

        logger.info(
            f"[TutorService] Saved conversation pair for project {project_id}"
        )

    async def _get_project_conversation_history(
        self, project_id: UUID, max_messages: int = 10
    ) -> List[Dict[str, str]]:
        """
        Получить историю диалога для проекта.

        Args:
            project_id: ID проекта
            max_messages: Максимум сообщений для загрузки

        Returns:
            List[Dict]: Список сообщений в формате OpenAI
        """
        result = await self.session.execute(
            select(ProjectTutorMessage)
            .where(ProjectTutorMessage.project_id == project_id)
            .order_by(ProjectTutorMessage.created_at.desc())
            .limit(max_messages)
        )

        messages = result.scalars().all()

        # Преобразовать в формат OpenAI (развернуть чтобы старые были первыми)
        conversation = [
            {"role": msg.role, "content": msg.content}
            for msg in reversed(messages)
        ]

        logger.info(f"[TutorService] Loaded {len(conversation)} project messages from history")
        return conversation

    async def get_project_history(
        self, project_id: UUID, limit: int = 50
    ) -> List[ProjectTutorMessage]:
        """
        Получить историю чата проекта.

        Args:
            project_id: ID проекта
            limit: Максимум сообщений

        Returns:
            List[ProjectTutorMessage]: История сообщений (от старых к новым)
        """
        result = await self.session.execute(
            select(ProjectTutorMessage)
            .where(ProjectTutorMessage.project_id == project_id)
            .order_by(ProjectTutorMessage.created_at.asc())
            .limit(limit)
        )

        return list(result.scalars().all())

    async def clear_project_history(self, project_id: UUID) -> int:
        """
        Очистить историю чата проекта.

        Args:
            project_id: ID проекта

        Returns:
            int: Количество удаленных сообщений
        """
        from sqlalchemy import delete

        result = await self.session.execute(
            delete(ProjectTutorMessage).where(ProjectTutorMessage.project_id == project_id)
        )
        await self.session.commit()

        count = result.rowcount
        logger.info(f"[TutorService] Cleared {count} messages for project {project_id}")

        return count
