/**
 * VoiceTeacherView - Real-time Voice Chat with AI Tutor
 * 
 * Features:
 * - Full-duplex voice communication via OpenAI Realtime API
 * - Push-to-talk mode
 * - Live transcription (Whisper)
 * - Interrupt AI response anytime
 * - Material context awareness
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AudioLines,
  Cpu,
  Mic,
  MicOff,
  SendHorizontal,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  Radio,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type VoiceState = 'listening' | 'thinking' | 'speaking' | 'idle' | 'connecting' | 'error';
type SessionMode = 'duplex' | 'ptt';
type TranscriptRole = 'assistant' | 'user' | 'system';

interface TranscriptLine {
  id: string;
  role: TranscriptRole;
  text: string;
  timestamp: string;
}

interface WSMessage {
  type: 'ready' | 'transcript' | 'error';
  delta?: string;
  message?: string;
  provider?: string;
  model?: string;
  voice?: string;
}

const VOICE_PRESETS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type VoicePreset = typeof VOICE_PRESETS[number];

const DESKTOP_TRANSCRIPT_MIN_WIDTH = 1360;

const INITIAL_TRANSCRIPT: TranscriptLine[] = [];

// AudioWorklet code for PCM16 capture (inline, no external file needed)
const AUDIO_WORKLET_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channel = input[0];
      const int16Data = new Int16Array(channel.length);
      
      for (let i = 0; i < channel.length; i++) {
        const sample = Math.max(-1, Math.min(1, channel[i]));
        int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
      
      this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCaptureProcessor);
`;

export function VoiceTeacherView() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [sessionMode, setSessionMode] = useState<SessionMode>('duplex');
  const [isMuted, setIsMuted] = useState(true); // Muted by default - user must enable mic
  const isMutedRef = useRef(isMuted); // Ref for audio worklet closure
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<VoicePreset>('alloy');
  const [isInterrupting, setIsInterrupting] = useState(false); // True when user is speaking (PTT or VAD)
  const [audioLevel, setAudioLevel] = useState(0.2);
  const [transcript, setTranscript] = useState<TranscriptLine[]>(INITIAL_TRANSCRIPT);
  const [textInput, setTextInput] = useState('');
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  const [isDesktopTranscript, setIsDesktopTranscript] = useState(() => window.innerWidth >= DESKTOP_TRANSCRIPT_MIN_WIDTH);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pttActive, setPttActive] = useState(false); // Push-to-Talk button held down

  // Get material ID from URL if viewing from material context
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const matId = params.get('material');
    if (matId) {
      setMaterialId(matId);
      toast.info('Voice chat connected to material context');
    }
  }, [location.search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
      stopSession();
    };
  }, []);

  // Keep isMutedRef in sync with isMuted state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Layout updates
  useEffect(() => {
    const updateTranscriptLayout = () => {
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
      setWorkspaceWidth(containerWidth);
      setIsDesktopTranscript(containerWidth >= DESKTOP_TRANSCRIPT_MIN_WIDTH);
    };

    updateTranscriptLayout();
    const resizeObserver = new ResizeObserver(() => updateTranscriptLayout());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', updateTranscriptLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTranscriptLayout);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Audio level animation
  useEffect(() => {
    if (isMuted) {
      setAudioLevel(0.05);
      return;
    }

    if (isInterrupting) {
      setAudioLevel(0.95);
      return;
    }

    if (voiceState === 'thinking') {
      setAudioLevel(0.22);
      return;
    }

    if (voiceState === 'idle' || voiceState === 'connecting' || voiceState === 'error') {
      setAudioLevel(0.1);
      return;
    }

    const base = voiceState === 'speaking' ? 0.62 : 0.35;
    const variance = voiceState === 'speaking' ? 0.32 : 0.2;

    const intervalId = window.setInterval(() => {
      setAudioLevel(Math.min(1, base + Math.random() * variance));
    }, 170);

    return () => window.clearInterval(intervalId);
  }, [isMuted, isInterrupting, voiceState]);

  // Orb color based on state
  const orbColor = useMemo(() => {
    if (voiceState === 'error') return '#EF4444';
    if (voiceState === 'connecting') return '#F59E0B';
    if (isMuted) return '#6B7280';
    if (isInterrupting) return '#FFD08A';
    if (voiceState === 'speaking') return '#FF7A1A';
    if (voiceState === 'listening') return '#FF932E';
    return '#FF8A2D';
  }, [isMuted, isInterrupting, voiceState]);

  const isCompactHeight = viewportHeight < 840;
  const isCompactWorkspace = workspaceWidth < 1260;

  const whisperLine = useMemo(() => {
    for (let idx = transcript.length - 1; idx >= 0; idx -= 1) {
      if (transcript[idx].role === 'assistant') return transcript[idx].text;
    }
    return 'AI transcript will appear here.';
  }, [transcript]);

  const transcriptPreview = useMemo(
    () => transcript.filter((line) => line.role !== 'system').slice(-3),
    [transcript]
  );

  const appendTranscript = (role: TranscriptRole, text: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setTranscript((prev) => {
      const next = [
        ...prev,
        { id: `tx-${now.getTime()}-${Math.random()}`, role, text, timestamp },
      ];
      return next.slice(-22);
    });
  };

  // WebSocket connection to backend
  const startSession = useCallback(async () => {
    setVoiceState('connecting');
    setErrorMessage(null);

    try {
      // Get auth token
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated. Please log in.');
      }

      // Determine material ID
      const matId = materialId || ''; // Empty for general mode

      // Build WebSocket URL - connect to backend API on port 8000
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = 'localhost:8000'; // Backend API host
      const wsUrl = `${wsProtocol}//${wsHost}/api/v1/voice/chat?materials=${matId}&token=${encodeURIComponent(token)}&voice=${selectedVoice}`;

      // Connect to WebSocket
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary audio data from AI
          await playAudioData(event.data);
          setVoiceState('speaking');
        } else {
          // JSON message
          try {
            const msg: WSMessage = JSON.parse(event.data);
            
            if (msg.type === 'ready') {
              console.log('Voice session ready:', msg);
              setVoiceState('listening');
              toast.success(`Connected to ${msg.provider} - ${msg.model}`);
            } else if (msg.type === 'transcript') {
              // Live transcript delta
              if (msg.delta) {
                setCurrentTranscript((prev) => prev + msg.delta);
              }
            } else if (msg.type === 'error') {
              console.error('Server error:', msg.message);
              setErrorMessage(msg.message || 'Unknown error');
              setVoiceState('error');
              toast.error(msg.message || 'Connection error');
            }
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setErrorMessage('Connection error');
        setVoiceState('error');
        toast.error('Connection failed');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (voiceState !== 'error' && voiceState !== 'idle') {
          setVoiceState('idle');
          toast.info('Session ended');
        }
      };

      // WebSocket connected - session ready, microphone off by default
      toast.success('Voice chat ready - click "Enable Mic" to speak');
      setVoiceState('listening');

    } catch (error) {
      console.error('Failed to start session:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect');
      setVoiceState('error');
      toast.error(error instanceof Error ? error.message : 'Failed to connect');
    }
  }, [materialId, selectedVoice]);

  const stopSession = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop audio capture
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setVoiceState('idle');
    setIsInterrupting(false);
    setCurrentTranscript('');
  }, []);

  // Initialize AudioWorklet for microphone capture
  const initAudioCapture = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        },
      });
      mediaStreamRef.current = stream;

      // Create AudioContext (24kHz output)
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      // Load AudioWorklet code
      const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Create AudioWorkletNode
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-capture');
      workletNodeRef.current = workletNode;

      // Send audio data to WebSocket based on mode
      workletNode.port.onmessage = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        // Full Duplex mode: send when unmuted
        if (sessionMode === 'duplex' && !isMutedRef.current) {
          wsRef.current.send(event.data);
        }
        // PTT mode: send only when button is held
        else if (sessionMode === 'ptt' && pttActive) {
          wsRef.current.send(event.data);
        }
      };

      // Connect microphone to worklet
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);

      console.log('Audio capture initialized');
    } catch (error) {
      console.error('Failed to initialize audio capture:', error);
      throw new Error('Microphone access denied. Please allow microphone access.');
    }
  };

  // Play audio data received from AI
  const playAudioData = async (arrayBuffer: ArrayBuffer) => {
    try {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      // Decode PCM16 to AudioBuffer
      const int16Data = new Int16Array(arrayBuffer);
      const float32Data = new Float32Array(int16Data.length);
      
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 0x8000;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      // Queue for playback
      playQueueRef.current.push(audioBuffer);
      
      if (!isPlayingRef.current) {
        playNextBuffer();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const playNextBuffer = async () => {
    const audioContext = audioContextRef.current;
    if (!audioContext || playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const buffer = playQueueRef.current.shift()!;
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    source.onended = () => {
      if (playQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        setVoiceState('listening');
      } else {
        playNextBuffer();
      }
    };
    
    source.start();
  };

  // Handle mute toggle - Enable/Disable microphone for Full Duplex mode
  const handleMuteToggle = async () => {
    const next = !isMuted;

    // Initialize audio capture on first enable
    if (next && !audioContextRef.current) {
      try {
        await initAudioCapture();
        setIsMuted(false); // Unmute after audio initialized

        // Notify backend to unmute - start listening in Full Duplex mode
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'unmute',
          }));
        }

        toast.success('Full Duplex enabled - AI is listening');
        return;
      } catch (error) {
        toast.error('Microphone access denied');
        return;
      }
    }

    setIsMuted(next);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: next ? 'mute' : 'unmute',
      }));
    }

    if (!next) {
      toast.info('Microphone muted');
      setVoiceState('idle'); // Show idle state when muted
    } else {
      setVoiceState('listening'); // Show listening state when unmuted
    }
  };

  // Handle interrupt (when user starts speaking - interrupt AI response)
  const handleInterrupt = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'interrupt',
      }));
    }
    setIsInterrupting(true);
    setVoiceState('listening');

    // Clear play queue
    playQueueRef.current = [];
    isPlayingRef.current = false;
  };

  // Handle PTT (Push-to-Talk) start - user holds button to speak
  const handleStartPtt = async () => {
    if (pttActive) return; // Already pressing
    
    setPttActive(true);
    setIsInterrupting(true);
    setVoiceState('listening');
    
    // Clear play queue to interrupt AI if speaking
    playQueueRef.current = [];
    isPlayingRef.current = false;
    
    // Initialize audio if not already done
    if (!audioContextRef.current) {
      try {
        await initAudioCapture();
        // Audio will start sending because pttActive is true
      } catch (error) {
        toast.error('Microphone access denied');
        setPttActive(false);
        setIsInterrupting(false);
        return;
      }
    }
    
    // Notify backend we're sending audio (unmute temporarily)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unmute',
      }));
    }
    
    toast.info('Listening...');
  };

  // Handle PTT (Push-to-Talk) end - user releases button, send question
  const handleEndPtt = () => {
    if (!pttActive) return;
    
    setPttActive(false);
    setIsInterrupting(false);
    setVoiceState('speaking'); // Expect AI response
    
    // Notify backend to stop listening (mute)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mute',
      }));
    }
    
    appendTranscript('user', '[Voice question]');
    toast.success('Question sent');
  };

  // Handle send text message
  const handleSendText = () => {
    const message = textInput.trim();
    if (!message || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    handleInterrupt();
    appendTranscript('user', message);
    setTextInput('');
    
    // Note: Text messages would need backend support to convert to speech
    // For now, just interrupt and let user speak
  };

  // Handle end session
  const handleEndSession = () => {
    stopSession();
    toast.info('Voice session ended');
    navigate('/dashboard');
  };

  // Render connection status
  const renderConnectionStatus = () => {
    if (voiceState === 'connecting') {
      return (
        <div className="flex items-center gap-2 text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Connecting...</span>
        </div>
      );
    }
    
    if (voiceState === 'error') {
      return (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">{errorMessage || 'Connection error'}</span>
        </div>
      );
    }
    
    if (voiceState === 'idle') {
      return (
        <div className="text-xs text-white/40">
          Ready to connect
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 text-emerald-400">
        <Radio className="h-3 w-3" />
        <span className="text-xs">Live</span>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-25%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#FF7A1A]/20 blur-[130px]" />
        <div className="absolute bottom-[-30%] right-[-10%] h-[420px] w-[420px] rounded-full bg-[#FF932E]/14 blur-[120px]" />
      </div>

      <div className="relative flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl md:px-6 md:py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-1">
                <p className="truncate text-sm font-medium text-white/90">
                  {materialId ? 'Material Voice Chat' : 'AI Voice Tutor'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] text-white/45">
                  {renderConnectionStatus()}
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FF8C42]/25 bg-[#FF8C42]/10 px-2 py-0.5 text-[#FFB06B]">
                    <Cpu className="h-3 w-3" />
                    OpenAI Realtime
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  onClick={() => setIsTranscriptOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  {isTranscriptOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  <span className="hidden sm:inline">Transcript</span>
                </button>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col justify-between px-4 py-6 md:px-8 md:py-8">
            <div className="flex flex-1 items-center justify-center">
              {voiceState === 'idle' || voiceState === 'error' ? (
                // Start button
                <div className="text-center">
                  <motion.button
                    onClick={startSession}
                    className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B00] text-black shadow-2xl shadow-[#FF8C42]/30 transition-transform hover:scale-105"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {voiceState === 'error' ? (
                      <AlertCircle className="h-16 w-16" />
                    ) : (
                      <Mic className="h-16 w-16" />
                    )}
                  </motion.button>
                  <p className="mt-4 text-sm text-white/60">
                    {voiceState === 'error' ? 'Click to retry' : 'Click to start voice chat'}
                  </p>
                </div>
              ) : (
                // Voice orb
                <VoiceOrb
                  color={orbColor}
                  level={audioLevel}
                  state={voiceState === 'connecting' ? 'thinking' : voiceState}
                  interrupted={isInterrupting}
                  muted={isMuted}
                />
              )}
            </div>

            {(voiceState === 'listening' || voiceState === 'speaking' || voiceState === 'thinking') && (
              <div
                className={`mx-auto w-full px-1 pb-1 ${
                  isCompactWorkspace ? 'max-w-3xl' : 'max-w-4xl'
                } ${isCompactHeight ? 'space-y-3' : 'space-y-5'}`}
              >
                <div
                  className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 backdrop-blur-[20px] ${
                    isCompactWorkspace ? 'px-4 md:px-5' : 'px-5 md:px-6'
                  } ${isCompactHeight ? 'py-3' : 'py-4'}`}
                >
                  <motion.div
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    animate={
                      voiceState === 'thinking'
                        ? { boxShadow: ['0 0 0 rgba(255,140,66,0)', '0 0 24px rgba(255,140,66,0.2)', '0 0 0 rgba(255,140,66,0)'] }
                        : { boxShadow: '0 0 0 rgba(255,140,66,0)' }
                    }
                    transition={{ duration: 2.8, repeat: voiceState === 'thinking' ? Infinity : 0, ease: 'easeInOut' }}
                  />

                  <div className="relative z-10 p-5">
                    <div className="mb-3 flex items-center justify-between text-[11px] text-white/45">
                      <div className="inline-flex items-center gap-2">
                        <span className="relative inline-flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF8C42]/50" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF8C42]" />
                        </span>
                        <span className="tracking-wide">Voice: {selectedVoice}</span>
                      </div>

                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            voiceState === 'thinking'
                              ? 'bg-[#FFB06B] shadow-[0_0_8px_rgba(255,176,107,0.8)]'
                              : voiceState === 'speaking'
                                ? 'bg-[#FF8C42] shadow-[0_0_8px_rgba(255,140,66,0.8)]'
                                : 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]'
                          }`}
                        />
                        <span className="tracking-wide capitalize">
                          {isInterrupting ? 'interrupting' : voiceState}
                        </span>
                      </div>
                    </div>

                    <div className="mb-3 text-center">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Live Transcription</p>
                      <div className="mt-2 min-h-[58px] space-y-1">
                        <AnimatePresence mode="popLayout">
                          {currentTranscript || transcriptPreview.length > 0 ? (
                            <>
                              {currentTranscript && (
                                <motion.p
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 0.95, y: 0 }}
                                  className="text-sm text-white/90"
                                >
                                  {currentTranscript}
                                </motion.p>
                              )}
                              {transcriptPreview.map((line, index) => (
                                <motion.p
                                  key={line.id}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{
                                    opacity: index === transcriptPreview.length - 1 ? 0.95 : index === 0 ? 0.35 : 0.58,
                                    y: 0,
                                  }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.26, ease: 'easeOut' }}
                                  className="line-clamp-1 text-sm text-white/70"
                                >
                                  {line.text}
                                </motion.p>
                              ))}
                            </>
                          ) : (
                            <motion.p
                              key="transcript-empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.6 }}
                              className="text-sm text-white/60"
                            >
                              {whisperLine}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div
                      className={`grid items-center gap-2 ${
                        isCompactWorkspace ? 'grid-cols-1' : 'grid-cols-[auto_1fr_auto]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-full bg-black/25 p-1">
                          <ControlChip
                            active={sessionMode === 'duplex'}
                            onClick={() => setSessionMode('duplex')}
                            label="Full Duplex"
                          />
                          <ControlChip
                            active={sessionMode === 'ptt'}
                            onClick={() => setSessionMode('ptt')}
                            label="Push-to-Talk"
                          />
                        </div>

                        <label className="relative inline-flex items-center">
                          <AudioLines className="pointer-events-none absolute left-3 h-4 w-4 text-[#FFB06B]" />
                          <select
                            value={selectedVoice}
                            onChange={(event) => setSelectedVoice(event.target.value as VoicePreset)}
                            className="h-10 min-w-[142px] appearance-none rounded-full border border-transparent bg-white/[0.04] pl-9 pr-8 text-sm text-white/80 outline-none transition-colors hover:bg-white/[0.08] focus:border-[#FF8C42]/40"
                            disabled={voiceState !== 'idle' && voiceState !== 'listening'}
                          >
                            {VOICE_PRESETS.map((voice) => (
                              <option key={voice} value={voice} className="bg-[#090909]">
                                {voice.charAt(0).toUpperCase() + voice.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>

                        {sessionMode === 'ptt' && (
                          <button
                            onMouseDown={handleStartPtt}
                            onMouseUp={handleEndPtt}
                            onMouseLeave={handleEndPtt}
                            onTouchStart={handleStartPtt}
                            onTouchEnd={handleEndPtt}
                            className={`inline-flex h-10 items-center gap-2 rounded-full border border-transparent px-4 text-sm transition-all select-none ${
                              pttActive
                                ? 'bg-[#FF8C42] text-black shadow-[0_0_22px_rgba(255,140,66,0.5)] scale-105'
                                : 'bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white'
                            }`}
                          >
                            <Mic className={`h-4 w-4 ${pttActive ? 'animate-pulse' : ''}`} />
                            {pttActive ? 'Listening...' : 'Hold to Talk'}
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={textInput}
                          onChange={(event) => setTextInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleSendText();
                            }
                          }}
                          placeholder="Type a question..."
                          className="h-10 w-full rounded-full border border-white/10 bg-black/20 pl-4 pr-11 text-sm text-white/90 placeholder:text-white/35 shadow-[inset_0_1px_10px_rgba(0,0,0,0.45)] outline-none transition-colors focus:border-[#FF8C42]/45"
                        />
                        <button
                          onClick={handleSendText}
                          disabled={!textInput.trim()}
                          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-[#FFB06B] transition-colors hover:bg-white/[0.08] hover:text-[#FFCA9D] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={handleMuteToggle}
                          disabled={sessionMode === 'ptt' || voiceState === 'connecting' || voiceState === 'error'}
                          className={`inline-flex h-10 items-center gap-2 rounded-full border border-transparent px-4 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            isMuted
                              ? 'bg-[#FF8C42]/20 text-[#FFD1A8] shadow-[0_0_18px_rgba(255,140,66,0.35)]'
                              : 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_rgba(74,222,128,0.35)]'
                          }`}
                        >
                          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          {sessionMode === 'ptt' 
                            ? 'Use PTT Button' 
                            : isMuted 
                              ? 'Enable AI Listening' 
                              : 'AI Listening...'}
                        </button>

                        <button
                          onClick={handleEndSession}
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-red-400/25 bg-gradient-to-r from-red-900/60 via-red-800/40 to-black/40 px-4 text-sm text-red-200 transition-colors hover:from-red-800/70 hover:to-black/50"
                        >
                          <PhoneOff className="h-4 w-4" />
                          End Session
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isTranscriptOpen && isDesktopTranscript && (
            <motion.aside
              key="transcript-desktop"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full shrink-0 overflow-hidden border-l border-white/10 bg-black/45 backdrop-blur-2xl"
            >
              <TranscriptPanelContent transcript={transcript} />
            </motion.aside>
          )}

          {isTranscriptOpen && !isDesktopTranscript && (
            <motion.aside
              key="transcript-mobile"
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-y-0 right-0 z-40 w-[min(88vw,320px)] overflow-hidden border-l border-white/10 bg-black/90 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            >
              <TranscriptPanelContent transcript={transcript} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// VoiceOrb component (animated orb)
function VoiceOrb({
  color,
  level,
  state,
  interrupted,
  muted,
}: {
  color: string;
  level: number;
  state: string;
  interrupted: boolean;
  muted: boolean;
}) {
  const coreScale = muted ? 1 : 1 + level * 0.08;
  const glowStrength = muted ? 0.1 : 0.35 + level * 0.35;

  return (
    <div className="relative flex h-[min(44vh,360px)] w-[min(44vh,360px)] items-center justify-center md:h-[min(50vh,420px)] md:w-[min(50vh,420px)]">
      {[0, 1, 2].map((ring) => (
        <motion.div
          key={ring}
          className="absolute rounded-full border"
          style={{
            width: 260,
            height: 260,
            borderColor: `${color}88`,
          }}
          animate={{
            scale: state === 'speaking' || state === 'listening' ? [1, 1.32 + ring * 0.04] : [1, 1.1],
            opacity: state === 'speaking' || state === 'listening' ? [0.42, 0] : [0.2, 0.05, 0.2],
          }}
          transition={{
            duration: state === 'speaking' ? 1.1 : 1.8,
            ease: 'easeOut',
            repeat: Infinity,
            delay: ring * 0.16,
          }}
        />
      ))}

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          background: `${color}33`,
          filter: 'blur(48px)',
        }}
        animate={{
          scale: [1, 1 + glowStrength * 0.14, 1],
          opacity: [0.5, 0.9, 0.5],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="relative h-[220px] w-[220px] overflow-hidden rounded-full border border-white/15"
        style={{
          borderColor: `${color}66`,
          background: `radial-gradient(circle at 30% 25%, ${color}F0 0%, ${color}99 32%, #120B05 82%)`,
          boxShadow: `0 0 92px ${color}66`,
        }}
        animate={{
          scale: coreScale,
          rotate: state === 'thinking' ? [0, 360] : interrupted ? [-2, 2, -2] : [0, 0, 0],
        }}
        transition={{
          scale: { duration: 0.2, ease: 'easeOut' },
          rotate: state === 'thinking'
            ? { duration: 9, repeat: Infinity, ease: 'linear' }
            : { duration: 0.24, repeat: interrupted ? Infinity : 0, ease: 'easeInOut' },
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(130deg, rgba(255,219,180,0.34) 0%, rgba(255,166,84,0.08) 48%, rgba(255,214,170,0.22) 100%)',
            mixBlendMode: 'screen',
          }}
          animate={{ opacity: [0.55, 0.92, 0.55] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}

// ControlChip component
function ControlChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-[#FF8C42]/16 text-[#FFBF8A] shadow-[0_0_12px_rgba(255,140,66,0.2)]'
          : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

// TranscriptPanelContent component
function TranscriptPanelContent({ transcript }: { transcript: TranscriptLine[] }) {
  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <p className="text-xs uppercase tracking-[0.16em] text-white/45">Realtime Transcript</p>
      </div>
      <div className="h-[calc(100%-56px)] space-y-2 overflow-y-auto px-3 py-3">
        {transcript.map((line) => (
          <div
            key={line.id}
            className={`rounded-xl border px-3 py-2 ${
              line.role === 'assistant'
                ? 'border-[#FF8C42]/25 bg-[#FF8C42]/10'
                : line.role === 'user'
                  ? 'border-white/15 bg-white/[0.05]'
                  : 'border-white/10 bg-black/20'
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{line.role}</span>
              <span className="text-[10px] text-white/35">{line.timestamp}</span>
            </div>
            <p className="break-words text-xs leading-relaxed text-white/80">{line.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}
