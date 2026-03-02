import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, FileText, Youtube, MessageSquare, Brain, CheckCircle2, Headphones, MonitorPlay,
  Play, Sparkles, Download, Share2, Layers,
  Link as LinkIcon, Edit3, X, Archive, Loader2,
  AlertCircle, RotateCcw, AudioLines
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useMaterial,
  useMaterialSummary,
  useMaterialNotes,
  useFlashcards,
  useQuizQuestions,
  useTutorChat
} from '../../hooks/useApi';
import { materialsApi } from '../../services/api';
import type { Material, TutorMessage, Flashcard, MaterialSummary } from '../../types/api';
import { QuizTab } from './tabs/QuizTab';
import { PodcastTab } from './tabs/PodcastTab';
import { SlidesTab } from './tabs/SlidesTab';
import { VoiceChatTab } from './tabs/VoiceChatTab';

import { ViewState } from '../../App';

interface ProjectDetailViewProps {
  projectId?: string | null;
  onBack?: () => void;
  onNavigate?: (view: ViewState) => void;
  onSelectDeck?: (id: number) => void;
}

export function ProjectDetailView({ projectId: propProjectId, onBack: propOnBack, onNavigate, onSelectDeck }: ProjectDetailViewProps) {
  const { id: urlId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Use URL parameter if available, otherwise use prop
  const projectId = urlId || propProjectId;
  const onBack = propOnBack || (() => navigate(-1));
  const { material, loading: materialLoading, refetch: refetchMaterial } = useMaterial(projectId);
  const { summary, loading: summaryLoading } = useMaterialSummary(projectId);
  const { notes, loading: notesLoading } = useMaterialNotes(projectId);
  const { flashcards, loading: flashcardsLoading } = useFlashcards(projectId);
  const { questions, loading: quizLoading } = useQuizQuestions(projectId);
  const { messages, sendMessage, sending, loading: chatLoading } = useTutorChat(projectId);

  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'flashcards' | 'quiz' | 'podcast' | 'slides'>('chat');
  const [outlineOpen, setOutlineOpen] = useState(true);

  // Loading state for the entire component
  if (materialLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0C0C0F]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading material...</p>
        </div>
      </div>
    );
  }

  // No material found
  if (!material) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0C0C0F]">
        <p className="text-white/40 mb-4">Material not found</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0C0C0F]">

      {/* TOP HEADER */}
      <div className="h-14 border-b border-white/5 bg-[#121215]/80 backdrop-blur-md flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 shrink-0 ${material.type === 'pdf' ? 'bg-blue-500/10 text-blue-400' : material.type === 'youtube' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'}`}>
            {material.type === 'pdf' ? <FileText size={16} /> : material.type === 'youtube' ? <Youtube size={16} /> : <LinkIcon size={16} />}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-white/90 truncate">{material.title}</h1>
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
              <span>{new Date(material.created_at).toLocaleDateString()}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="uppercase">{material.processing_status}</span>
            </div>
          </div>
        </div>

        {/* TOP TABS */}
        <div className="flex items-center gap-1">
          {[
            { id: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
            { id: 'summary', label: 'Summary', icon: <FileText size={14} /> },
            { id: 'flashcards', label: 'Flashcards', icon: <Brain size={14} /> },
            { id: 'quiz', label: 'Quiz', icon: <CheckCircle2 size={14} /> },
            { id: 'podcast', label: 'Podcast', icon: <Headphones size={14} /> },
            { id: 'slides', label: 'Slides', icon: <MonitorPlay size={14} /> },
            { id: 'voice', label: 'Voice Chat', icon: <AudioLines size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id
                ? 'bg-white/10 text-white shadow-inner'
                : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.icon}
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* LEFT OUTLINE PANEL (TOC) */}
        <AnimatePresence>
          {outlineOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-white/5 bg-[#0C0C0F]/50 flex flex-col shrink-0"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Table of Contents
                </h3>
                <button onClick={() => setOutlineOpen(false)} className="text-white/20 hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {activeTab === 'summary' && summary ? (
                  <TableOfContentsSummary summary={summary.summary} />
                ) : (
                  <div className="p-4 text-center text-xs text-white/30">
                    {material.type === 'pdf' ? 'PDF outline not yet available' : 'Video timestamps not yet available'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER WORKSPACE */}
        <div className="flex-1 flex flex-col relative bg-[#121215]/40 overflow-hidden">
          {!outlineOpen && (
            <button
              onClick={() => setOutlineOpen(true)}
              className="absolute left-4 top-4 z-10 p-2 rounded-lg bg-black/40 text-white/40 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md border border-white/5"
            >
              <Layers size={16} />
            </button>
          )}

          <div className="flex-1 h-full overflow-hidden">
            {activeTab === 'chat' && (
              <ChatTab
                material={material}
                messages={messages}
                sendMessage={sendMessage}
                sending={sending}
                loading={chatLoading}
              />
            )}
            {activeTab === 'summary' && (
              <SummaryTab
                material={material}
                summary={summary}
                loading={summaryLoading}
              />
            )}
            {activeTab === 'flashcards' && (
              <FlashcardsTab
                material={material}
                flashcards={flashcards}
                loading={flashcardsLoading}
                onNavigate={onNavigate}
                onSelectDeck={onSelectDeck}
                navigate={navigate}
              />
            )}
            {activeTab === 'quiz' && (
              <QuizTab
                material={material}
                questions={questions}
                loading={quizLoading}
              />
            )}
            {activeTab === 'podcast' && <PodcastTab material={material} onRefetch={refetchMaterial} />}
            {activeTab === 'slides' && <SlidesTab material={material} onRefetch={refetchMaterial} />}
            {activeTab === 'voice' && <VoiceChatTab material={material} />}
          </div>
        </div>

        {/* RIGHT ACTIONS RAIL (Metadata) */}
        <div className="w-64 border-l border-white/5 bg-[#0C0C0F]/50 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Project Info</h3>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto flex-1">
            {/* Status */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Status</label>
              <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold border ${material.processing_status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                material.processing_status === 'processing' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  material.processing_status === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${material.processing_status === 'completed' ? 'bg-emerald-400' :
                  material.processing_status === 'processing' ? 'bg-amber-400 animate-pulse' :
                    material.processing_status === 'failed' ? 'bg-red-400' :
                      'bg-blue-400'
                  }`} />
                {material.processing_status === 'failed' ? 'ERROR' : material.processing_status.toUpperCase()}
              </div>
            </div>

            {/* Retry Button for failed or stuck materials */}
            <RetryButton
              material={material}
              onRetrySuccess={refetchMaterial}
            />

            {/* Processing Progress */}
            {material.processing_status === 'processing' && material.processing_progress > 0 && (
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Progress</label>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Processing</span>
                    <span className="text-white/60">{material.processing_progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${material.processing_progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Material Info */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Type</label>
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-white/60">
                {material.type.toUpperCase()}
              </span>
            </div>

            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Created</label>
              <p className="text-xs text-white/60">{new Date(material.created_at).toLocaleDateString()}</p>
            </div>

            {/* Actions */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Actions</label>
              <div className="space-y-1">
                <ActionButton icon={<Download size={14} />} label="Export" onClick={() => toast.success('Export started')} />
                <ActionButton icon={<Share2 size={14} />} label="Share" onClick={() => toast.success('Share link copied')} />
                <ActionButton icon={<Edit3 size={14} />} label="Rename" onClick={() => toast.info('Rename modal opening...')} />
                <ActionButton icon={<Archive size={14} />} label="Archive" onClick={() => toast.success('Project archived')} />
                <div className="h-px bg-white/5 my-2" />
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <X size={14} />
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors">
      {icon}
      {label}
    </button>
  );
}

// Retry button component for failed/stuck materials
function RetryButton({ material, onRetrySuccess }: { material: Material; onRetrySuccess: () => Promise<void> | void }) {
  const [isRetrying, setIsRetrying] = useState(false);

  // Check if material needs retry
  const needsRetry = material.processing_status === 'failed' ||
    (material.processing_status === 'processing' && material.processing_progress === 0);

  if (!needsRetry) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await materialsApi.retry(material.id);
      toast.success('Processing restarted');
      await onRetrySuccess();
    } catch (error) {
      toast.error('Failed to restart processing');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-400 mb-1">
            {material.processing_status === 'failed' ? 'Processing Failed' : 'Processing Stuck'}
          </p>
          <p className="text-xs text-white/40">
            {material.processing_status === 'failed'
              ? 'An error occurred while processing this material.'
              : 'Processing appears to be stuck at 0%. Try restarting.'}
          </p>
        </div>
      </div>
      <button
        onClick={handleRetry}
        disabled={isRetrying}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isRetrying ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Retrying...
          </>
        ) : (
          <>
            <RotateCcw size={16} />
            Retry Processing
          </>
        )}
      </button>
    </div>
  );
}

// --- TABS CONTENT ---

interface ChatTabProps {
  material: Material;
  messages: TutorMessage[];
  sendMessage: (message: string, context?: 'chat' | 'selection') => Promise<any>;
  sending: boolean;
  loading: boolean;
}

function ChatTab({ material, messages, sendMessage, sending, loading }: ChatTabProps) {
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const messageText = input;
    setInput('');
    try {
      await sendMessage(messageText);
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Start a conversation</h3>
              <p className="text-white/40">Ask questions about <strong>{material.title}</strong></p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'assistant' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/10 border-white/20 text-white'}`}>
                {msg.role === 'assistant' ? <Sparkles size={14} /> : <div className="text-xs font-bold">ME</div>}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'assistant' ? 'bg-white/5 text-white/90 rounded-tl-none' : 'bg-primary/10 text-white rounded-tr-none'}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 shrink-0 max-w-3xl mx-auto w-full">
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          {['Summarize section 2', 'Create flashcards', 'Explain key terms', 'Give me a quiz'].map(suggestion => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
            placeholder="Ask anything about this material..."
            disabled={sending}
            className="w-full h-12 bg-[#0A0A0C] border border-white/10 rounded-xl px-4 pr-12 text-sm text-white placeholder:text-white/30 focus:border-primary/30 focus:outline-none transition-colors shadow-lg disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="absolute right-2 top-2 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeft size={16} className="rotate-90" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Table of Contents component for Summary view
// Summary section interface
interface SummarySection {
  id: string;
  title: string;
  topics: string[];
  readTime: number;
  content: string;
  keyPoints: string[];
}

function TableOfContentsSummary({ summary }: { summary: string }) {
  const sections = parseSummaryIntoSections(summary);

  return (
    <div className="space-y-1">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => toast.info(`Focused on: ${section.title}`)}
          className="w-full text-left p-2 rounded-lg hover:bg-white/5 text-xs text-white/60 hover:text-white transition-colors group"
        >
          <div className="flex items-start gap-2">
            <span className="text-white/20 font-mono shrink-0 mt-0.5">#</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{section.title}</p>
              <p className="text-[10px] text-white/30 truncate">
                {section.readTime} mins • {section.topics.join(', ')}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Helper function to parse summary - defined before it's used
function parseSummaryIntoSections(summaryText: string): SummarySection[] {
  // Split by double newlines or paragraph breaks
  const paragraphs = summaryText.split(/\n\n+/).filter(p => p.trim());

  if (paragraphs.length === 0) {
    return [{
      id: 'overview',
      title: 'Overview',
      topics: ['General Summary'],
      readTime: Math.ceil(summaryText.split(' ').length / 200),
      content: summaryText,
      keyPoints: []
    }];
  }

  // Try to extract sections from the text
  const sections: SummarySection[] = [];
  let currentSection: SummarySection | null = null;

  paragraphs.forEach((para, index) => {
    const trimmed = para.trim();
    const wordCount = trimmed.split(' ').length;
    const readTime = Math.ceil(wordCount / 200);

    // Check if this looks like a section header (short line, possibly with colon or number)
    const isHeader = wordCount < 10 && (
      /^[\d]+[\.\)]\s/.test(trimmed) ||
      /^[A-ZА-Я].*:$/.test(trimmed) ||
      /^#+\s/.test(trimmed) ||
      (wordCount <= 5 && /^[A-ZА-Я]/.test(trimmed))
    );

    if (isHeader || index === 0) {
      // Start new section
      if (currentSection) {
        sections.push(currentSection);
      }

      const title = trimmed.replace(/^[\d#]+[\.\)]\s*/, '').replace(/:$/, '').trim();
      currentSection = {
        id: `section-${index}`,
        title: title || `Section ${sections.length + 1}`,
        topics: [],
        readTime: readTime,
        content: isHeader ? '' : trimmed,
        keyPoints: []
      };
    } else if (currentSection) {
      // Add to current section
      currentSection.content += (currentSection.content ? '\n\n' : '') + trimmed;
      currentSection.readTime += readTime;

      // Try to extract key points from bullet points
      const bullets = trimmed.match(/^[-•*]\s.+$/gm);
      if (bullets) {
        currentSection.keyPoints.push(...bullets.map(b => b.replace(/^[-•*]\s/, '')));
      }
    }
  });

  if (currentSection) {
    sections.push(currentSection);
  }

  // If we only got one section, try to create a more structured view
  if (sections.length === 1 && sections[0].content.length > 500) {
    const content = sections[0].content;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

    if (sentences.length >= 4) {
      const chunkSize = Math.ceil(sentences.length / 3);
      return [
        {
          id: 'intro',
          title: 'Introduction & Overview',
          topics: ['Core Concepts', 'Background'],
          readTime: Math.ceil(chunkSize * 15 / 200),
          content: sentences.slice(0, chunkSize).join('. ') + '.',
          keyPoints: sentences.slice(0, 2).map(s => s.trim())
        },
        {
          id: 'main',
          title: 'Key Concepts & Analysis',
          topics: ['Main Ideas', 'Details'],
          readTime: Math.ceil(chunkSize * 15 / 200),
          content: sentences.slice(chunkSize, chunkSize * 2).join('. ') + '.',
          keyPoints: sentences.slice(chunkSize, chunkSize + 2).map(s => s.trim())
        },
        {
          id: 'conclusion',
          title: 'Conclusions & Insights',
          topics: ['Summary', 'Takeaways'],
          readTime: Math.ceil((sentences.length - chunkSize * 2) * 15 / 200),
          content: sentences.slice(chunkSize * 2).join('. ') + '.',
          keyPoints: sentences.slice(-2).map(s => s.trim())
        }
      ];
    }
  }

  return sections.length > 0 ? sections : [{
    id: 'overview',
    title: 'Overview',
    topics: ['General Summary'],
    readTime: Math.ceil(summaryText.split(' ').length / 200),
    content: summaryText,
    keyPoints: []
  }];
}

interface SummaryTabProps {
  material: Material;
  summary: MaterialSummary | null;
  loading: boolean;
}

function SummaryTab({ summary, loading }: SummaryTabProps) {
  const navigate = useNavigate();

  const sections = summary ? parseSummaryIntoSections(summary.summary) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
          <FileText size={40} />
        </div>
        <h2 className="text-2xl font-medium text-white mb-2">No Summary Yet</h2>
        <p className="text-white/40 max-w-md mb-8">
          Summary has not been generated for this material yet.
        </p>
        <button
          onClick={() => toast.info('Summary generation coming soon')}
          className="px-6 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all"
        >
          Generate Summary
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-12 overflow-y-auto h-full scrollbar-hide">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-medium text-white">Executive Summary</h2>
        <div className="flex gap-2">
          <button
            className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
            title="Export PDF"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => navigate('../flashcards')}
            className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            Convert to Flashcards
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <section
            key={section.id}
            className="relative pl-6 border-l border-white/10 hover:border-primary/50 transition-colors group"
          >
            {/* Timeline dot */}
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-[#121215] border border-white/20 group-hover:border-primary group-hover:bg-primary transition-colors" />

            {/* Section title with read time */}
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-3">
              {section.title}
              <span className="text-xs font-normal text-white/30 px-2 py-0.5 rounded-full bg-white/5">
                {section.readTime} min read
              </span>
            </h3>

            {/* Section content */}
            <p className="text-white/60 leading-relaxed font-light mb-4">
              {section.content}
            </p>

            {/* Key Points box */}
            {section.keyPoints.length > 0 && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Key Points</h4>
                <ul className="space-y-2">
                  {section.keyPoints.slice(0, 4).map((point, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/80">
                      <span className="text-primary">•</span>
                      {point.length > 120 ? point.substring(0, 120) + '...' : point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

interface FlashcardsTabProps {
  material: Material;
  flashcards: Flashcard[];
  loading: boolean;
  onNavigate?: (view: ViewState) => void;
  onSelectDeck?: (id: number) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function FlashcardsTab({ material, flashcards, loading, onNavigate, onSelectDeck, navigate }: FlashcardsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
          <Brain size={40} />
        </div>
        <h2 className="text-2xl font-medium text-white mb-2">No Flashcards Yet</h2>
        <p className="text-white/40 max-w-md mb-8">
          Flashcards have not been generated for this material yet.
        </p>
        <button
          onClick={() => toast.info('Flashcard generation coming soon')}
          className="px-6 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all"
        >
          Generate Flashcards
        </button>
      </div>
    );
  }

  // READY STATE
  return (
    <div className="max-w-3xl mx-auto p-12 h-full overflow-y-auto scrollbar-hide">
      <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-8 mb-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-24 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(255,138,61,0.1)] relative">
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
            <Brain size={32} className="text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-white mb-1">Flashcard Deck</h2>
            <p className="text-white/40 text-sm">{material.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xl font-bold text-white mb-1">{flashcards.length}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Cards</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xl font-bold text-emerald-400 mb-1">Ready</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Status</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xl font-bold text-white mb-1">{material.type.toUpperCase()}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Source</div>
          </div>
        </div>
      </div>

      {/* Flashcard Preview */}
      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-medium text-white/60 mb-4">Card Preview</h3>
        {flashcards.slice(0, 3).map((card) => (
          <div key={card.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div>
              <div className="text-xs text-white/30 mb-1">Question:</div>
              <div className="text-white/90">{card.question}</div>
            </div>
            <div>
              <div className="text-xs text-white/30 mb-1">Answer:</div>
              <div className="text-white/60">{card.answer}</div>
            </div>
            {card.difficulty && (
              <div className="text-xs text-white/40">Difficulty: {card.difficulty}</div>
            )}
          </div>
        ))}
        {flashcards.length > 3 && (
          <p className="text-xs text-white/30 text-center">+ {flashcards.length - 3} more cards</p>
        )}
      </div>

      <button
        onClick={() => navigate(`/dashboard/flashcards/${material.id}`)}
        className="w-full px-8 py-4 bg-primary text-black rounded-xl font-bold text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,138,61,0.2)] flex items-center justify-center gap-3"
      >
        <Play size={20} fill="currentColor" />
        Start Review
      </button>
    </div>
  );
}
