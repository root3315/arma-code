"""
Voice Chat WebSocket Endpoint v2
Полный дуплексный голосовой чат с AI-тьютором через OpenAI Realtime API

Фичи:
- Полный дуплекс (говорите и слушайте одновременно)
- Прерывание AI (перебивайте в любой момент)
- Push-to-talk режим
- Живые субтитры (Whisper)
- RAG (Retrieval-Augmented Generation) с векторным поиском
- Semantic cache для быстрых ответов
- Multi-material selection (выбор нескольких материалов)
- Auto language detection (RU/EN)
"""
import asyncio
import json
import logging
import re
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.infrastructure.database.session import get_async_session as get_db
from app.core.security import decode_access_token
from app.infrastructure.database.models import Material, User
from app.infrastructure.ai.openai_realtime_service import OpenAIRealtimeService
from app.infrastructure.ai.rag_service import RAGService
from app.infrastructure.ai.voicebox_service import VoiceboxService, get_voicebox_service

import redis.asyncio as redis

logger = logging.getLogger(__name__)

router = APIRouter()

# Системный промпт для тьютора с поддержкой RAG
_TUTOR_PROMPT_TEMPLATE = (
    "You are a wise and friendly AI teacher. "
    "Answer questions in a clear and engaging way. "
    "Answer in the same language the student uses (Russian or English). "
    "Be concise but thorough. Use examples when helpful. "
    "If the student interrupts you, stop immediately and answer their new question. "
    "Use the provided context from study materials to give accurate answers. "
    "If the context doesn't contain the answer, say so honestly.\n\n"
    "Current materials: {materials}\n\n"
    "Context from materials:\n{context}"
)

# Промпт для общего диалога (без материалов)
_GENERAL_TUTOR_PROMPT = (
    "You are a wise and friendly AI teacher. "
    "Answer questions in a clear and engaging way. "
    "Answer in the same language the student uses (Russian or English). "
    "Be concise but thorough. Use examples when helpful. "
    "If the student interrupts you, stop immediately and answer their new question."
)


def detect_language(text: str) -> str:
    """
    Определение языка текста (Russian или English).
    
    Returns:
        'ru' или 'en'
    """
    # Считаем символы Cyrillic vs Latin
    cyrillic = len(re.findall(r'[\u0400-\u04FF]', text))
    latin = len(re.findall(r'[\u0000-\u007F]', text))
    
    return 'ru' if cyrillic > latin else 'en'


async def authenticate_voice_session(
    websocket: WebSocket,
    material_ids: List[UUID],
    token: str,
    db: AsyncSession,
) -> Optional[tuple[User, List[Material]]]:
    """
    Аутентификация и авторизация сессии голосового чата.
    
    Args:
        websocket: WebSocket соединение
        material_ids: Список ID материалов (может быть пустым для общего диалога)
        token: JWT токен
        db: Database session
        
    Returns:
        Tuple[User, List[Material]] если успешно, None если ошибка
    """
    try:
        # Декодируем токен
        payload = decode_access_token(token)
        if not payload:
            await websocket.send_json({
                "type": "error",
                "message": "Invalid or expired token"
            })
            await websocket.close(code=4001)
            return None
            
        user_id = payload.get("sub")
        if not user_id:
            await websocket.send_json({
                "type": "error",
                "message": "Invalid token payload"
            })
            await websocket.close(code=4001)
            return None
        
        # Проверяем пользователя
        result = await db.execute(
            select(User).where(User.id == user_id, User.is_active == True)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            await websocket.send_json({
                "type": "error",
                "message": "User not found or inactive"
            })
            await websocket.close(code=4001)
            return None
        
        # Если материалы не указаны - возвращаем пустой список (общий диалог)
        if not material_ids:
            return user, []
        
        # Проверяем материалы (должны принадлежать пользователю)
        result = await db.execute(
            select(Material).where(
                Material.id.in_(material_ids),
                Material.user_id == user_id
            )
        )
        materials = result.scalars().all()
        
        if len(materials) != len(material_ids):
            await websocket.send_json({
                "type": "error",
                "message": "Some materials not found or access denied"
            })
            await websocket.close(code=4004)
            return None
        
        return user, materials
        
    except Exception as e:
        logger.exception(f"Authentication error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": f"Authentication failed: {str(e)}"
        })
        await websocket.close(code=4001)
        return None


