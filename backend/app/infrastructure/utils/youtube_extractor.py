"""
YouTube text extraction utilities.

Handles transcript extraction via subtitles or Whisper API fallback,
audio downloading with multi-strategy fallback, and audio processing.
"""
import logging
import os
import re
import shutil
import tempfile
from typing import Optional, List
from xml.etree.ElementTree import ParseError as XMLParseError

import yt_dlp
from openai import OpenAI
from pydub import AudioSegment
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    YouTubeRequestFailed,
)

from app.core.config import settings

logger = logging.getLogger(__name__)
_redis_client = None
WHISPER_DIRECT_EXTENSIONS = {
    ".flac",
    ".m4a",
    ".mp3",
    ".mpeg",
    ".mpga",
    ".oga",
    ".ogg",
    ".wav",
    ".webm",
}


def _log_extra(video_id: str = "unknown", **kwargs) -> dict:
    """Build structured extra dict for all YouTube log calls."""
    return {"video_id": video_id, **kwargs}


def _get_redis_client():
    """Lazily initialize sync Redis client for fast transcript caching."""
    global _redis_client
    if _redis_client is None:
        try:
            import redis
            _redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            _redis_client.ping()
        except Exception as e:
            logger.warning(f"[YouTube] Redis transcript cache unavailable: {e}")
            _redis_client = False
    return _redis_client if _redis_client is not False else None


def _get_cached_transcript(video_id: str) -> Optional[str]:
    redis_client = _get_redis_client()
    if not redis_client:
        return None

    try:
        return redis_client.get(f"youtube:transcript:{video_id}")
    except Exception:
        return None


def _set_cached_transcript(video_id: str, transcript: str, ttl: int = 7 * 24 * 3600) -> None:
    redis_client = _get_redis_client()
    if not redis_client:
        return

    try:
        redis_client.setex(f"youtube:transcript:{video_id}", ttl, transcript)
    except Exception:
        pass


def _list_available_transcripts(video_id: str):
    """
    Return transcript list object across youtube-transcript-api versions.

    Older releases expose ``YouTubeTranscriptApi.list_transcripts(video_id)``.
    Newer releases expose ``YouTubeTranscriptApi().list(video_id)``.
    """
    if hasattr(YouTubeTranscriptApi, "list_transcripts"):
        return YouTubeTranscriptApi.list_transcripts(video_id)

    api = YouTubeTranscriptApi()
    if hasattr(api, "list"):
        return api.list(video_id)

    raise AttributeError("Unsupported youtube_transcript_api version: no transcript listing method found")


def _parse_vtt_to_text(vtt_text: str) -> str:
    """Extract plain transcript text from a VTT subtitle payload."""
    lines: List[str] = []
    previous = ""

    for raw_line in vtt_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "WEBVTT":
            continue
        if "-->" in line:
            continue
        if line.isdigit():
            continue

        cleaned = re.sub(r"<[^>]+>", "", line).strip()
        if not cleaned or cleaned == previous:
            continue

        previous = cleaned
        lines.append(cleaned)

    return " ".join(lines).strip()


def _download_subtitles_with_ytdlp(url: str, video_id: str, language: str = "en") -> Optional[str]:
    """
    Download subtitles-only via yt-dlp.

    This is much cheaper than audio fallback and works on hosts where transcript
    XML fetch is flaky but subtitle download still succeeds.
    """
    temp_dir = tempfile.mkdtemp(prefix=f"yt_subs_{video_id}_")
    try:
        outtmpl = os.path.join(temp_dir, "%(id)s.%(ext)s")
        ydl_opts = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": [language, "en", "ru"],
            "subtitlesformat": "vtt",
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 20,
            "retries": 2,
            "nocheckcertificate": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            dl_video_id = info.get("id", video_id)

        subtitle_files = [
            os.path.join(temp_dir, name)
            for name in os.listdir(temp_dir)
            if name.startswith(dl_video_id) and name.endswith(".vtt")
        ]
        if not subtitle_files:
            return None

        with open(subtitle_files[0], "r", encoding="utf-8") as f:
            subtitle_text = f.read()

        parsed_text = _parse_vtt_to_text(subtitle_text)
        return parsed_text or None

    except Exception as e:
        logger.warning(
            f"[YouTube:{video_id}] yt-dlp subtitle fallback failed: {type(e).__name__}: {e}",
            exc_info=True,
            extra=_log_extra(video_id=video_id, strategy="subtitle_download", error_type=type(e).__name__),
        )
        return None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

