import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { toast } from 'sonner';

type VoiceState = 'listening' | 'thinking' | 'speaking';
type SessionMode = 'duplex' | 'ptt';
type TranscriptRole = 'assistant' | 'user' | 'system';

interface TranscriptLine {
  id: string;
  role: TranscriptRole;
  text: string;
  timestamp: string;
}

const VOICE_PRESETS = ['Arma Amber', 'Arma Nova', 'Arma Focus'] as const;
const DESKTOP_TRANSCRIPT_MIN_WIDTH = 1360;

const INITIAL_TRANSCRIPT: TranscriptLine[] = [
  {
    id: 'tx-1',
    role: 'system',
    text: 'Session started. Full-duplex channel ready.',
    timestamp: '12:01:05',
  },
  {
    id: 'tx-2',
    role: 'assistant',
    text: 'Quantum physics studies how matter and energy behave at atomic scales.',
    timestamp: '12:01:09',
  },
  {
    id: 'tx-3',
    role: 'user',
    text: 'Can you explain wave-particle duality with a simple analogy?',
    timestamp: '12:01:15',
  },
  {
    id: 'tx-4',
    role: 'assistant',
    text: 'Think of light as a musician: sometimes it performs as a wave, sometimes as discrete notes.',
    timestamp: '12:01:19',
  },
];

export function VoiceTeacherView() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const [voiceState, setVoiceState] = useState<VoiceState>('thinking');
  const [sessionMode, setSessionMode] = useState<SessionMode>('duplex');
  const [isMuted, setIsMuted] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<(typeof VOICE_PRESETS)[number]>(VOICE_PRESETS[0]);
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.2);
  const [transcript, setTranscript] = useState<TranscriptLine[]>(INITIAL_TRANSCRIPT);
  const [textInput, setTextInput] = useState('');
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  const [isDesktopTranscript, setIsDesktopTranscript] = useState(() => window.innerWidth >= DESKTOP_TRANSCRIPT_MIN_WIDTH);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
    };
  }, []);

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

    const base = voiceState === 'speaking' ? 0.62 : 0.35;
    const variance = voiceState === 'speaking' ? 0.32 : 0.2;

    const intervalId = window.setInterval(() => {
      setAudioLevel(Math.min(1, base + Math.random() * variance));
    }, 170);

    return () => window.clearInterval(intervalId);
  }, [isMuted, isInterrupting, voiceState]);

  const orbColor = useMemo(() => {
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

  const getAssistantReply = (userMessage?: string) => {
    if (!userMessage) {
      return 'Great question. The observer effect means measurement changes what you observe.';
    }

    const lower = userMessage.toLowerCase();
    if (lower.includes('wave') || lower.includes('particle') || lower.includes('дуал')) {
      return 'Wave-particle duality means light behaves like a wave and like discrete particles depending on measurement setup.';
    }
    if (lower.includes('superposition') || lower.includes('суперпози')) {
      return 'Superposition means a quantum system can exist in multiple states until measurement collapses it to one outcome.';
    }
    if (lower.includes('uncertainty') || lower.includes('неопредел')) {
      return 'Heisenberg uncertainty says you cannot precisely know both position and momentum at the same time.';
    }
    return 'Got it. I can explain this step-by-step with examples and then give you a quick quiz question.';
  };

  const queueAssistantReply = (userMessage?: string) => {
    const thinkingTimer = window.setTimeout(() => {
      setVoiceState('thinking');
    }, 180);

    const speakingTimer = window.setTimeout(() => {
      setVoiceState('speaking');
      appendTranscript('assistant', getAssistantReply(userMessage));
    }, 720);

    timersRef.current.push(thinkingTimer, speakingTimer);
  };

  const handleSendText = () => {
    const message = textInput.trim();
    if (!message) return;

    setIsInterrupting(false);
    setVoiceState('listening');
    appendTranscript('user', message);
    setTextInput('');
    queueAssistantReply(message);
  };

  const handleMuteToggle = () => {
    setIsMuted((prev) => {
      const next = !prev;
      toast.info(next ? 'Microphone muted' : 'Microphone enabled');
      return next;
    });
  };

  const handleEndSession = () => {
    toast.info('Voice session ended');
    navigate('/dashboard');
  };

  const handleStartPtt = () => {
    if (isMuted) return;
    setIsInterrupting(true);
    setVoiceState('listening');
  };

  const handleEndPtt = () => {
    if (!isInterrupting) return;
    setIsInterrupting(false);
    appendTranscript('user', 'Can you pause and define superposition one more time?');
    queueAssistantReply();
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
                <p className="truncate text-sm font-medium text-white/90">Quantum Physics Basics</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] text-white/45">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                  <Radio className="h-3 w-3" />
                  Low Latency
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#FF8C42]/25 bg-[#FF8C42]/10 px-2 py-0.5 text-[#FFB06B]">
                  <Cpu className="h-3 w-3" />
                  NVIDIA Powered
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
              <VoiceOrb
                color={orbColor}
                level={audioLevel}
                state={voiceState}
                interrupted={isInterrupting}
                muted={isMuted}
              />
            </div>

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
                      <span className="tracking-wide">Voice {selectedVoice}</span>
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
                      <span className="tracking-wide capitalize">State {isInterrupting ? 'interrupting' : voiceState}</span>
                    </div>
                  </div>

                  <div className="mb-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Live Transcription</p>
                    <div className="mt-2 min-h-[58px] space-y-1">
                      <AnimatePresence mode="popLayout">
                        {transcriptPreview.length > 0 ? (
                          transcriptPreview.map((line, index) => (
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
                          ))
                        ) : (
                          <motion.p
                            key="transcript-empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            className="line-clamp-1 text-sm text-white/60"
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
                          onChange={(event) => setSelectedVoice(event.target.value as (typeof VOICE_PRESETS)[number])}
                          className="h-10 min-w-[142px] appearance-none rounded-full border border-transparent bg-white/[0.04] pl-9 pr-8 text-sm text-white/80 outline-none transition-colors hover:bg-white/[0.08] focus:border-[#FF8C42]/40"
                        >
                          {VOICE_PRESETS.map((voice) => (
                            <option key={voice} value={voice} className="bg-[#090909]">
                              {voice}
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
                          className={`inline-flex h-10 items-center gap-2 rounded-full border border-transparent px-4 text-sm transition-all ${
                            isInterrupting
                              ? 'bg-[#FF8C42]/22 text-white shadow-[0_0_22px_rgba(255,140,66,0.35)]'
                              : 'bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <AudioLines className="h-4 w-4" />
                          Hold to Talk
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
                        placeholder="Type a question while voice session is running..."
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
                        className={`inline-flex h-10 items-center gap-2 rounded-full border border-transparent px-4 text-sm transition-all ${
                          isMuted
                            ? 'bg-[#FF8C42]/20 text-[#FFD1A8] shadow-[0_0_18px_rgba(255,140,66,0.35)]'
                            : 'bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {isMuted ? 'Unmute' : 'Mute'}
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

function VoiceOrb({
  color,
  level,
  state,
  interrupted,
  muted,
}: {
  color: string;
  level: number;
  state: VoiceState;
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
