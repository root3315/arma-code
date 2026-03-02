# Voicebox TTS Integration Guide

**Local Text-to-Speech using Qwen3-TTS**

This document describes how to use Voicebox as a local, free alternative to OpenAI TTS for the EduPlatform voice chat system.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Performance on CPU](#performance-on-cpu)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**Voicebox** is a local TTS (Text-to-Speech) system based on the Qwen3-TTS model. It provides:

- ✅ **Free and open-source** (MIT License)
- ✅ **Runs locally** on your CPU (no GPU required)
- ✅ **Voice cloning** support (create custom voice profiles)
- ✅ **Multi-language** (RU, EN, DE, FR, ES, IT, JA, KO, ZH, PT)
- ✅ **Privacy** (all processing happens on your machine)

### Comparison: OpenAI vs Voicebox

| Feature | OpenAI Realtime API | Voicebox (Qwen3-TTS) |
|---------|---------------------|----------------------|
| **Type** | Full-duplex (STT + LLM + TTS) | TTS only |
| **Cost** | Paid (per token) | Free |
| **Latency** | 300-500ms | 2000-4000ms (CPU) |
| **Voice Quality** | Excellent | Very Good |
| **Voice Cloning** | Limited | Full support |
| **Internet Required** | Yes | No |
| **GPU Required** | No | No (optimized for CPU) |

---

## 🏗️ Architecture

### OpenAI Realtime Mode
```
Browser (WebSocket) ↔ FastAPI ↔ OpenAI API (STT + LLM + TTS)
```

### Voicebox Mode (Hybrid)
```
Browser (WebSocket) ↔ FastAPI ↔ OpenAI API (STT + LLM)
                              ↓
                        Voicebox API (TTS only)
```

**Important:** Voicebox only handles TTS (text-to-speech). You still need:
- **OpenAI API** (or another LLM) for conversation intelligence
- **Whisper** (or another STT) for speech-to-text
- **Voicebox** for high-quality local TTS

---

## 📦 Installation

### 1. Install Voicebox Backend

```bash
cd /home/kali/arma-code-workspace

# Clone Voicebox repository
git clone https://github.com/jamiepine/voicebox.git voicebox-local

cd voicebox-local

# Install Python dependencies
pip install -r requirements.txt

# Install Rust (required for some dependencies)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Bun (for frontend, optional for backend-only use)
curl -fsSL https://bun.sh/install | bash
```

### 2. Download TTS Model

The model will be downloaded automatically on first use (~3GB for 1.7B model).

Or pre-download manually:
```bash
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen3-TTS-12Hz-1.7B-Base')"
```

### 3. Optimize for CPU (Xeon Gold 16-core)

```bash
# Set environment variables for CPU optimization
export OMP_NUM_THREADS=16
export MKL_NUM_THREADS=16
export KMP_AFFINITY=granularity=fine,compact,1,0
```

---

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Voice Provider: "openai" or "voicebox"
VOICE_PROVIDER=voicebox

# Voicebox Backend URL
VOICEBOX_API_URL=http://localhost:8001

# Default Voice Profile (create via Voicebox API first)
VOICEBOX_DEFAULT_PROFILE_ID=<profile-id>

# Default Language (ru, en, de, fr, es, it, ja, ko, zh, pt)
VOICEBOX_DEFAULT_LANGUAGE=en

# Model Size: 1.7B (better) or 0.6B (faster)
VOICEBOX_MODEL_SIZE=1.7B

# Generation Timeout (seconds)
VOICEBOX_TIMEOUT_SECONDS=60
```

### Start Voicebox Backend

```bash
cd /home/kali/arma-code-workspace/voicebox-local

# Set CPU optimization
export OMP_NUM_THREADS=16

# Start backend server on port 8001
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8001 --reload
```

### Start EduPlatform Backend

```bash
cd /home/kali/arma-code-workspace/backend

# Activate virtual environment
source venv/bin/activate

# Start FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```

---

## 🎯 Usage

### 1. Create a Voice Profile

```bash
curl -X POST http://localhost:8001/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Voice",
    "language": "en",
    "description": "Custom voice profile"
  }'
```

Response:
```json
{
  "id": "profile-uuid-here",
  "name": "My Voice",
  "language": "en",
  "created_at": "2026-03-02T..."
}
```

### 2. Add Voice Sample

Record yourself speaking and save as `sample.wav`, then:

```bash
curl -X POST "http://localhost:8001/profiles/profile-uuid-here/samples" \
  -F "file=@sample.wav" \
  -F "reference_text=This is a sample of my voice for cloning."
```

### 3. Generate Speech

```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "profile-uuid-here",
    "text": "Hello! This is my custom voice speaking.",
    "language": "en",
    "model_size": "1.7B"
  }' \
  --output speech.wav
```

### 4. Use in Voice Chat

Connect to the voice chat WebSocket with `provider=voicebox`:

```javascript
const ws = new WebSocket(
  `ws://localhost:8000/api/v1/voice/chat?token=${jwt}&provider=voicebox`
);

