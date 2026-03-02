# Voicebox Integration Summary

## ✅ Completed Integration

Voicebox (Qwen3-TTS) has been successfully integrated as a local, free alternative to OpenAI TTS for the EduPlatform voice chat system.

---

## 📁 Files Created/Modified

### New Files

1. **`backend/app/infrastructure/ai/voicebox_service.py`**
   - Voicebox API client service
   - Async HTTP client for TTS generation
   - Voice profile management
   - Health checking and status monitoring

2. **`VOICEBOX_INTEGRATION.md`**
   - Complete integration guide
   - Installation instructions
   - Configuration reference
   - Performance optimization tips
   - Troubleshooting guide

3. **`scripts/start-voicebox.sh`**
   - Automated startup script for Voicebox backend
   - CPU optimization for 16-core Xeon Gold
   - Health checking and process management
   - Logging configuration

### Modified Files

1. **`backend/app/core/config.py`**
   - Added Voicebox configuration settings:
     - `VOICEBOX_API_URL`
     - `VOICEBOX_DEFAULT_PROFILE_ID`
     - `VOICEBOX_DEFAULT_LANGUAGE`
     - `VOICEBOX_MODEL_SIZE`
     - `VOICEBOX_TIMEOUT_SECONDS`
   - Added `Optional` import

2. **`backend/app/api/v1/endpoints/voice/voice_chat.py`**
   - Added Voicebox service import
   - Updated provider validation (supports "openai" and "voicebox")
   - Added Voicebox initialization and health checking
   - Updated WebSocket ready message with provider info
   - Enhanced providers endpoint with Voicebox details
   - Proper cleanup for Voicebox service

3. **`.env.example`**
   - Added Voicebox configuration section
   - Documented all Voicebox environment variables

---

## 🚀 Quick Start

### 1. Set Environment Variables

```bash
cd /home/kali/arma-code-workspace
cp .env.example .env

# Edit .env and set:
VOICE_PROVIDER=voicebox
VOICEBOX_API_URL=http://localhost:8001
VOICEBOX_DEFAULT_LANGUAGE=ru  # or en, de, fr, etc.
VOICEBOX_MODEL_SIZE=1.7B
```

### 2. Start Voicebox Backend

```bash
# Optimized for 16-core Xeon Gold
./scripts/start-voicebox.sh start
```

### 3. Start EduPlatform Backend

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

### 4. Create Voice Profile

```bash
# Create a voice profile
curl -X POST http://localhost:8001/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Default Voice",
    "language": "ru"
  }'

# Save the profile ID from response
PROFILE_ID="response-id-here"

# Update .env with profile ID
echo "VOICEBOX_DEFAULT_PROFILE_ID=$PROFILE_ID" >> .env
```

### 5. Test Generation

```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"profile_id\": \"$PROFILE_ID\",
    \"text\": \"Привет! Это тест голосового синтеза.\",
    \"language\": \"ru\",
    \"model_size\": \"1.7B\"
  }" \
  --output test.wav

# Play the audio
aplay test.wav  # Linux
# or
ffplay test.wav  # Cross-platform
```

---

## 📊 Architecture

### Voice Flow with Voicebox

```
┌─────────────┐
│   Browser   │
│  (WebSocket)│
└──────┬──────┘
       │
       │ Binary PCM16 Audio
       │ Control Messages
       │
┌──────▼──────────────────────────────────────┐
│         FastAPI (EduPlatform)               │
│  Port: 8000                                 │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  voice_chat WebSocket Endpoint      │   │
│  │                                     │   │
│  │  - Authentication                   │   │
│  │  - RAG Context                      │   │
│  │  - Provider Routing                 │   │
│  └─────────────┬───────────────────────┘   │
└────────────────┼───────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
         │                │
┌────────▼───────┐  ┌─────▼──────────┐
│  OpenAI API    │  │  Voicebox API  │
│  (LLM + STT)   │  │  (TTS only)    │
│  Port: 443     │  │  Port: 8001    │
│                │  │                │
│ - GPT-4o       │  │ - Qwen3-TTS    │
│ - Whisper      │  │ - Voice Clone  │
│ - Conversation │  │ - Multi-lang   │
└────────────────┘  └────────────────┘
```

---

## ⚡ Performance Expectations

### On Your Hardware (16-core Xeon Gold, 24GB RAM)

