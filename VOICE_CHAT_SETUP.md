# 🎙️ Voice Chat Setup Guide

**Real-time Voice Chat with OpenAI Realtime API**

---

## 📋 Overview

The Voice Chat feature enables **full-duplex voice communication** with the AI tutor using OpenAI's Realtime API. Students can have natural conversations with the tutor about their study materials.

### Features

- ✅ **Full-duplex audio** - Speak and listen simultaneously
- ✅ **Voice Activity Detection (VAD)** - Automatic end-of-speech detection
- ✅ **Live transcription** - Real-time subtitles via Whisper
- ✅ **Interrupt AI** - Cut off the AI mid-response to ask follow-up questions
- ✅ **Push-to-talk mode** - Hold-to-talk option
- ✅ **Mute/unmute** - Without disconnecting
- ✅ **Material context** - AI tutor knows what you're studying
- ✅ **Multiple voice presets** - Choose from 6 OpenAI voices

---

## 🚀 Quick Start

### 1. Configure OpenAI API Key

**Prerequisites:**
- OpenAI account with **Tier 1+** access (minimum $5 top-up required for Realtime API)
- API key from: https://platform.openai.com/api-keys

**Setup:**
```bash
cd backend
nano .env
```

Add your API key:
```env
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=alloy
VOICE_PROVIDER=openai
```

### 2. Start Backend

```bash
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start Frontend

```bash
cd "Arma AI-Powered EdTech Interface Design"
npm run dev
```

### 4. Access Voice Chat

1. Open browser: `http://localhost:3000`
2. Navigate to **Voice Teacher** in sidebar (🎧 icon)
3. Click the **microphone button** to start session
4. Allow microphone access when prompted
5. Start talking!

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (React)                         │
│  VoiceTeacherView.tsx                                    │
│  - AudioWorklet (PCM16 24kHz capture)                    │
│  - WebSocket connection                                  │
│  - Audio playback                                        │
└────────────────────┬────────────────────────────────────┘
                     │ WS /api/v1/voice/chat/{material_id}
                     │ binary PCM16 + JSON control messages
                     ↓
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (Python)                     │
│  voice_chat.py (WebSocket endpoint)                      │
│  - JWT authentication                                    │
│  - Material context injection                            │
│  - OpenAI Realtime Service bridge                        │
└────────────────────┬────────────────────────────────────┘
                     │ WSS
                     ↓
┌─────────────────────────────────────────────────────────┐
│              OpenAI Realtime API                          │
│  - GPT-4o Realtime model                                 │
│  - Whisper transcription                                 │
│  - Voice synthesis (6 voices)                            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuration

### Backend (.env)

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...                    # Your OpenAI API key
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=alloy              # alloy, echo, fable, onyx, nova, shimmer
VOICE_PROVIDER=openai                    # "openai" (default) or "personaplex"

# Optional: NVIDIA PersonaPlex (local GPU)
PERSONAPLEX_WS_URL=wss://localhost:8998
```

### Frontend (.env.development)

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
VITE_VOICE_PROVIDER=openai
```

---

## 🎮 Usage

### Voice Chat Modes

#### Full-Duplex (Default)
- Just speak naturally
- AI detects when you stop talking (VAD)
- AI responds automatically
- **Interrupt anytime** - AI will stop and listen

#### Push-to-Talk
- Select "Push-to-Talk" mode
- **Hold button** while speaking
- **Release** to send your question
- AI responds after you release

### Controls

| Control | Action |
|---------|--------|
| 🎤 Microphone button | Start/stop session |
| 🔇 Mute | Mute/unmute microphone |
| 📞 End Session | Disconnect and return to dashboard |
| Voice selector | Choose AI voice (alloy, echo, etc.) |
| Full Duplex / PTT | Switch between modes |
| Text input | Type questions (optional) |

### Voice Presets

| Voice | Type | Description |
|-------|------|-------------|
| **alloy** | Neutral | Balanced, default |
| **echo** | Male | Warm, friendly |
| **fable** | Male | British accent |
| **onyx** | Male | Deep, authoritative |
| **nova** | Female | Energetic, clear |
| **shimmer** | Female | Soft, gentle |

---

## 🔐 Authentication

Voice chat uses JWT token authentication:

1. User must be logged in
2. Token is read from `localStorage`
3. Token is passed as query parameter in WebSocket URL
4. Backend validates token and material ownership

**WebSocket URL format:**
```
ws://localhost:8000/api/v1/voice/chat/{material_id}?token={JWT}&voice={voice}
```

---

## 📡 API Reference

### WebSocket Endpoint