# Initialize OpenAI client for Whisper
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Whisper API limits
WHISPER_MAX_FILE_SIZE = 24 * 1024 * 1024  # 24 MB (safe margin from 25 MB limit)
WHISPER_TARGET_BITRATE = "48k"  # Target bitrate for compression


def extract_youtube_video_id(url: str) -> Optional[str]:
    """
    Extract video ID from YouTube URL.

    Supports formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID

    Args:
        url: YouTube URL

    Returns:
        Video ID or None if not found
    """
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def download_youtube_audio(url: str, output_path: Optional[str] = None) -> str:
    """
    Download audio from YouTube video with multiple fallback strategies.

    Args:
        url: YouTube video URL
        output_path: Optional path to save audio file

    Returns:
        Path to downloaded audio file

    Raises:
        ValueError: If download fails
    """
    video_id = extract_youtube_video_id(url) or "unknown"
    logger.info(f"[YouTube:{video_id}] Downloading audio from: {url}")

    if output_path is None:
        output_path = tempfile.mkdtemp()

    # Strategy 1: iOS client (most reliable, bypasses most restrictions)
    # Updated: Don't skip HLS/DASH, add missing_pot for formats requiring PO token
    # Format: Prioritize audio-only formats, fallback to mp4 with audio (format 18)
    ydl_opts_ios = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/best[acodec!=none][ext=mp4]/best[acodec!=none]/bestaudio',
        'outtmpl': os.path.join(output_path, '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['ios'],
                'formats': 'missing_pot',  # Enable formats even without PO token
            }
        },
        'socket_timeout': 30,
        'retries': 5,
        'fragment_retries': 5,
        'nocheckcertificate': True,
    }

    # Strategy 2: Android client with enhanced headers
    # Updated: Don't skip HLS/DASH, add missing_pot for formats requiring PO token
    ydl_opts_android = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/best[acodec!=none][ext=mp4]/best[acodec!=none]/bestaudio',
        'outtmpl': os.path.join(output_path, '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'http_headers': {
            'User-Agent': 'com.google.android.youtube/19.51.37 (Linux; U; Android 14) gzip',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['android'],
                'formats': 'missing_pot',  # Enable formats even without PO token
            }
        },
        'socket_timeout': 30,
        'retries': 5,
        'fragment_retries': 5,
        'nocheckcertificate': True,
    }

    # Strategy 3: Web client with cookies (fallback)
    # Updated: Don't skip HLS/DASH for better format availability
    ydl_opts_web = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/best[acodec!=none][ext=mp4]/best[acodec!=none]/bestaudio',
        'outtmpl': os.path.join(output_path, '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['web'],
            }
        },
        'socket_timeout': 30,
        'retries': 5,
        'fragment_retries': 5,
        'nocheckcertificate': True,
        'age_limit': None,
        'geo_bypass': True,
    }

    strategies = [
        ('iOS client', ydl_opts_ios),
        ('Android client', ydl_opts_android),
        ('Web client', ydl_opts_web),
    ]

    last_error = None
    for strategy_name, ydl_opts in strategies:
        try:
            logger.info(f"[YouTube:{video_id}] Strategy: {strategy_name}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                dl_video_id = info['id']

                possible_exts = ['m4a', 'webm', 'opus', 'mp4', 'mp3', 'ogg']
                audio_file = None

                for ext in possible_exts:
                    potential_file = os.path.join(output_path, f"{dl_video_id}.{ext}")
                    if os.path.exists(potential_file):
                        audio_file = potential_file
                        break

                if not audio_file:
                    for filename in os.listdir(output_path):
                        if filename.startswith(dl_video_id):
                            audio_file = os.path.join(output_path, filename)
                            break

                if not audio_file or not os.path.exists(audio_file):
                    raise ValueError(f"Downloaded file not found in {output_path}")

                logger.info(f"[YouTube:{video_id}] ✓ Downloaded via {strategy_name}: {audio_file}")
                return audio_file

        except Exception as e:
            logger.warning(
                f"[YouTube:{video_id}] ✗ {strategy_name} failed: {type(e).__name__}: {str(e)}",
                exc_info=True,
                extra=_log_extra(
                    video_id=video_id,
                    strategy=strategy_name,
                    error_type=type(e).__name__,
                ),
            )
            last_error = e
            continue

    logger.error(
        f"[YouTube:{video_id}] All download strategies failed. "
        f"Last error: {type(last_error).__name__}: {str(last_error)}",
        exc_info=True,
        extra=_log_extra(
            video_id=video_id,
            error_type=type(last_error).__name__ if last_error else "unknown",
            strategies_tried=[s for s, _ in strategies],
        ),
    )
    raise ValueError(
        f"[YouTube:{video_id}] Failed to download audio after trying all strategies: {str(last_error)}"
    )


def compress_audio(input_path: str, output_path: str, bitrate: str = WHISPER_TARGET_BITRATE) -> str:
    """
    Compress audio file to reduce size.

    Args:
        input_path: Path to input audio file
        output_path: Path to save compressed audio
        bitrate: Target bitrate (default: 48k)

    Returns:
        Path to compressed audio file

    Raises:
        ValueError: If compression fails
    """
    try:
        original_size = os.path.getsize(input_path)
        logger.info(
            f"Compressing audio: {input_path} -> {output_path} (bitrate: {bitrate})",
            extra={"input_size_mb": round(original_size / 1024 / 1024, 2), "bitrate": bitrate},
        )

        audio = AudioSegment.from_file(input_path)
        audio.export(
            output_path,
            format="mp3",
            bitrate=bitrate,
            parameters=["-ac", "1"]
        )

        compressed_size = os.path.getsize(output_path)
        compression_ratio = (1 - compressed_size / original_size) * 100

        logger.info(
            f"✓ Compressed: {original_size / 1024 / 1024:.2f} MB -> "
            f"{compressed_size / 1024 / 1024:.2f} MB ({compression_ratio:.1f}% reduction)",
            extra={
                "original_size_mb": round(original_size / 1024 / 1024, 2),
                "compressed_size_mb": round(compressed_size / 1024 / 1024, 2),
                "compression_ratio_pct": round(compression_ratio, 1),
            },
        )

        return output_path

    except Exception as e:
        logger.error(
            f"Failed to compress audio: {str(e)}",
            exc_info=True,
            extra={"input_path": input_path, "error_type": type(e).__name__},
        )
        raise ValueError(f"Audio compression failed: {str(e)}")


def split_audio_file(input_path: str, output_dir: str, max_size_bytes: int = WHISPER_MAX_FILE_SIZE) -> List[str]:
    """
    Split audio file into chunks if it exceeds max size.

    Args:
        input_path: Path to input audio file
        output_dir: Directory to save chunks
        max_size_bytes: Maximum size per chunk in bytes

    Returns:
        List of paths to audio chunks (or [input_path] if no split needed)

    Raises:
        ValueError: If splitting fails
    """
    try:
        file_size = os.path.getsize(input_path)

        if file_size <= max_size_bytes:
            logger.info(
                f"File size {file_size / 1024 / 1024:.2f} MB is within limit, no splitting needed",
                extra={"file_size_mb": round(file_size / 1024 / 1024, 2)},
            )
            return [input_path]

        logger.info(
            f"File size {file_size / 1024 / 1024:.2f} MB exceeds limit, splitting...",
            extra={"file_size_mb": round(file_size / 1024 / 1024, 2), "max_size_mb": round(max_size_bytes / 1024 / 1024, 2)},
        )

        audio = AudioSegment.from_file(input_path)
        duration_ms = len(audio)

        bytes_per_ms = file_size / duration_ms
        chunk_duration_ms = int(max_size_bytes / bytes_per_ms * 0.9)

        chunk_paths = []

        for i, start_ms in enumerate(range(0, duration_ms, chunk_duration_ms)):
            end_ms = min(start_ms + chunk_duration_ms, duration_ms)
            chunk = audio[start_ms:end_ms]

            chunk_path = os.path.join(output_dir, f"chunk_{i:03d}.mp3")
            chunk.export(chunk_path, format="mp3")
            chunk_paths.append(chunk_path)

            chunk_size = os.path.getsize(chunk_path)
            logger.info(
                f"Created chunk {i + 1}: {chunk_size / 1024 / 1024:.2f} MB "
                f"({start_ms / 1000:.1f}s - {end_ms / 1000:.1f}s)",
                extra={
                    "chunk_index": i + 1,
                    "chunk_size_mb": round(chunk_size / 1024 / 1024, 2),
                    "start_sec": round(start_ms / 1000, 1),
                    "end_sec": round(end_ms / 1000, 1),
                },
            )

        logger.info(
            f"✓ Split into {len(chunk_paths)} chunks",
            extra={"total_chunks": len(chunk_paths)},
        )
        return chunk_paths

    except Exception as e:
        logger.error(
            f"Failed to split audio: {str(e)}",
            exc_info=True,
            extra={"input_path": input_path, "error_type": type(e).__name__},
        )
        raise ValueError(f"Audio splitting failed: {str(e)}")


def transcribe_audio_with_whisper(audio_file_path: str) -> str:
    """
    Transcribe audio file using OpenAI Whisper API with automatic compression and chunking.

    Strategy:
    1. Check file size
    2. If > 24 MB -> compress to 48k bitrate
    3. If still > 24 MB after compression -> split into chunks
    4. Transcribe each chunk
    5. Combine results

    Args:
        audio_file_path: Path to audio file

    Returns:
        Transcribed text

    Raises:
        ValueError: If transcription fails
    """
    logger.info(f"Transcribing audio with Whisper API: {audio_file_path}")

    temp_files_to_cleanup = []

    try:
        original_size = os.path.getsize(audio_file_path)
        logger.info(f"Original audio file size: {original_size / 1024 / 1024:.2f} MB")

        current_file = audio_file_path

        # Step 1: Compress if file is too large
        if original_size > WHISPER_MAX_FILE_SIZE:
            logger.info(f"File exceeds {WHISPER_MAX_FILE_SIZE / 1024 / 1024:.0f} MB limit, compressing...")

            file_dir = os.path.dirname(audio_file_path)
            compressed_path = os.path.join(file_dir, "compressed_audio.mp3")

            compress_audio(audio_file_path, compressed_path)
            temp_files_to_cleanup.append(compressed_path)

            current_file = compressed_path
            compressed_size = os.path.getsize(compressed_path)
            logger.info(f"Compressed file size: {compressed_size / 1024 / 1024:.2f} MB")

        # Step 2: Check if we need to split
        current_size = os.path.getsize(current_file)

        if current_size > WHISPER_MAX_FILE_SIZE:
            logger.info(f"File still exceeds limit after compression, splitting into chunks...")

            file_dir = os.path.dirname(current_file)
            chunk_paths = split_audio_file(current_file, file_dir)
            temp_files_to_cleanup.extend(chunk_paths)

            logger.info(f"Transcribing {len(chunk_paths)} chunks...")
            transcripts = []

            for i, chunk_path in enumerate(chunk_paths, 1):
                logger.info(f"Transcribing chunk {i}/{len(chunk_paths)}...")

                with open(chunk_path, 'rb') as audio_file:
                    chunk_transcript = openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )

                transcripts.append(chunk_transcript)
                logger.info(f"✓ Chunk {i} transcribed: {len(chunk_transcript)} characters")

            full_transcript = " ".join(transcripts)
            logger.info(f"✓ All chunks transcribed successfully: {len(full_transcript)} total characters")

        else:
            logger.info(f"File size is within limit, transcribing directly...")

            with open(current_file, 'rb') as audio_file:
                full_transcript = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )

            logger.info(f"✓ Successfully transcribed: {len(full_transcript)} characters")

        return full_transcript

    except Exception as e:
        logger.error(
            f"Error transcribing audio with Whisper: {str(e)}",
            exc_info=True,
            extra={"audio_file_path": audio_file_path, "error_type": type(e).__name__},
        )
        raise ValueError(f"Failed to transcribe audio: {str(e)}")

    finally:
        for temp_file in temp_files_to_cleanup:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.debug(f"Cleaned up temporary file: {temp_file}")
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to cleanup {temp_file}: {cleanup_error}",
                        exc_info=True,
                        extra={"temp_file": temp_file, "error_type": type(cleanup_error).__name__},
                    )


