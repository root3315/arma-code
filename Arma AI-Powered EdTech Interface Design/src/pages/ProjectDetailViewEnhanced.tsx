/**
 * Enhanced ProjectDetailView with new UX components
 * - ProcessingModal for upload feedback
 * - DashboardHero for primary CTAs
 * - ProgressiveReveal for content sections
 * - PDFWrapper for split-view
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Youtube, Link as LinkIcon, Loader2, CheckCircle, AlertCircle, Folder, BookOpen, BrainCircuit, ClipboardList, Trash2, MessageSquare, Upload, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProject, useProjectContent, useMaterialContent, useTutorChat } from '../hooks/useApi';
import { toast } from 'sonner';
import { projectsApi, materialsApi } from '../services/api';
import { FlashcardsTab } from '../components/dashboard/tabs/FlashcardsTab';
import { QuizTab } from '../components/dashboard/tabs/QuizTab';
import { ChatTab } from '../components/dashboard/tabs/ChatTab';
import { ProcessingModal, DashboardHero, ProgressiveReveal, useRevealSections, OnboardingTour } from '../components/dashboard';
import { PDFWrapper } from '../components/material/PDFWrapper';
import { useMaterialUpload } from '../hooks/useMaterialUpload';

export function ProjectDetailViewEnhanced() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, loading, refetch } = useProject(projectId || null);
  const { content, loading: contentLoading } = useProjectContent(projectId || null);
  const [activeTab, setActiveTab] = useState<'chat' | 'materials' | 'summary' | 'flashcards' | 'quiz'>('materials');
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const { content: materialContent, loading: materialLoading } = useMaterialContent(selectedMaterialId);
  const { messages: tutorMessages, sendMessage, sending, loading: chatLoading, isTyping } = useTutorChat(
    viewMode === 'single' ? selectedMaterialId : null,
    viewMode === 'all' ? projectId : null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);

  // Upload flow with processing modal
  const {
    uploading,
    showProcessingModal,
    status: uploadStatus,
    isComplete: uploadComplete,
    isFailed: uploadFailed,
    statusError: uploadError,
    startUpload,
    handleCloseModal,
  } = useMaterialUpload();

  // Progressive reveal for content sections
  const revealedSections = useRevealSections(['summary', 'notes', 'flashcards', 'quiz'], 600);

  useEffect(() => {
    if (!project || loading) {
      return;
    }

    if (project.materials.length === 1) {
      navigate(`/dashboard/materials/${project.materials[0].id}`, { replace: true });
    }
  }, [project, loading, navigate]);

  // Upload handlers
  const handleUploadPDF = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.doc,.txt,.md,.html,.rtf,.odt,.epub';
    input.multiple = false;

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      await startUpload(async () => {
        const formData = new FormData();
        formData.append('title', file.name);
        formData.append('material_type', 'pdf');
        formData.append('file', file);
        if (projectId) {
          formData.append('project_id', projectId);
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/materials`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Upload failed');
        }

        const material = await response.json();
        refetch();
        return material.id;
      });
    };

    input.click();
  }, [projectId, startUpload, refetch]);

  const handleUploadYouTube = useCallback(async () => {
    const url = prompt('Enter YouTube URL:');
    if (!url) return;

    await startUpload(async () => {
      const formData = new FormData();
      formData.append('title', `YouTube: ${url}`);
      formData.append('material_type', 'youtube');
      formData.append('source', url);
      if (projectId) {
        formData.append('project_id', projectId);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/materials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const material = await response.json();
      refetch();
      return material.id;
    });
  }, [projectId, startUpload, refetch]);

  const handleUploadNotes = useCallback(async () => {
    toast.info('Notes upload coming soon! Use PDF upload for now.');
  }, []);

  const handleDeleteProject = async () => {
    if (!project) return;

    if (!confirm(`Are you sure you want to delete project "${project.name}"? This will permanently delete all materials and generated content.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await projectsApi.delete(projectId!);
      toast.success('Project deleted successfully');

      window.dispatchEvent(new CustomEvent('project-deleted', { detail: { projectId } }));
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewPdf = useCallback((material: any) => {
    if (material.file_path) {
      setCurrentPdfUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/storage/${material.file_path}`);
      setShowPdfViewer(true);
    }
  }, []);

  if (!projectId) {
    return null;
  }

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'youtube':
        return <Youtube className="w-5 h-5" />;
      case 'article':
        return <LinkIcon className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getMaterialColor = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'bg-blue-500/10 text-blue-400';
      case 'youtube':
        return 'bg-red-500/10 text-red-400';
      case 'article':
        return 'bg-purple-500/10 text-purple-400';
      default:
        return 'bg-white/10 text-white';
    }
  };

  const getStatusBadge = (status: string, progress: number) => {
    if (status === 'completed') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium">
          <CheckCircle size={12} />
          Ready
        </span>
      );
    }
    if (status === 'processing') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#FF8A3D]/10 text-[#FF8A3D] text-xs font-medium">
          <Loader2 size={12} className="animate-spin" />
          Processing {progress}%
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-medium">
          <AlertCircle size={12} />
          Failed
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-md bg-white/10 text-white/60 text-xs font-medium">
        Queued
      </span>
    );
  };

  const markdownComponents = {
    h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-[#F3F3F3] mt-6 mb-4" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-[#F3F3F3] mt-5 mb-3" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-[#F3F3F3] mt-4 mb-2" {...props} />,
    h4: ({node, ...props}: any) => <h4 className="text-base font-semibold text-[#F3F3F3] mt-3 mb-2" {...props} />,
    p: ({node, ...props}: any) => <p className="mb-4 text-[#9CA3AF] leading-relaxed" {...props} />,
    strong: ({node, ...props}: any) => <strong className="font-bold text-[#F3F3F3]" {...props} />,
    em: ({node, ...props}: any) => <em className="italic text-[#9CA3AF]" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
    li: ({node, ...props}: any) => <li className="ml-4 text-[#9CA3AF]" {...props} />,
    blockquote: ({node, ...props}: any) => (
      <blockquote className="border-l-4 border-[#FF8A3D]/50 pl-4 my-4 italic text-[#9CA3AF]/60" {...props} />
    ),
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <pre className="bg-[#0C0C0F]/50 p-5 rounded-xl overflow-x-auto my-4 border border-white/[0.06]">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className="bg-[#FF8A3D]/10 text-[#FF8A3D] font-medium px-1.5 py-0.5 rounded text-sm inline-block" {...props}>
          {children}
        </code>
      );
    },
    pre: ({node, ...props}: any) => <pre className="mb-4" {...props} />,
    hr: ({node, ...props}: any) => <hr className="border-white/[0.06] my-6" {...props} />,
  };

  return (
    <div className="min-h-screen bg-[#0C0C0F]">
      {/* Header */}
      <div className="border-b border-white/[0.08] bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 bg-[#FF8A3D]/10 rounded-xl flex items-center justify-center">
                  <Folder className="w-5 h-5 text-[#FF8A3D]" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-[#F3F3F3] md:text-xl">{project?.name || 'Loading...'}</h1>
                  <p className="text-sm text-[#9CA3AF]">
                    {project?.materials.length || 0} materials
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleUploadPDF}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF8A3D] text-white rounded-lg hover:bg-[#FF8A3D]/90 transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Material</span>
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting || !project}
                className="flex items-center justify-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span className="hidden sm:inline text-sm font-medium">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'chat', icon: MessageSquare, label: 'Chat' },
              { id: 'materials', icon: FileText, label: 'Materials' },
              { id: 'summary', icon: BookOpen, label: 'Summary' },
              { id: 'flashcards', icon: BrainCircuit, label: 'Flashcards' },
              { id: 'quiz', icon: ClipboardList, label: 'Quiz' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === id
                    ? 'border-[#FF8A3D] text-[#FF8A3D]'
                    : 'border-transparent text-[#9CA3AF] hover:text-[#F3F3F3]'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}

            {/* View Mode Toggle */}
            {(activeTab === 'flashcards' || activeTab === 'quiz' || activeTab === 'chat') && project && project.materials.length > 0 && (
              <div className="ml-auto flex items-center gap-2 bg-white/[0.06] rounded-lg p-1">
                <button
                  onClick={() => { setViewMode('all'); setSelectedMaterialId(null); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-[#FF8A3D] text-black'
                      : 'text-[#9CA3AF] hover:text-[#F3F3F3]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => { setViewMode('single'); setSelectedMaterialId(project.materials[0]?.id || null); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'single'
                      ? 'bg-[#FF8A3D] text-black'
                      : 'text-[#9CA3AF] hover:text-[#F3F3F3]'
                  }`}
                >
                  Single
                </button>
                {viewMode === 'single' && (
                  <select
                    value={selectedMaterialId || ''}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="bg-white/[0.1] border border-white/[0.06] rounded-md px-2 py-1 text-xs text-[#F3F3F3] focus:outline-none focus:border-[#FF8A3D]/50"
                  >
                    {project.materials.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.title.length > 30 ? material.title.substring(0, 30) + '...' : material.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#FF8A3D] animate-spin" />
          </div>
        ) : (
          <>
            {/* Materials Tab */}
            {activeTab === 'materials' && project && (
              <>
                {/* Hero Section for empty state */}
                {project.materials.length === 0 && (
                  <div className="py-12">
                    <DashboardHero
                      onUploadPDF={handleUploadPDF}
                      onUploadVideo={handleUploadYouTube}
                      onUploadNotes={handleUploadNotes}
                      isUploading={uploading}
                    />
                  </div>
                )}

                {/* Materials Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8"
                >
                  {project.materials.map((material, index) => (
                    <ProgressiveReveal
                      key={material.id}
                      sectionId={material.id}
                      delay={200}
                      staggerDelay={index * 100}
                    >
                      <div
                        onClick={() => navigate(`/dashboard/materials/${material.id}`)}
                        className="group cursor-pointer p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#FF8A3D]/30 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getMaterialColor(material.type)}`}>
                            {getMaterialIcon(material.type)}
                          </div>
                          {getStatusBadge(material.processing_status, material.processing_progress)}
                        </div>
                        <h3 className="text-base font-medium text-[#F3F3F3]/90 mb-3 line-clamp-2">
                          {material.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                          <FileText size={12} />
                          <span className="uppercase">{material.type}</span>
                        </div>
                      </div>
                    </ProgressiveReveal>
                  ))}
                </motion.div>
              </>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full"
              >
                {viewMode === 'single' && selectedMaterialId ? (
                  <ChatTab
                    material={project?.materials.find(m => m.id === selectedMaterialId) as any}
                    messages={tutorMessages}
                    sendMessage={sendMessage}
                    sending={sending}
                    loading={chatLoading}
                    isTyping={isTyping}
                  />
                ) : viewMode === 'all' && projectId ? (
                  <ChatTab
                    material={{
                      id: projectId,
                      title: 'All Materials',
                      type: 'mixed',
                      processing_status: 'completed',
                      processing_progress: 100,
                      created_at: new Date().toISOString(),
                      file_path: '',
                      source_url: '',
                      flashcards_count: content?.flashcards?.length || 0,
                      quiz_count: content?.quiz?.length || 0,
                      summary_status: content?.summary ? 'completed' : 'pending',
                      podcast_status: 'pending',
                      presentation_status: 'pending',
                    } as any}
                    projectId={projectId}
                    messages={tutorMessages}
                    sendMessage={sendMessage}
                    sending={sending}
                    loading={chatLoading}
                    isTyping={isTyping}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                      <div className="w-16 h-16 rounded-full bg-[#FF8A3D]/10 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-8 h-8 text-[#FF8A3D]" />
                      </div>
                      <h3 className="text-lg font-medium text-[#F3F3F3] mb-2">
                        Select a Material to Chat
                      </h3>
                      <p className="text-[#9CA3AF] mb-6">
                        AI Tutor chat is available per material or for all materials.
                      </p>
                      <button
                        onClick={() => { setViewMode('single'); setSelectedMaterialId(project?.materials[0]?.id || null); }}
                        className="px-6 py-3 bg-[#FF8A3D] text-black rounded-xl font-bold hover:bg-[#FF8A3D]/90 transition-all"
                      >
                        Switch to Single Material
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl space-y-6"
              >
                {contentLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-[#FF8A3D] animate-spin" />
                  </div>
                ) : viewMode === 'all' && content?.summary ? (
                  <ProgressiveRevealGroup
                    sections={[
                      {
                        id: 'summary',
                        content: (
                          <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-lg bg-[#FF8A3D]/10 flex items-center justify-center">
                                <BookOpen className="w-4 h-4 text-[#FF8A3D]" />
                              </div>
                              <h2 className="text-xl font-semibold text-[#F3F3F3]">Summary (All Materials)</h2>
                            </div>
                            <div className="markdown-content text-[#9CA3AF] leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {content.summary}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ),
                      },
                      {
                        id: 'notes',
                        content: content.notes && (
                          <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-blue-400" />
                              </div>
                              <h2 className="text-xl font-semibold text-[#F3F3F3]">Key Notes</h2>
                            </div>
                            <div className="markdown-content text-[#9CA3AF] leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {content.notes}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ),
                      },
                      {
                        id: 'stats',
                        content: (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                              <div className="text-sm text-[#9CA3AF] mb-1">Materials</div>
                              <div className="text-2xl font-semibold text-[#F3F3F3]">{content.total_materials}</div>
                            </div>
                            <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                              <div className="text-sm text-[#9CA3AF] mb-1">Flashcards</div>
                              <div className="text-2xl font-semibold text-[#F3F3F3]">{content.flashcards?.length || 0}</div>
                            </div>
                            <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                              <div className="text-sm text-[#9CA3AF] mb-1">Quiz Questions</div>
                              <div className="text-2xl font-semibold text-[#F3F3F3]">{content.quiz?.length || 0}</div>
                            </div>
                          </div>
                        ),
                      },
                    ]}
                    baseDelay={400}
                    staggerDelay={400}
                  />
                ) : viewMode === 'single' && selectedMaterialId && materialContent ? (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-[#FF8A3D]/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-[#FF8A3D]" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-[#F3F3F3]">Summary</h2>
                          <p className="text-sm text-[#9CA3AF] truncate max-w-md">{materialContent.title}</p>
                        </div>
                      </div>
                      {materialContent.summary ? (
                        <div className="markdown-content text-[#9CA3AF] leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {materialContent.summary}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-[#9CA3AF] text-sm">No summary available</p>
                      )}
                    </div>
                    {materialContent.notes && (
                      <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-400" />
                          </div>
                          <h2 className="text-xl font-semibold text-[#F3F3F3]">Key Notes</h2>
                        </div>
                        <div className="markdown-content text-[#9CA3AF] leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {materialContent.notes}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl">
                    <BookOpen className="w-12 h-12 text-[#9CA3AF]/20 mx-auto mb-4" />
                    <p className="text-[#9CA3AF]">Summary is being generated...</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Flashcards Tab */}
            {activeTab === 'flashcards' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {(materialLoading || contentLoading) ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-[#FF8A3D] animate-spin" />
                  </div>
                ) : viewMode === 'all' && content?.flashcards && content.flashcards.length > 0 ? (
                  <FlashcardsTab
                    material={{
                      id: 'all',
                      title: 'All Materials',
                      type: 'mixed',
                      processing_status: 'completed',
                      processing_progress: 100,
                      created_at: new Date().toISOString(),
                      file_path: '',
                      source_url: '',
                      flashcards_count: content.flashcards.length,
                      quiz_count: content?.quiz?.length || 0,
                      summary_status: content?.summary ? 'completed' : 'pending',
                      podcast_status: 'pending',
                      presentation_status: 'pending',
                    } as any}
                    flashcards={content.flashcards}
                    loading={contentLoading}
                    viewMode="all"
                  />
                ) : viewMode === 'single' && selectedMaterialId ? (
                  materialLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-[#FF8A3D] animate-spin" />
                    </div>
                  ) : materialContent?.flashcards && materialContent.flashcards.length > 0 ? (
                    (() => {
                      const material = project?.materials.find(m => m.id === selectedMaterialId);
                      if (!material) return null;
                      return (
                        <FlashcardsTab
                          material={material as any}
                          flashcards={materialContent.flashcards}
                          loading={false}
                          viewMode="single"
                        />
                      );
                    })()
                  ) : (
                    <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl">
                      <BrainCircuit className="w-12 h-12 text-[#9CA3AF]/20 mx-auto mb-4" />
                      <p className="text-[#9CA3AF]">No flashcards available</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl">
                    <BrainCircuit className="w-12 h-12 text-[#9CA3AF]/20 mx-auto mb-4" />
                    <p className="text-[#9CA3AF]">Flashcards are being generated...</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {(contentLoading || materialLoading) ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-[#FF8A3D] animate-spin" />
                  </div>
                ) : viewMode === 'single' && selectedMaterialId ? (
                  materialLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-[#FF8A3D] animate-spin" />
                    </div>
                  ) : materialContent?.quiz && materialContent.quiz.length > 0 ? (
                    (() => {
                      const material = project?.materials.find(m => m.id === selectedMaterialId);
                      if (!material) return null;
                      return (
                        <QuizTab
                          material={material as any}
                          questions={materialContent.quiz}
                          loading={false}
                          viewMode="single"
                        />
                      );
                    })()
                  ) : (
                    <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl">
                      <ClipboardList className="w-12 h-12 text-[#9CA3AF]/20 mx-auto mb-4" />
                      <p className="text-[#9CA3AF]">No quiz available</p>
                    </div>
                  )
                ) : viewMode === 'all' && content?.quiz && content.quiz.length > 0 ? (
                  <QuizTab
                    material={{
                      id: 'all',
                      title: 'All Materials',
                      type: 'mixed',
                      processing_status: 'completed',
                      processing_progress: 100,
                      created_at: new Date().toISOString(),
                      file_path: '',
                      source_url: '',
                      flashcards_count: content?.flashcards?.length || 0,
                      quiz_count: content?.quiz?.length || 0,
                      summary_status: content?.summary ? 'completed' : 'pending',
                      podcast_status: 'pending',
                      presentation_status: 'pending',
                    } as any}
                    questions={content.quiz || []}
                    loading={contentLoading}
                    viewMode="all"
                  />
                ) : (
                  <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-2xl">
                    <ClipboardList className="w-12 h-12 text-[#9CA3AF]/20 mx-auto mb-4" />
                    <p className="text-[#9CA3AF]">Quiz is being generated...</p>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={showProcessingModal}
        realProgress={uploadStatus?.progress || 0}
        isComplete={uploadComplete}
        isError={uploadFailed}
        errorMessage={uploadError}
        onClose={handleCloseModal}
      />

      {/* Onboarding Tour */}
      <OnboardingTour />
    </div>
  );
}

// Helper component for ProgressiveRevealGroup
function ProgressiveRevealGroup({ sections, baseDelay = 400, staggerDelay = 400 }: any) {
  return (
    <>
      {sections.map((section: any, index: number) => (
        <ProgressiveReveal
          key={section.id}
          sectionId={section.id}
          delay={section.delay || baseDelay}
          staggerDelay={index * staggerDelay}
        >
          {section.content}
        </ProgressiveReveal>
      ))}
    </>
  );
}