**Route:** `GET /api/v1/voice/chat/{material_id}`

**Query Parameters:**
- `token` (required): JWT access token
- `provider` (optional): `openai` or `personaplex` (default: from env)
- `voice` (optional): Voice preset (default: `alloy`)

**Protocol:**
- Browser → Server: `ArrayBuffer` (PCM16 audio) + `JSON` (control messages)
- Server → Browser: `ArrayBuffer` (PCM16 audio) + `JSON` (events)

**Control Messages (Browser → Server):**
```json
{ "type": "mute" }      // Mute microphone
{ "type": "unmute" }    // Unmute microphone
{ "type": "interrupt" } // Interrupt AI response
```

**Events (Server → Browser):**
```json
// Session ready
{
  "type": "ready",
  "provider": "openai",
  "model": "gpt-4o-realtime-preview",
  "voice": "alloy"
}

// Live transcript (Whisper)
{
  "type": "transcript",
  "delta": "Hello! "
}

// Error
{
  "type": "error",
  "message": "Error description"
}
```

**Close Codes:**
- `4001`: Invalid/expired token
- `4004`: Material not found or access denied
- `1000`: Normal closure

---

## 🐛 Troubleshooting

### "Microphone access denied"

**Solution:**
1. Click the lock icon in browser address bar
2. Allow microphone access
3. Refresh the page

### "Invalid or expired token"

**Solution:**
1. Log out and log back in
2. Clear browser localStorage
3. Check token expiry in backend logs

### "OpenAI Realtime API rejected connection (HTTP 403)"

**Cause:** API key is invalid or doesn't have Realtime API access

**Solution:**
1. Verify API key at https://platform.openai.com/api-keys
2. Ensure account has **Tier 1+** access ($5+ top-up)
3. Check account limits at https://platform.openai.com/account/limits

### "Connection failed"

**Cause:** Backend not running or WebSocket proxy misconfigured

**Solution:**
1. Verify backend is running: `http://localhost:8000/docs`
2. Check Vite proxy config in `vite.config.ts`
3. Verify `.env.development` has correct URLs

### Audio quality issues

**Solution:**
1. Use a good quality microphone
2. Enable noise suppression in OS settings
3. Check sample rate is 24kHz (handled automatically)

---

## 💰 Pricing (OpenAI Realtime API)

As of March 2025:

| Type | Price |
|------|-------|
| Audio Input (your voice) | $0.06 / minute |
| Audio Output (AI voice) | $0.24 / minute |
| Text Tokens | $2.50 / 1M input, $10.00 / 1M output |

**Example session (10 minutes):**
- Input: ~$0.60
- Output: ~$2.40
- **Total: ~$3.00**

> ⚠️ **Monitor usage** at https://platform.openai.com/usage

---

## 🧪 Testing Without API Key

For development without OpenAI API key:

1. Voice chat UI will connect but fail at OpenAI step
2. Backend will send error message with instructions
3. UI shows error state with retry option

**Mock mode** (future enhancement):
- Can be added to simulate voice chat without real API
- Useful for UI testing

---

## 📁 File Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   └── voice/
│   │       │       ├── __init__.py
│   │       │       └── voice_chat.py          # WebSocket endpoint
│   │       └── router.py                       # Include voice router
│   ├── infrastructure/
│   │   └── ai/
│   │       ├── __init__.py
│   │       └── openai_realtime_service.py     # OpenAI bridge
│   └── core/
│       └── config.py                           # Voice config settings
└── .env                                        # OpenAI API key

Arma AI-Powered EdTech Interface Design/
├── src/
│   └── components/
│       └── dashboard/
│           ├── VoiceTeacherView.tsx            # Voice chat UI
│           └── DashboardLayout.tsx             # Sidebar navigation
├── .env.development                            # Frontend config
└── vite.config.ts                              # WebSocket proxy
```

---

## 🔗 Related Documentation

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [VOICE_CHAT_FEATURE.md](/home/kali/Desktop/VOICE_CHAT_FEATURE.md) - Full technical specification
- [Backend API Docs](http://localhost:8000/docs) - Swagger UI

---

## 🎯 Next Steps

1. **Test with real material**: Open a material and start voice chat from context
2. **Try different voices**: Select from 6 voice presets
3. **Test interruption**: Speak while AI is talking to test full-duplex
4. **Monitor costs**: Check OpenAI usage dashboard

---

## 📞 Support

For issues or questions:
1. Check backend logs: `tail -f backend/logs/app.log`
2. Check browser console: F12 → Console
3. Review error messages in UI
4. Consult full spec: `/home/kali/Desktop/VOICE_CHAT_FEATURE.md`