def extract_text_from_youtube(url: str, language: str = 'ru') -> str:
    """
    Extract transcript from YouTube video.

    Multi-tier fallback strategy:
    1. Try to get subtitles in preferred languages (ru, en)
    2. Try to get any available transcript and translate to English
    3. If subtitles unavailable, download audio and use Whisper API
    4. If all fail, raise error

    Args:
        url: YouTube video URL
        language: Preferred language code (default: 'ru')

    Returns:
        Extracted transcript text

    Raises:
        ValueError: If video ID cannot be extracted or transcript not available
    """
    video_id = extract_youtube_video_id(url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {url}")

    logger.info(f"[YouTube:{video_id}] Extracting transcript from: {url}")

    cached_transcript = _get_cached_transcript(video_id)
    if cached_transcript:
        logger.info(f"[YouTube:{video_id}] Cache hit for transcript ({len(cached_transcript)} chars)")
        return cached_transcript

    # Strategy 1: Try to get subtitles
    try:
        logger.info(f"[YouTube:{video_id}] Strategy 1: Attempting to get subtitles...")
        transcript_list = _list_available_transcripts(video_id)

        transcript_candidates = []
        seen_candidates = set()

        def add_candidate(candidate):
            if candidate is None:
                return
            candidate_key = (
                getattr(candidate, "language_code", None),
                getattr(candidate, "is_generated", None),
                getattr(candidate, "is_translatable", None),
            )
            if candidate_key in seen_candidates:
                return
            seen_candidates.add(candidate_key)
            transcript_candidates.append(candidate)

        # Step 1a: Try manual transcripts in preferred languages first
        try:
            add_candidate(
                transcript_list.find_manually_created_transcript([language, 'en', 'ru'])
            )
        except Exception:
            pass

        # Step 1b: Try auto-generated transcripts
        try:
            add_candidate(
                transcript_list.find_generated_transcript([language, 'en', 'ru'])
            )
        except Exception:
            pass

        # Step 1c: Try any available transcript and translate
        available_transcripts = list(transcript_list)
        for available in available_transcripts:
            add_candidate(available)

        if not transcript_candidates:
            raise NoTranscriptFound(video_id, ['ru', 'en'], None)

        transcript_provider_failed = False
        for transcript in transcript_candidates:
            try:
                logger.info(
                    f"[YouTube:{video_id}] Trying transcript candidate "
                    f"{transcript.language_code} (generated={getattr(transcript, 'is_generated', False)})"
                )
                transcript_data = transcript.fetch()

                if not transcript_data or len(transcript_data) == 0:
                    raise ValueError(f"[YouTube:{video_id}] Transcript data is empty")

                full_text = ' '.join([entry.get('text', '') for entry in transcript_data if entry.get('text')])

                if not full_text or len(full_text.strip()) < 10:
                    raise ValueError(
                        f"[YouTube:{video_id}] Extracted text too short: {len(full_text)} characters"
                    )

                _set_cached_transcript(video_id, full_text)
                logger.info(
                    f"[YouTube:{video_id}] ✓ Strategy 1 successful: "
                    f"{len(full_text)} characters from subtitles"
                )
                return full_text

            except (XMLParseError, YouTubeRequestFailed) as fetch_error:
                logger.warning(
                    f"[YouTube:{video_id}] Failed to fetch transcript candidate: "
                    f"{type(fetch_error).__name__}: {str(fetch_error)}",
                    exc_info=True,
                    extra=_log_extra(video_id=video_id, error_type=type(fetch_error).__name__),
                )
                # On some hosts YouTube transcript XML endpoints are flaky or blocked.
                # Fall through to subtitle download fallback instead of hanging on more candidates.
                transcript_provider_failed = True
                break

            except ValueError as fetch_error:
                logger.warning(
                    f"[YouTube:{video_id}] Failed to fetch transcript candidate: "
                    f"{type(fetch_error).__name__}: {str(fetch_error)}",
                    exc_info=True,
                    extra=_log_extra(video_id=video_id, error_type=type(fetch_error).__name__),
                )

        logger.info(f"[YouTube:{video_id}] Strategy 1b: Attempting subtitle-only yt-dlp fallback...")
        subtitle_fallback_text = _download_subtitles_with_ytdlp(url, video_id, language=language)
        if subtitle_fallback_text and len(subtitle_fallback_text) >= 10:
            _set_cached_transcript(video_id, subtitle_fallback_text)
            logger.info(
                f"[YouTube:{video_id}] ✓ Strategy 1b successful: "
                f"{len(subtitle_fallback_text)} characters from yt-dlp subtitles"
            )
            return subtitle_fallback_text

        if transcript_provider_failed:
            raise ValueError("Transcript provider failed and subtitle download fallback returned no usable text")

        raise NoTranscriptFound(video_id, ['ru', 'en'], None)

    except (TranscriptsDisabled, NoTranscriptFound, XMLParseError, ValueError, YouTubeRequestFailed) as e:
        logger.warning(
            f"[YouTube:{video_id}] Strategy 1 failed: {type(e).__name__}: {str(e)}",
            extra=_log_extra(video_id=video_id, strategy="subtitles", error_type=type(e).__name__),
        )
        logger.info(f"[YouTube:{video_id}] Strategy 2: Attempting Whisper API...")

        # Strategy 2: Download audio and use Whisper
        temp_dir = None
        audio_file = None

        try:
            temp_dir = tempfile.mkdtemp()
            audio_file = download_youtube_audio(url, temp_dir)
            audio_ext = os.path.splitext(audio_file)[1].lower()

            if audio_ext not in WHISPER_DIRECT_EXTENSIONS:
                mp3_path = audio_file.rsplit('.', 1)[0] + '.mp3'
                logger.info(
                    f"[YouTube:{video_id}] Converting {audio_ext or 'unknown'} to mp3 for Whisper compatibility"
                )
                compress_audio(audio_file, mp3_path, '192k')
                audio_file = mp3_path

            full_text = transcribe_audio_with_whisper(audio_file)
            _set_cached_transcript(video_id, full_text)

            logger.info(
                f"[YouTube:{video_id}] ✓ Strategy 2 successful: "
                f"{len(full_text)} characters via Whisper"
            )
            return full_text

        except Exception as whisper_error:
            logger.error(
                f"[YouTube:{video_id}] Strategy 2 failed: "
                f"{type(whisper_error).__name__}: {str(whisper_error)}",
                exc_info=True,
                extra=_log_extra(
                    video_id=video_id,
                    strategy="whisper",
                    error_type=type(whisper_error).__name__,
                    subtitles_error=f"{type(e).__name__}: {str(e)}",
                ),
            )
            raise ValueError(
                f"[YouTube:{video_id}] All extraction failed. "
                f"Subtitles: {type(e).__name__}: {str(e)}. "
                f"Whisper: {type(whisper_error).__name__}: {str(whisper_error)}"
            )

        finally:
            if audio_file and os.path.exists(audio_file):
                try:
                    os.remove(audio_file)
                except Exception as cleanup_error:
                    logger.warning(
                        f"[YouTube:{video_id}] Cleanup failed: {cleanup_error}",
                        exc_info=True,
                        extra=_log_extra(video_id=video_id, audio_file=audio_file),
                    )

            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as cleanup_error:
                    logger.warning(
                        f"[YouTube:{video_id}] Cleanup temp dir failed: {cleanup_error}",
                        exc_info=True,
                        extra=_log_extra(video_id=video_id, temp_dir=temp_dir),
                    )

    except Exception as e:
        logger.error(
            f"[YouTube:{video_id}] Unexpected error: {type(e).__name__}: {str(e)}",
            exc_info=True,
            extra=_log_extra(video_id=video_id, error_type=type(e).__name__),
        )
        raise ValueError(f"[YouTube:{video_id}] Failed to extract transcript: {str(e)}")
