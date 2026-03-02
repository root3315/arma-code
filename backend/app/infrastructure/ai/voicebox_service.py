"""
Voicebox TTS Service
Local text-to-speech using Qwen3-TTS via Voicebox API

Features:
- Full-duplex audio streaming
- Voice cloning support
- Multi-language (RU/EN/DE/FR/ES/IT/JA/KO/ZH/PT)
- Low latency CPU inference (optimized for 16-core Xeon)
"""
import asyncio
import logging
import aiohttp
from typing import Optional, Callable
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class VoiceboxService:
    """
    Service for local TTS using Voicebox (Qwen3-TTS).
    
    This service connects to the Voicebox backend API running locally
    and provides text-to-speech synthesis with voice cloning support.
    
    Architecture:
    - Voicebox backend runs on http://localhost:8000 (or configured port)
    - Uses PyTorch backend with CPU optimization (OMP_NUM_THREADS=16)
    - Supports voice profiles for cloning
    - Latency: ~2-4s for short phrases on 16-core Xeon Gold
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        default_profile_id: Optional[str] = None,
        default_language: str = "en",
        default_model_size: str = "1.7B",
        timeout_seconds: int = 60,
    ):
        """
        Initialize Voicebox service.
        
        Args:
            base_url: Voicebox backend API URL
            default_profile_id: Default voice profile ID to use
            default_language: Default language for TTS
            default_model_size: Model size (1.7B or 0.6B)
            timeout_seconds: Request timeout for generation
        """
        self.base_url = base_url.rstrip("/")
        self.default_profile_id = default_profile_id
        self.default_language = default_language
        self.default_model_size = default_model_size
        self.timeout_seconds = timeout_seconds
        self._session: Optional[aiohttp.ClientSession] = None
        
        logger.info(f"VoiceboxService initialized: base_url={self.base_url}")

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout_seconds)
            )
            logger.debug("Created new aiohttp session")
        return self._session

    async def close(self) -> None:
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("Closed Voicebox aiohttp session")

    async def health_check(self) -> dict:
        """
        Check Voicebox backend health status.
        
        Returns:
            dict with status, model_loaded, gpu_available, etc.
        """
        session = await self._get_session()
        try:
            async with session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    logger.info(f"Voicebox health check: {health_data}")
                    return health_data
                else:
                    logger.error(f"Voicebox health check failed: {response.status}")
                    return {"status": "unhealthy", "error": f"Status {response.status}"}
        except Exception as e:
            logger.exception(f"Voicebox health check error: {e}")
            return {"status": "unhealthy", "error": str(e)}

    async def list_profiles(self) -> list:
        """
        List available voice profiles.
        
        Returns:
            List of voice profiles
        """
        session = await self._get_session()
        try:
            async with session.get(f"{self.base_url}/profiles") as response:
                if response.status == 200:
                    profiles = await response.json()
                    logger.info(f"Found {len(profiles)} voice profiles")
                    return profiles
                else:
                    logger.error(f"Failed to list profiles: {response.status}")
                    return []
        except Exception as e:
            logger.exception(f"Error listing profiles: {e}")
            return []

    async def generate_speech(
        self,
        text: str,
        profile_id: Optional[str] = None,
        language: Optional[str] = None,
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
        model_size: Optional[str] = None,
        stream: bool = False,
    ) -> bytes:
        """
        Generate speech from text using Voicebox TTS.
        
        Args:
            text: Text to synthesize
            profile_id: Voice profile ID (uses default if not provided)
            language: Language code (ru, en, de, fr, es, it, ja, ko, zh, pt)
            seed: Random seed for reproducibility
            instruct: Instruction prompt for style/emotion
            model_size: Model size (1.7B or 0.6B)
            stream: If True, use streaming endpoint
            
        Returns:
            WAV audio bytes
            
        Raises:
            ValueError: If profile not found or generation fails
        """
        profile_id = profile_id or self.default_profile_id
        language = language or self.default_language
        model_size = model_size or self.default_model_size
        
        if not profile_id:
            raise ValueError("profile_id is required (set default or provide explicitly)")
        
        session = await self._get_session()
        
        # Prepare request payload
        payload = {
            "profile_id": profile_id,
            "text": text,
            "language": language,
            "model_size": model_size,
        }
        
        if seed is not None:
            payload["seed"] = seed
        if instruct is not None:
            payload["instruct"] = instruct
        
        endpoint = "/generate/stream" if stream else "/generate"
        
        logger.info(
            f"Generating speech: profile={profile_id}, "
            f"text_len={len(text)}, language={language}, model={model_size}"
        )
        
        try:
            async with session.post(
                f"{self.base_url}{endpoint}",
                json=payload,
                headers={"Content-Type": "application/json"},
            ) as response:
                if response.status == 200:
                    audio_bytes = await response.read()
                    logger.info(f"Generated {len(audio_bytes)} bytes of audio")
                    return audio_bytes
                elif response.status == 202:
                    # Model is being downloaded
                    error_data = await response.json()
                    logger.warning(f"Model downloading: {error_data}")
                    raise ValueError(
                        f"Model {model_size} is being downloaded. "
                        f"Please wait and try again."
                    )
                else:
                    error_text = await response.text()
                    logger.error(f"Generation failed: {response.status} - {error_text}")
                    raise ValueError(f"Generation failed: {response.status} - {error_text}")
                    
        except aiohttp.ClientError as e:
            logger.exception(f"Voicebox API error: {e}")
            raise ValueError(f"Voicebox API connection error: {e}")
        except asyncio.TimeoutError:
            logger.error("Voicebox generation timeout")
            raise ValueError("Voicebox generation timeout (>60s)")

    async def generate_and_stream(
        self,
        text: str,
        profile_id: Optional[str] = None,
        language: Optional[str] = None,
        on_audio_chunk: Optional[Callable[[bytes], None]] = None,
    ) -> None:
        """
        Generate speech and stream audio chunks via callback.
        
        For full-duplex scenarios where you want to start playing
        audio before generation completes.
        
        Args:
            text: Text to synthesize
            profile_id: Voice profile ID
            language: Language code
            on_audio_chunk: Async callback for each audio chunk
        """
        profile_id = profile_id or self.default_profile_id
        language = language or self.default_language
        
        if not profile_id:
            raise ValueError("profile_id is required")
        
        session = await self._get_session()
        
        payload = {
            "profile_id": profile_id,
            "text": text,
            "language": language,
            "model_size": self.default_model_size,
        }
        
        logger.info(f"Streaming speech: profile={profile_id}, text_len={len(text)}")
        
        try:
            # Use streaming endpoint
            async with session.post(
                f"{self.base_url}/generate/stream",
                json=payload,
            ) as response:
                if response.status == 200:
                    # Read chunks as they arrive
                    async for chunk in response.content.iter_chunked(4096):
                        if on_audio_chunk:
                            await on_audio_chunk(chunk)
                    logger.info("Streaming complete")
                else:
                    error_text = await response.text()
                    raise ValueError(f"Streaming failed: {response.status} - {error_text}")
                    
        except Exception as e:
            logger.exception(f"Streaming error: {e}")
            raise

    async def create_profile(
        self,
        name: str,
        language: str = "en",
        description: Optional[str] = None,
    ) -> dict:
        """
        Create a new voice profile.
        
        Args:
            name: Profile name
            language: Language code
            description: Optional description
            
        Returns:
            Created profile dict with id
        """
        session = await self._get_session()
        
        payload = {
            "name": name,
            "language": language,
        }
        if description:
            payload["description"] = description
        
        try:
            async with session.post(
                f"{self.base_url}/profiles",
                json=payload,
            ) as response:
                if response.status == 200:
                    profile = await response.json()
                    logger.info(f"Created voice profile: {profile['id']} - {name}")
                    return profile
                else:
                    error_text = await response.text()
                    logger.error(f"Profile creation failed: {error_text}")
                    raise ValueError(f"Failed to create profile: {error_text}")
        except Exception as e:
            logger.exception(f"Error creating profile: {e}")
            raise

    async def add_sample_to_profile(
        self,
        profile_id: str,
        audio_file_path: str,
        reference_text: str,
    ) -> dict:
        """
        Add audio sample to a voice profile for cloning.
        
        Args:
            profile_id: Profile ID
            audio_file_path: Path to audio file (WAV/MP3)
            reference_text: Text spoken in the audio
            
        Returns:
            Sample dict with id
        """
        session = await self._get_session()
        
        # Read audio file
        with open(audio_file_path, "rb") as f:
            audio_data = f.read()
        
        # Use FormData for multipart upload
        form_data = aiohttp.FormData()
        form_data.add_field(
            "file",
            audio_data,
            filename="sample.wav",
            content_type="audio/wav",
        )
        form_data.add_field("reference_text", reference_text)
        
        try:
            async with session.post(
                f"{self.base_url}/profiles/{profile_id}/samples",
                data=form_data,
            ) as response:
                if response.status == 200:
                    sample = await response.json()
                    logger.info(f"Added sample to profile {profile_id}: {sample['id']}")
                    return sample
                else:
                    error_text = await response.text()
                    logger.error(f"Sample upload failed: {error_text}")
                    raise ValueError(f"Failed to add sample: {error_text}")
        except Exception as e:
            logger.exception(f"Error adding sample: {e}")
            raise

    async def get_model_status(self) -> dict:
        """
        Get model download and load status.
        
        Returns:
            dict with model status information
        """
        session = await self._get_session()
        try:
            async with session.get(f"{self.base_url}/models") as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {"models": []}
        except Exception as e:
            logger.exception(f"Error getting model status: {e}")
            return {"models": []}


# Singleton instance for reuse
_voicebox_service: Optional[VoiceboxService] = None


def get_voicebox_service() -> VoiceboxService:
    """
    Get or create Voicebox service singleton.
    
    Returns:
        VoiceboxService instance
    """
    global _voicebox_service
    if _voicebox_service is None:
        from app.core.config import settings
        
        _voicebox_service = VoiceboxService(
            base_url=settings.VOICEBOX_API_URL,
            default_profile_id=settings.VOICEBOX_DEFAULT_PROFILE_ID,
            default_language=settings.VOICEBOX_DEFAULT_LANGUAGE,
            default_model_size=settings.VOICEBOX_MODEL_SIZE,
            timeout_seconds=settings.VOICEBOX_TIMEOUT_SECONDS,
        )
        logger.info("Created Voicebox service singleton")
    return _voicebox_service


async def close_voicebox_service() -> None:
    """Close Voicebox service session."""
    global _voicebox_service
    if _voicebox_service:
        await _voicebox_service.close()
        _voicebox_service = None
        logger.info("Closed Voicebox service singleton")