ws.onopen = () => {
  console.log('Connected to Voicebox voice chat');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'ready') {
    console.log('Voicebox ready:', data);
  }
};
```

---

## ⚡ Performance on CPU

### Your Hardware
- **CPU:** 16-core Xeon Gold
- **RAM:** 24 GB
- **OS:** Ubuntu 24.04 LTS (VMware VM)

### Expected Performance

| Text Length | Generation Time | Real-Time Factor |
|-------------|----------------|------------------|
| Short phrase (5 sec) | 2-4 seconds | 0.4x - 0.8x |
| Medium (30 sec) | 25-35 seconds | 0.8x - 1.2x |
| Long (1 min) | 50-70 seconds | 0.8x - 1.2x |

### Optimization Tips

1. **Set CPU threads:**
   ```bash
   export OMP_NUM_THREADS=16
   ```

2. **Use smaller model for speed:**
   ```bash
   VOICEBOX_MODEL_SIZE=0.6B
   ```

3. **Enable AVX-512 in VMware:**
   - VM Settings → CPU → Enable AVX-512 passthrough

4. **Monitor performance:**
   ```bash
   # Check health and model status
   curl http://localhost:8001/health
   ```

---

## 🔧 Troubleshooting

### Voicebox won't start

```bash
# Check if port 8001 is in use
lsof -i :8001

# Kill existing process
kill -9 $(lsof -t -i:8001)

# Restart Voicebox
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8001
```

### Model download fails

```bash
# Manually download model
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen3-TTS-1.7B-Base')"

# Check HuggingFace cache
ls ~/.cache/huggingface/hub/
```

### "Profile not found" error

```bash
# List available profiles
curl http://localhost:8001/profiles

# Create new profile if empty
curl -X POST http://localhost:8001/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "Default", "language": "en"}'
```

### Slow generation

1. Check CPU usage: `htop`
2. Verify OMP_NUM_THREADS is set: `echo $OMP_NUM_THREADS`
3. Try smaller model: `VOICEBOX_MODEL_SIZE=0.6B`
4. Close other CPU-intensive applications

### Voice quality issues

1. **Add more samples:** Add 3-5 voice samples for better cloning
2. **Use high-quality audio:** WAV format, 24kHz, mono
3. **Clear reference text:** Ensure reference text matches audio exactly

---

## 📊 API Endpoints

### Voicebox Backend (port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/profiles` | List voice profiles |
| POST | `/profiles` | Create profile |
| POST | `/profiles/{id}/samples` | Add voice sample |
| POST | `/generate` | Generate speech |
| POST | `/generate/stream` | Stream speech |

### EduPlatform Voice API (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/api/v1/voice/chat` | Voice chat WebSocket |
| GET | `/api/v1/voice/providers` | List providers |
| GET | `/api/v1/voice/profiles` | List voice profiles |

---

## 📝 Logs and Monitoring

### Enable verbose logging

```bash
# Voicebox logs
export LOG_LEVEL=DEBUG
python -m uvicorn backend.server:app --log-level debug

# EduPlatform logs
export LOG_LEVEL=DEBUG
python -m uvicorn app.main:app --log-level debug
```

### Check generation time

The service logs include timing information:
```
INFO - Generating speech: profile=uuid, text_len=150, language=en
INFO - Generated 245000 bytes of audio
INFO - Generation completed in 3.2 seconds
```

---

## 🚀 Next Steps

1. **Create voice profiles** for each speaker you want to clone
2. **Test generation** with short texts first
3. **Monitor performance** and adjust OMP_NUM_THREADS
4. **Integrate with frontend** using the WebSocket API
5. **Set up auto-start** with systemd or Docker

---

**Version:** 1.0.0  
**Last Updated:** March 2, 2026  
**Author:** EduPlatform Team