async def browser_to_openai(
    browser_ws: WebSocket,
    openai_service: OpenAIRealtimeService,
    is_muted: asyncio.Event,
    last_user_message: dict,  # Для передачи последнего вопроса в RAG
) -> None:
    """
    Поток: Браузер → OpenAI
    Получает binary PCM16 от браузера и отправляет в OpenAI
    """
    try:
        while True:
            message = await browser_ws.receive()

            # Проверяем тип сообщения
            if "bytes" in message:
                # Binary audio data
                audio_data = message["bytes"]

                # Если на mute - не отправляем аудио
                if is_muted.is_set():
                    logger.debug("Audio received but muted - dropping")
                    continue

                await openai_service.send_audio_chunk(audio_data)

            elif "text" in message:
                # Текстовое управление (mute, interrupt, etc.)
                try:
                    control = json.loads(message["text"])
                    control_type = control.get("type", "")

                    if control_type == "mute":
                        is_muted.set()
                        logger.debug("Browser: muted")

                    elif control_type == "unmute":
                        is_muted.clear()
                        logger.debug("Browser: unmuted")

                    elif control_type == "interrupt":
                        # Пользователь перебивает AI
                        await openai_service.interrupt()
                        logger.debug("Browser: interrupt")

                    elif control_type == "user_transcript":
                        # Сохраняем последний вопрос пользователя для RAG
                        transcript = control.get("transcript", "")
                        if transcript:
                            last_user_message['text'] = transcript
                            last_user_message['lang'] = detect_language(transcript)
                            logger.debug(f"User transcript ({last_user_message['lang']}): {transcript[:100]}")

                except json.JSONDecodeError:
                    logger.warning(f"Invalid control message: {message['text']}")

    except WebSocketDisconnect:
        logger.info("Browser disconnected (browser_to_openai)")
    except Exception as e:
        logger.exception(f"Error in browser_to_openai: {e}")
        raise


async def openai_to_browser(
    browser_ws: WebSocket,
    openai_service: OpenAIRealtimeService,
    rag_service: Optional[RAGService],
    db: AsyncSession,
    material_ids: Optional[List[str]],
    last_user_message: dict,
) -> None:
    """
    Поток: OpenAI → Браузер
    Получает события от OpenAI и отправляет браузеру
    """
    
    async def on_audio(audio_data: bytes) -> None:
        """Отправка audio браузеру"""
        try:
            await browser_ws.send_bytes(audio_data)
        except Exception as e:
            logger.error(f"Error sending audio to browser: {e}")
            
    async def on_transcript(delta: str) -> None:
        """Отправка транскрипта браузеру"""
        try:
            await browser_ws.send_json({
                "type": "transcript",
                "delta": delta
            })
        except Exception as e:
            logger.error(f"Error sending transcript to browser: {e}")
            
    async def on_error(error_msg: str) -> None:
        """Отправка ошибки браузеру"""
        try:
            await browser_ws.send_json({
                "type": "error",
                "message": error_msg
            })
        except Exception as e:
            logger.error(f"Error sending error to browser: {e}")
    
    try:
        await openai_service.process_events(
            browser_ws=browser_ws,
            on_audio=on_audio,
            on_transcript=on_transcript,
            on_error=on_error,
        )
    except Exception as e:
        logger.exception(f"Error in openai_to_browser: {e}")
        raise


