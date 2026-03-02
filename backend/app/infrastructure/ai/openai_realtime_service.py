"""
OpenAI Realtime API Service
Мост между браузером (binary PCM16) и OpenAI Realtime API (JSON base64)

Поддерживает:
- Полный дуплекс (full-duplex)
- VAD (Voice Activity Detection)
- Живые субтитры через Whisper
- Прерывание (interruption)
"""
import asyncio
import base64
import json
import logging
from typing import Optional

import websockets
from websockets.asyncio.client import ClientConnection

logger = logging.getLogger(__name__)


class OpenAIRealtimeService:
    """
    Сервис для работы с OpenAI Realtime API.
    
    Протокол:
    - Браузер отправляет binary PCM16 (24kHz, mono)
    - Сервис конвертирует в base64 и отправляет в OpenAI как JSON
    - OpenAI возвращает JSON с audio delta (base64)
    - Сервис декодирует и отправляет binary PCM16 браузеру
    """
    
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-realtime-preview",
        voice: str = "alloy",
    ):
        self.api_key = api_key
        self.model = model
        self.voice = voice
        self.openai_ws: Optional[ClientConnection] = None
        self.session_id: Optional[str] = None
        
    async def connect(self) -> None:
        """Подключение к OpenAI Realtime API"""
        url = f"wss://api.openai.com/v1/realtime?model={self.model}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1",
        }
        
        logger.info(f"Connecting to OpenAI Realtime API: {url}")
        self.openai_ws = await websockets.connect(url, additional_headers=headers)
        logger.info("Connected to OpenAI Realtime API")
        
    async def configure_session(
        self,
        system_prompt: str,
        turn_detection_type: str = "server_vad",
        threshold: float = 0.5,
        silence_duration_ms: int = 500,
    ) -> None:
        """
        Настройка сессии OpenAI Realtime API.
        
        Args:
            system_prompt: Промпт для тьютора
            turn_detection_type: "server_vad" для авто-определения конца фразы
            threshold: Порог срабатывания VAD (0.0-1.0)
            silence_duration_ms: Длительность тишины для завершения фразы (мс)
        """
        session_update = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": system_prompt,
                "voice": self.voice,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1"
                },
                "turn_detection": {
                    "type": turn_detection_type,
                    "threshold": threshold,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": silence_duration_ms,
                } if turn_detection_type == "server_vad" else None,
            }
        }
        
        # Удалить None поля
        if session_update["session"]["turn_detection"] is None:
            del session_update["session"]["turn_detection"]
        
        logger.info(f"Configuring session with voice={self.voice}, VAD={turn_detection_type}")
        await self.openai_ws.send(json.dumps(session_update))
        
        # Ждем подтверждения
        response = await self.openai_ws.recv()
        logger.debug(f"Session config response: {response}")
        
    async def send_audio_chunk(self, audio_data: bytes) -> None:
        """
        Отправка аудио чанка в OpenAI.
        
        Args:
            audio_data: PCM16 audio data (24kHz, mono)
        """
        if not self.openai_ws:
            raise RuntimeError("Not connected to OpenAI")
            
        # Конвертируем binary PCM16 в base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        message = {
            "type": "input_audio_buffer.append",
            "audio": audio_base64,
        }
        
        await self.openai_ws.send(json.dumps(message))
        
    async def interrupt(self) -> None:
        """
        Прерывание текущего ответа AI (когда пользователь перебивает).
        Очищает входной буфер и начинает новую генерацию.
        """
        if not self.openai_ws:
            return
            
        # Отменяем текущую генерацию
        cancel_message = {
            "type": "response.cancel",
        }
        await self.openai_ws.send(json.dumps(cancel_message))
        
        # Очищаем входной буфер
        clear_message = {
            "type": "input_audio_buffer.clear",
        }
        await self.openai_ws.send(json.dumps(clear_message))
        
        logger.info("Interrupted AI response")
        
    async def process_events(
        self,
        browser_ws,
        on_audio: callable,
        on_transcript: callable,
        on_error: callable,
    ) -> None:
        """
        Обработка событий от OpenAI Realtime API.
        
        Args:
            browser_ws: WebSocket соединение с браузером
            on_audio: Callback для отправки audio браузеру
            on_transcript: Callback для отправки транскрипта браузеру
            on_error: Callback для отправки ошибок браузеру
        """
        try:
            async for message in self.openai_ws:
                try:
                    # Пробуем распарсить как JSON
                    event = json.loads(message)
                    event_type = event.get("type", "")
                    
                    # Обработка различных событий
                    if event_type == "response.audio.delta":
                        # Аудио ответ от AI
                        delta = event.get("delta", "")
                        if delta:
                            audio_data = base64.b64decode(delta)
                            await on_audio(audio_data)
                            
                    elif event_type == "response.audio_transcript.delta":
                        # Живой транскрипт (Whisper)
                        delta = event.get("delta", "")
                        if delta:
                            await on_transcript(delta)
                            
                    elif event_type == "response.audio_transcript.done":
                        # Завершенный транскрипт
                        transcript = event.get("transcript", "")
                        logger.debug(f"Transcript done: {transcript[:100]}...")
                        
                    elif event_type == "response.done":
                        # Генерация ответа завершена
                        logger.debug("Response generation done")
                        
                    elif event_type == "conversation.item.input_audio_transcription.completed":
                        # Транскрипция речи пользователя завершена
                        transcript = event.get("transcript", "")
                        logger.info(f"User said: {transcript}")
                        
                    elif event_type == "error":
                        # Ошибка от OpenAI
                        error_msg = event.get("error", {}).get("message", "Unknown error")
                        logger.error(f"OpenAI error: {error_msg}")
                        await on_error(f"OpenAI error: {error_msg}")
                        
                    elif event_type == "session.created":
                        # Сессия создана
                        self.session_id = event.get("session", {}).get("id")
                        logger.info(f"Session created: {self.session_id}")
                        
                except json.JSONDecodeError:
                    logger.warning(f"Received non-JSON message: {message[:100]}")
                    continue
                    
        except websockets.ConnectionClosed as e:
            logger.warning(f"OpenAI connection closed: {e.code} {e.reason}")
            await on_error(f"Connection closed: {e.reason}")
        except Exception as e:
            logger.exception(f"Error processing OpenAI events: {e}")
            await on_error(f"Error: {str(e)}")
            
    async def close(self) -> None:
        """Закрытие соединения с OpenAI"""
        if self.openai_ws:
            await self.openai_ws.close()
            self.openai_ws = None
            logger.info("Closed OpenAI connection")
