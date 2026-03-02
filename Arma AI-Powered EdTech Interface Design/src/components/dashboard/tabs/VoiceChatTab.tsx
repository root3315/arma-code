/**
 * VoiceChatTab - Voice Chat integrated into Material Detail View
 * 
 * Features:
 * - Connects to specific material context
 * - RAG-powered responses from material content
 * - Full-duplex voice communication
 * - Live transcription
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Material } from '../../types/api';

interface VoiceChatTabProps {
  material: Material;
}

export function VoiceChatTab({ material }: VoiceChatTabProps) {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasEmbeddings, setHasEmbeddings] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if material has embeddings for RAG
  useEffect(() => {
    const checkEmbeddings = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          toast.error('Not authenticated');
          return;
        }

        const response = await fetch(
          `/api/v1/voice/materials/${material.id}/voice-context?token=${encodeURIComponent(token)}`
        );

        if (response.ok) {
          const data = await response.json();
          setHasEmbeddings(data.has_embeddings);
          
          if (!data.has_embeddings) {
            toast.info(
              'This material has no embeddings yet. Voice chat will work in general mode without RAG context.'
            );
          }
        }
      } catch (error) {
        console.error('Error checking embeddings:', error);
      } finally {
        setChecking(false);
      }
    };

    checkEmbeddings();
  }, [material.id]);

  const handleStartVoiceChat = () => {
    setIsConnecting(true);
    
    // Navigate to voice teacher view with material context
    setTimeout(() => {
      navigate(`/dashboard/voice?material=${material.id}`);
      toast.success('Starting voice chat with material context');
    }, 500);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050505]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Checking material context...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#050505] relative overflow-hidden">
      {/* Background ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-[-20%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[#FF7A1A]/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[300px] w-[300px] rounded-full bg-[#FF932E]/10 blur-[100px]" />
      </div>

      <div className="relative z-10 text-center max-w-md px-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF8C42] to-[#FF6B00] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#FF8C42]/30">
          <AudioLines className="w-10 h-10 text-black" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white mb-2">
          Voice Chat with Material
        </h2>

        {/* Material info */}
        <p className="text-sm text-white/60 mb-6 line-clamp-2">
          <span className="font-medium text-white/80">{material.title}</span>
        </p>

        {/* RAG status */}
        {hasEmbeddings ? (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-emerald-300">
              ✅ RAG context available - AI will answer based on this material
            </p>
          </div>
        ) : (
          <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300">
              ⚠️ No embeddings - AI will answer in general mode
            </p>
          </div>
        )}

        {/* Features list */}
        <div className="text-left space-y-2 mb-8">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF8C42]" />
            <span>Full-duplex voice communication</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF8C42]" />
            <span>Real-time transcription (Whisper)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF8C42]" />
            <span>Context-aware responses from material</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF8C42]" />
            <span>Interrupt AI anytime</span>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStartVoiceChat}
          disabled={isConnecting}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B00] text-black font-medium text-sm hover:from-[#FF9F5C] hover:to-[#FF7B1A] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FF8C42]/20"
        >
          {isConnecting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </span>
          ) : (
            'Start Voice Chat'
          )}
        </button>

        {/* Info note */}
        <p className="mt-4 text-[10px] text-white/30 text-center">
          Uses OpenAI Realtime API • ~300-500ms latency
        </p>
      </div>
    </div>
  );
}