@router.websocket("/chat")
async def voice_chat(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
    materials: Optional[str] = Query(None, description="Comma-separated material IDs"),
    provider: Optional[str] = Query("openai", description="Voice provider: openai or personaplex"),
    voice: Optional[str] = Query(None, description="Voice preset: alloy, echo, fable, onyx, nova, shimmer"),
):
    """
    WebSocket endpoint для полнодуплексного голосового чата с AI-тьютором.
    
    Query параметры:
    - token: JWT токен для аутентификации
    - materials: comma-separated список ID материалов (опционально)
    - provider: "openai" (по умолчанию) или "personaplex"
    - voice: голос AI (alloy, echo, fable, onyx, nova, shimmer)
    """
    
    # Принимаем соединение
    await websocket.accept()
    
    # Parse material IDs
    material_ids = []
    if materials:
        try:
            material_ids = [UUID(m.strip()) for m in materials.split(',') if m.strip()]
        except ValueError:
            logger.warning(f"Invalid material IDs: {materials}")
    
    logger.info(f"Voice chat connection: materials={material_ids}, provider={provider}")
    
    # Получаем сессию БД
    db_gen = get_db()
    db = await db_gen.__anext__()
    
    # Redis для semantic cache
    redis_client = None
    
    try:
        # Инициализируем Redis
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=False)
        rag_service = RAGService(redis_client)
        
        # Аутентификация и авторизация
        auth_result = await authenticate_voice_session(websocket, material_ids, token, db)
        if not auth_result:
            return  # Already closed with error
            
        user, materials_list = auth_result
        
        # Определяем провайдер
        active_provider = provider or settings.VOICE_PROVIDER
        
        # Validate provider
        supported_providers = ["openai", "voicebox"]
        if active_provider not in supported_providers:
            await websocket.send_json({
                "type": "error",
                "message": f"Provider '{active_provider}' not supported. Use: {', '.join(supported_providers)}"
            })
            await websocket.close(code=4000)
            return

        # Shared state для последнего вопроса пользователя
        last_user_message = {'text': '', 'lang': 'en'}
        
        # Initialize provider-specific services
        openai_service = None
        voicebox_service = None
        voice_preset = voice or settings.OPENAI_REALTIME_VOICE

        if active_provider == "openai":
            # Создаём сервис OpenAI Realtime API
            openai_service = OpenAIRealtimeService(
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_REALTIME_MODEL,
                voice=voice_preset,
            )

            # Подключаемся к OpenAI
            try:
                await openai_service.connect()
            except Exception as e:
                logger.exception(f"Failed to connect to OpenAI: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Failed to connect to OpenAI: {str(e)}. Check your OPENAI_API_KEY."
                })
                await websocket.close(code=4000)
                return
        else:
            # Voicebox provider (TTS only - requires separate STT and LLM)
            logger.info("Using Voicebox provider for TTS")
            voicebox_service = get_voicebox_service()
            
            # Check Voicebox health
            health = await voicebox_service.health_check()
            if health.get("status") != "healthy":
                logger.error(f"Voicebox unhealthy: {health}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Voicebox backend unhealthy: {health}. Ensure voicebox is running on {settings.VOICEBOX_API_URL}"
                })
                await websocket.close(code=4000)
                return
            
            # For Voicebox, we still need OpenAI for conversation (LLM)
            # Voicebox only handles TTS
            if settings.OPENAI_API_KEY:
                logger.info("Voicebox TTS + OpenAI LLM mode")
                # We'll use OpenAI for conversation, Voicebox for TTS
            else:
                logger.warning("Voicebox TTS only mode (no LLM configured)")
        
        # Генерируем системный промпт
        if materials_list:
            # Режим с материалами - используем RAG
            material_titles = [m.title for m in materials_list]
            material_ids_str = [str(m.id) for m in materials_list]
            
            logger.info(f"Voice chat with materials: {[m.title for m in materials_list]}")
            
            # Функция для динамического получения контекста
            async def get_context_for_question(question: str) -> str:
                """Поиск релевантного контекста через RAG"""
                # Проверяем semantic cache
                cached = await rag_service.get_cached_response(question, material_ids_str)
                if cached:
                    return cached
                
                # Ищем релевантные чанки
                chunks = await rag_service.search_relevant_chunks(
                    db=db,
                    query=question,
                    material_ids=material_ids_str,
                    top_k=5,
                )
                
                if chunks:
                    context = await rag_service.build_context_string(chunks, max_length=2000)
                    logger.info(f"Found context: {context[:200]}...")
                    return context
                
                return ""
            
            # Создаем промпт с плейсхолдерами для RAG
            system_prompt = _TUTOR_PROMPT_TEMPLATE.format(
                materials=', '.join(material_titles),
                context="[Context will be retrieved dynamically based on your questions]"
            )
        else:
            # Общий диалог без материалов
            logger.info("Voice chat in general mode (no materials)")
            material_ids_str = None
            system_prompt = _GENERAL_TUTOR_PROMPT
        
        # Настраиваем сессию OpenAI
        await openai_service.configure_session(
            system_prompt=system_prompt,
            turn_detection_type="server_vad",  # Авто-определение конца фразы
            threshold=0.5,
            silence_duration_ms=500,
        )
        
        # Отправляем готовность браузеру
        await websocket.send_json({
            "type": "ready",
            "provider": active_provider,
            "model": settings.OPENAI_REALTIME_MODEL if active_provider == "openai" else "voicebox-qwen3-tts",
            "voice": voice_preset if active_provider == "openai" else settings.VOICEBOX_DEFAULT_PROFILE_ID or "default",
            "materials_count": len(materials_list),
            "voicebox_url": settings.VOICEBOX_API_URL if active_provider == "voicebox" else None,
        })

        logger.info(f"Voice session ready: user={user.id}, materials={len(materials_list)}, waiting for audio...")

        # Shared state для управления mute (Event set = muted)
        is_muted = asyncio.Event()  # По умолчанию не установлено = микрофон включён
        
        # Запускаем два асинхронных потока:
        # 1. Браузер → OpenAI (аудио с микрофона)
        # 2. OpenAI → Браузер (аудио от AI + транскрипт)
        browser_task = asyncio.create_task(
            browser_to_openai(websocket, openai_service, is_muted, last_user_message)
        )
        oai_task = asyncio.create_task(
            openai_to_browser(websocket, openai_service, rag_service if materials_list else None, db, material_ids_str, last_user_message)
        )
        
        # Ждём завершения любого из потоков
        done, pending = await asyncio.wait(
            [browser_task, oai_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Отменяем оставшиеся задачи
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        logger.info(f"Voice session ended: user={user.id}")
        
    except WebSocketDisconnect:
        logger.info(f"Voice chat disconnected: materials={material_ids}")
    except Exception as e:
        logger.exception(f"Voice chat error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Server error: {str(e)}"
            })
        except:
            pass
    finally:
        # Закрываем соединение с OpenAI
        if openai_service:
            await openai_service.close()

        # Закрываем Voicebox сессию
        if voicebox_service:
            await voicebox_service.close()

        # Закрываем Redis
        if redis_client:
            await redis_client.close()

        # Закрываем БД сессию
        await db_gen.aclose()


@router.get("/providers")
async def list_voice_providers():
    """Список доступных voice провайдеров"""
    return {
        "providers": [
            {
                "id": "openai",
                "name": "OpenAI Realtime API",
                "voices": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
                "default_voice": settings.OPENAI_REALTIME_VOICE,
                "requires_gpu": False,
                "latency_ms": "300-500",
                "features": ["full-duplex", "vad", "whisper-transcript", "rag", "semantic-cache"],
                "description": "Full-duplex voice AI with built-in STT, LLM, and TTS",
            },
            {
                "id": "voicebox",
                "name": "Voicebox (Qwen3-TTS)",
                "voices": ["custom-profiles"],
                "default_voice": settings.VOICEBOX_DEFAULT_PROFILE_ID or "default",
                "requires_gpu": False,  # Works on CPU (optimized for 16-core Xeon)
                "latency_ms": "2000-4000",  # CPU inference time
                "features": ["local-tts", "voice-cloning", "multi-language", "cpu-optimized"],
                "description": "Local TTS using Qwen3-TTS. Requires separate STT and LLM.",
                "backend_url": settings.VOICEBOX_API_URL,
                "model_size": settings.VOICEBOX_MODEL_SIZE,
            },
        ],
        "default_provider": settings.VOICE_PROVIDER,
    }


@router.get("/materials/{material_id}/voice-context")
async def get_material_voice_context(
    material_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: str = Query(...),
):
    """
    Проверка доступности материала для voice chat.
    Возвращает информацию о материале для UI.
    """
    try:
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id = payload.get("sub")
        
        result = await db.execute(
            select(Material).where(
                Material.id == material_id,
                Material.user_id == user_id
            )
        )
        material = result.scalar_one_or_none()
        
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Проверяем наличие эмбеддингов для RAG
        from sqlalchemy import func
        emb_result = await db.execute(
            select(func.count()).select_from(MaterialEmbedding).where(
                MaterialEmbedding.material_id == material_id
            )
        )
        embeddings_count = emb_result.scalar()
        
        return {
            "id": str(material.id),
            "title": material.title,
            "type": material.material_type.value,
            "has_embeddings": embeddings_count > 0,
            "embeddings_count": embeddings_count,
            "voice_chat_ready": embeddings_count > 0,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting material context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Import Depends here to avoid circular import
from fastapi import Depends
from app.infrastructure.database.models.embedding import MaterialEmbedding