| Metric | Value |
|--------|-------|
| **Short phrase (5 sec)** | 2-4 seconds |
| **Medium text (30 sec)** | 25-35 seconds |
| **Long text (1 min)** | 50-70 seconds |
| **Real-Time Factor** | 0.8x - 1.2x |
| **First Token Latency** | 500-1000ms |
| **Memory Usage** | 3-5 GB |

### Optimization Applied

```bash
OMP_NUM_THREADS=16      # Use all 16 cores
MKL_NUM_THREADS=16      # Intel MKL optimization
KMP_AFFINITY=compact    # Thread affinity for VMware
```

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VOICE_PROVIDER` | `openai` | Provider: "openai" or "voicebox" |
| `VOICEBOX_API_URL` | `http://localhost:8001` | Voicebox backend URL |
| `VOICEBOX_DEFAULT_PROFILE_ID` | `None` | Default voice profile UUID |
| `VOICEBOX_DEFAULT_LANGUAGE` | `en` | Default language code |
| `VOICEBOX_MODEL_SIZE` | `1.7B` | Model: "1.7B" or "0.6B" |
| `VOICEBOX_TIMEOUT_SECONDS` | `60` | Generation timeout |

### Supported Languages

- `ru` - Russian
- `en` - English
- `de` - German
- `fr` - French
- `es` - Spanish
- `it` - Italian
- `ja` - Japanese
- `ko` - Korean
- `zh` - Chinese
- `pt` - Portuguese

---

## 📡 API Endpoints

### Voice Chat WebSocket

```
ws://localhost:8000/api/v1/voice/chat?token=<JWT>&provider=voicebox&materials=<UUIDs>
```

### List Providers

```bash
curl http://localhost:8000/api/v1/voice/providers
```

Response:
```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI Realtime API",
      "features": ["full-duplex", "vad", "whisper-transcript"]
    },
    {
      "id": "voicebox",
      "name": "Voicebox (Qwen3-TTS)",
      "features": ["local-tts", "voice-cloning", "cpu-optimized"],
      "backend_url": "http://localhost:8001",
      "model_size": "1.7B"
    }
  ],
  "default_provider": "voicebox"
}
```

### Voicebox Health

```bash
curl http://localhost:8001/health | python3 -m json.tool
```

---

## 🐛 Troubleshooting

### Issue: "Voicebox backend unhealthy"

**Solution:**
```bash
# Check if Voicebox is running
./scripts/start-voicebox.sh status

# Check logs
tail -f ~/arma-code-workspace/logs/voicebox_*.log

# Restart Voicebox
./scripts/start-voicebox.sh restart
```

### Issue: "Profile not found"

**Solution:**
```bash
# List profiles
curl http://localhost:8001/profiles

# Create new profile
curl -X POST http://localhost:8001/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "Default", "language": "ru"}'
```

### Issue: Slow generation

**Solution:**
1. Verify CPU threads: `echo $OMP_NUM_THREADS` (should be 16)
2. Use smaller model: `VOICEBOX_MODEL_SIZE=0.6B`
3. Close other CPU-intensive apps
4. Check VMware AVX-512 passthrough

### Issue: Model download fails

**Solution:**
```bash
# Manual download
python3 -c "from huggingface_hub import snapshot_download; \
  snapshot_download(repo_id='Qwen/Qwen3-TTS-12Hz-1.7B-Base')"

# Check cache
ls -la ~/.cache/huggingface/hub/
```

---

## 📝 Next Steps

1. **Test voice profile creation**
   - Record 3-5 voice samples
   - Upload to Voicebox API
   - Test generation quality

2. **Integrate with frontend**
   - Update WebSocket client to support `provider=voicebox`
   - Add voice profile selection UI
   - Show generation progress

3. **Monitor performance**
   - Check generation times in logs
   - Adjust OMP_NUM_THREADS if needed
   - Consider 0.6B model for speed

4. **Production deployment**
   - Set up systemd service for Voicebox
   - Configure auto-restart on failure
   - Add monitoring/alerting

---

## 📚 Documentation

- **Voicebox Integration Guide:** `VOICEBOX_INTEGRATION.md`
- **Startup Script:** `scripts/start-voicebox.sh`
- **Voicebox Original Docs:** `voicebox-local/README.md`

---

**Integration Date:** March 2, 2026  
**Status:** ✅ Complete and Ready for Testing  
**Syntax Check:** ✅ Passed (all Python files compile successfully)
