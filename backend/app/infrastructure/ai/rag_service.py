"""
RAG (Retrieval-Augmented Generation) Service
Поиск релевантных чанков материала через векторную схожесть
"""
import hashlib
import json
import logging
from typing import List, Optional
from datetime import datetime, timedelta

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.embedding import MaterialEmbedding
from app.infrastructure.database.models.material import Material

logger = logging.getLogger(__name__)


class RAGService:
    """
    Сервис для поиска релевантного контекста в материалах.
    
    Использует:
    - Векторный поиск (cosine similarity) по эмбеддингам
    - Semantic cache в Redis для ускорения повторяющихся вопросов
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.cache_ttl = timedelta(hours=24)
        
    async def search_relevant_chunks(
        self,
        db: AsyncSession,
        query: str,
        material_ids: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> List[dict]:
        """
        Поиск наиболее релевантных чанков.
        
        Args:
            db: Database session
            query: Вопрос пользователя
            material_ids: Список ID материалов для поиска (None = все материалы)
            top_k: Количество результатов
            
        Returns:
            List of {chunk_text, material_id, material_title, similarity}
        """
        try:
            # Получаем эмбеддинг запроса через OpenAI
            query_embedding = await self._get_embedding(query)
            if not query_embedding:
                logger.warning("Failed to get query embedding")
                return []
            
            # Построим запрос
            if material_ids:
                # Поиск по конкретным материалам
                results = []
                for mat_id in material_ids:
                    stmt = select(
                        MaterialEmbedding.chunk_text,
                        MaterialEmbedding.material_id,
                        Material.title.label('material_title'),
                        MaterialEmbedding.embedding.cosine_distance(query_embedding).label('similarity')
                    ).join(
                        Material,
                        MaterialEmbedding.material_id == Material.id
                    ).where(
                        MaterialEmbedding.material_id == mat_id
                    ).order_by(
                        'similarity'
                    ).limit(top_k // len(material_ids) + 1)
                    
                    result = await db.execute(stmt)
                    results.extend(result.fetchall())
            else:
                # Поиск по всем материалам
                stmt = select(
                    MaterialEmbedding.chunk_text,
                    MaterialEmbedding.material_id,
                    Material.title.label('material_title'),
                    MaterialEmbedding.embedding.cosine_distance(query_embedding).label('similarity')
                ).join(
                    Material,
                    MaterialEmbedding.material_id == Material.id
                ).order_by(
                    'similarity'
                ).limit(top_k)
                
                result = await db.execute(stmt)
                results = result.fetchall()
            
            # Форматируем результаты
            formatted = []
            for row in results:
                if row.similarity < 0.7:  # Порог схожести
                    continue
                    
                formatted.append({
                    'chunk_text': row.chunk_text,
                    'material_id': str(row.material_id),
                    'material_title': row.material_title,
                    'similarity': float(row.similarity),
                })
            
            logger.info(f"Found {len(formatted)} relevant chunks")
            return formatted
            
        except Exception as e:
            logger.exception(f"Error searching chunks: {e}")
            return []
    
    async def _get_embedding(self, text: str) -> Optional[List[float]]:
        """Получение эмбеддинга текста через OpenAI"""
        try:
            from openai import AsyncOpenAI
            from app.core.config import settings
            
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            
            response = await client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=text,
            )
            
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            return None
    
    async def get_cached_response(
        self,
        query: str,
        material_ids: Optional[List[str]] = None,
    ) -> Optional[str]:
        """
        Получение ответа из semantic cache.
        
        Args:
            query: Вопрос пользователя
            material_ids: Контекст материалов
            
        Returns:
            Cached response or None
        """
        try:
            # Создаем semantic key из вопроса
            cache_key = self._create_semantic_key(query, material_ids)
            
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info(f"Cache hit for query: {query[:50]}...")
                return cached.decode('utf-8')
                
            return None
            
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def cache_response(
        self,
        query: str,
        response: str,
        material_ids: Optional[List[str]] = None,
    ) -> None:
        """
        Сохранение ответа в cache.
        
        Args:
            query: Вопрос пользователя
            response: Ответ AI
            material_ids: Контекст материалов
        """
        try:
            cache_key = self._create_semantic_key(query, material_ids)
            
            await self.redis.setex(
                cache_key,
                int(self.cache_ttl.total_seconds()),
                response
            )
            
            logger.info(f"Cached response for query: {query[:50]}...")
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    def _create_semantic_key(
        self,
        query: str,
        material_ids: Optional[List[str]] = None,
    ) -> str:
        """
        Создание уникального ключа для semantic cache.
        
        Нормализует вопрос и добавляет контекст материалов.
        """
        # Нормализация вопроса (lowercase, trim)
        normalized = query.lower().strip()
        
        # Добавляем контекст материалов
        if material_ids:
            context = ','.join(sorted(material_ids))
            key_input = f"{context}:{normalized}"
        else:
            key_input = normalized
        
        # Hash для компактности
        return f"voice_cache:{hashlib.sha256(key_input.encode()).hexdigest()[:16]}"
    
    async def build_context_string(
        self,
        chunks: List[dict],
        max_length: int = 2000,
    ) -> str:
        """
        Построение строки контекста из найденных чанков.
        
        Args:
            chunks: List of relevant chunks from search_relevant_chunks
            max_length: Максимальная длина контекста
            
        Returns:
            Formatted context string
        """
        if not chunks:
            return ""
        
        context_parts = []
        current_length = 0
        
        for chunk in chunks:
            part = f"[From {chunk['material_title']}]: {chunk['chunk_text']}"
            
            if current_length + len(part) > max_length:
                break
                
            context_parts.append(part)
            current_length += len(part)
        
        return "\n\n".join(context_parts)
