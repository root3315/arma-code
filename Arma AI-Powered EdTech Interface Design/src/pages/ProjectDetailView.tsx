import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Youtube, Link as LinkIcon, Loader2, CheckCircle, AlertCircle, Folder, BookOpen, BrainCircuit, ClipboardList, Trash2, MessageSquare, Plus, Lock, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProject, useProjectContent, useMaterialContent, useTutorChat } from '../hooks/useApi';
import { useProjectProgress } from '../hooks/useProjectProgress';
import { useTranslation } from '../i18n/I18nContext';
import { toast } from 'sonner';
import { projectsApi, materialsApi } from '../services/api';
import { FlashcardsTab } from '../components/dashboard/tabs/FlashcardsTab';
import { QuizTab } from '../components/dashboard/tabs/QuizTab';
import { ChatTab } from '../components/dashboard/tabs/ChatTab';
import { ProcessingModal, ProgressiveReveal, OnboardingTour, DashboardHero } from '../components/dashboard';
import { useMaterialUpload } from '../hooks/useMaterialUpload';

export function ProjectDetailView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, loading, refetch } = useProject(projectId || null);
  const { content, loading: contentLoading } = useProjectContent(projectId || null);
  const { progress, markSummaryRead, markFlashcardsComplete } = useProjectProgress(projectId || null);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'chat' | 'materials' | 'summary' | 'flashcards' | 'quiz'>('materials');
  const [showCelebration, setShowCelebration] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const { content: materialContent, loading: materialLoading } = useMaterialContent(selectedMaterialId);
  const { messages: tutorMessages, sendMessage, sending, loading: chatLoading, isTyping } = useTutorChat(
    viewMode === 'single' ? selectedMaterialId : null,
    viewMode === 'all' ? projectId : null
  );
  const [isDeleting, setIsDeleting] = useState(false);

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
  } = useMaterialUpload(refetch);

  // Auto-refresh only materials that are still processing (no UI refetch animation)
  useEffect(() => {
    if (!projectId || !project) return;

    // Check if any material is still processing (case-insensitive)
    const hasProcessingMaterials = project.materials.some(
      m => {
        const status = (m.processing_status || '').toLowerCase();
        return status === 'queued' || status === 'processing';
      }
    );

    if (!hasProcessingMaterials) return;

    // Silent refresh every 5 seconds only for processing materials
    const interval = setInterval(async () => {
      await refetch(false); // Don't show loading animation
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, project?.materials.map(m => `${m.id}-${m.processing_status}`).join(','), refetch]);

  // Upload handlers
  const handleUploadPDF = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.doc,.txt,.md,.html,.rtf,.odt,.epub';
    input.multiple = false;

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
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
          return material.id;
        });
      } catch (error) {
        console.error('[handleUploadPDF] Error:', error);
      }
    };

    input.click();
  };

  const handleUploadYouTube = async () => {
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
      // Don't refetch here - let the polling handle status updates
      return material.id;
    });
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    
    if (!confirm(`Are you sure you want to delete project "${project.name}"? This will permanently delete all materials and generated content.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await projectsApi.delete(projectId!);
      toast.success('Project deleted successfully');
      
      // Notify parent to refresh projects list
      window.dispatchEvent(new CustomEvent('project-deleted', { detail: { projectId } }));
      
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

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
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-white/60" />
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Folder className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-white md:text-xl">{project?.name || 'Loading...'}</h1>
                  <p className="text-sm text-white/40">
                    {project?.materials.length || 0} {project?.materials.length === 1 ? t('project.material_count') : t('project.materials_count')}
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
                <span className="hidden sm:inline">{t('project.add_material')}</span>
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting || !project}
                className="flex w-auto items-center justify-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span className="hidden sm:inline text-sm font-medium">{t('project.delete_project')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <MessageSquare size={16} />
              {t('project.tabs.chat')}
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'materials'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <FileText size={16} />
              {t('project.tabs.materials')}
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'summary'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <BookOpen size={16} />
              {t('project.tabs.summary')}
            </button>
            <button
              onClick={() => {
                if (progress?.flashcards_unlocked) setActiveTab('flashcards');
              }}
              disabled={!progress?.flashcards_unlocked}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'flashcards'
                  ? 'border-primary text-primary cursor-pointer'
                  : progress?.flashcards_unlocked
                    ? 'border-transparent text-white/40 hover:text-white/60 cursor-pointer'
                    : 'border-transparent text-white/20 cursor-not-allowed'
              }`}
            >
              {progress?.flashcards_unlocked ? (
                <BrainCircuit size={16} />
              ) : (
                <Lock size={16} />
              )}
              {t('project.tabs.flashcards')}
              {!progress?.flashcards_unlocked && (
                <span className="text-[10px] text-white/20 ml-1">({t('project.read_summary_first')})</span>
              )}
            </button>
            <button
              onClick={() => {
                if (progress?.quiz_unlocked) setActiveTab('quiz');
              }}
              disabled={!progress?.quiz_unlocked}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'quiz'
                  ? 'border-primary text-primary cursor-pointer'
                  : progress?.quiz_unlocked
                    ? 'border-transparent text-white/40 hover:text-white/60 cursor-pointer'
                    : 'border-transparent text-white/20 cursor-not-allowed'
              }`}
            >
              {progress?.quiz_unlocked ? (
                <ClipboardList size={16} />
              ) : (
                <Lock size={16} />
              )}
              {t('project.tabs.quiz')}
              {!progress?.quiz_unlocked && (
                <span className="text-[10px] text-white/20 ml-1">({t('project.complete_flashcards_first')})</span>
              )}
            </button>

            
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Materials Tab */}
            {activeTab === 'materials' && project && (
              <>
                {/* Hero Section for empty state - NEW */}
                {project.materials.length === 0 && (
                  <div className="py-12">
                    <DashboardHero
                      onUploadPDF={handleUploadPDF}
                      onUploadVideo={handleUploadYouTube}
                      onUploadNotes={handleUploadPDF}
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
                        className="group cursor-pointer p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-primary/20 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getMaterialColor(material.type)}`}>
                            {getMaterialIcon(material.type)}
                          </div>
                          {getStatusBadge(material.processing_status, material.processing_progress)}
                        </div>
                        <h3 className="text-base font-medium text-white/90 mb-3 line-clamp-2">
                          {material.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-white/40">
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
                  // All Materials mode - chat about all materials in project
                  <ChatTab
                    material={{
                      id: projectId,
                      title: t('project.view_mode.all'),
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
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">
                        {t('project.select_material')}
                      </h3>
                      <p className="text-white/40 mb-6">
                        {t('project.chat_desc')}
                      </p>
                      <button
                        onClick={() => { setViewMode('single'); setSelectedMaterialId(project?.materials[0]?.id || null); }}
                        className="px-6 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all"
                      >
                        {t('project.switch_single')}
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
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : viewMode === 'all' && content?.summary ? (
                  <>
                    {/* Summary Section */}
                    <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-xl font-semibold text-white">{t('project.summary_all')}</h2>
                      </div>
                      <div className="markdown-content text-white/70 leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-6 mb-4" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />,
                            h4: ({node, ...props}) => <h4 className="text-base font-semibold text-white mt-3 mb-2" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-white/80" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="ml-4" {...props} />,
                            blockquote: ({node, ...props}) => (
                              <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-white/60" {...props} />
                            ),
                            code: ({node, inline, className, children, ...props}: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <pre className="bg-black/30 p-5 rounded-xl overflow-x-auto my-4 border border-white/8">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              ) : (
                                <code className="bg-primary/8 text-primary font-medium px-1.5 py-0.5 rounded text-sm inline-block" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            pre: ({node, ...props}) => <pre className="mb-4" {...props} />,
                            hr: ({node, ...props}) => <hr className="border-white/10 my-6" {...props} />,
                          }}
                        >
                          {content.summary}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Notes Section */}
                    {content.notes && (
                      <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-400" />
                          </div>
                          <h2 className="text-xl font-semibold text-white">{t('project.key_notes')}</h2>
                        </div>
                        <div className="markdown-content text-white/70 leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-6 mb-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />,
                              h4: ({node, ...props}) => <h4 className="text-base font-semibold text-white mt-3 mb-2" {...props} />,
                              p: ({node, ...props}) => <p className="mb-4" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                              em: ({node, ...props}) => <em className="italic text-white/80" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="ml-4" {...props} />,
                              blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-white/60" {...props} />
                              ),
                              code: ({node, inline, className, children, ...props}: any) => {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <pre className="bg-black/30 p-5 rounded-xl overflow-x-auto my-4 border border-white/8">
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                ) : (
                                  <code className="bg-primary/8 text-primary font-medium px-1.5 py-0.5 rounded text-sm inline-block" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              pre: ({node, ...props}) => <pre className="mb-4" {...props} />,
                              hr: ({node, ...props}) => <hr className="border-white/10 my-6" {...props} />,
                            }}
                          >
                            {content.notes}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="text-sm text-white/40 mb-1">{t('project.tabs.materials')}</div>
                        <div className="text-2xl font-semibold text-white">{content.total_materials}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="text-sm text-white/40 mb-1">{t('project.tabs.flashcards')}</div>
                        <div className="text-2xl font-semibold text-white">{content.flashcards?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="text-sm text-white/40 mb-1">{t('project.tabs.quiz')}</div>
                        <div className="text-2xl font-semibold text-white">{content.quiz?.length || 0}</div>
                      </div>
                    </div>

                    {/* Mark as Read Button */}
                    {!progress?.summary_read ? (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={async () => {
                            try {
                              await markSummaryRead();
                              setShowCelebration(true);
                              setTimeout(() => {
                                setShowCelebration(false);
                                setActiveTab('flashcards');
                              }, 2500);
                            } catch {
                              toast.error(t('project.failed_mark_summary'));
                            }
                          }}
                          className="cursor-pointer flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold hover:from-emerald-500/20 hover:to-emerald-500/10 transition-all text-lg"
                        >
                          <CheckCircle2 size={24} />
                          {t('project.mark_read')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center pt-4">
                        <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                          <CheckCircle size={16} />
                          {t('project.summary_read')}
                        </div>
                      </div>
                    )}

                    {/* Celebration Overlay */}
                    {showCelebration && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                      >
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="text-center"
                        >
                          <div className="text-6xl mb-6">🎉</div>
                          <motion.h2
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl font-bold text-white mb-3"
                          >
                            {t('project.celebration_title')}
                          </motion.h2>
                          <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-xl text-emerald-400 mb-2"
                          >
                            {t('project.celebration_subtitle')}
                          </motion.p>
                          <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="text-white/60"
                          >
                            {t('project.celebration_desc')}
                          </motion.p>

                          {['🎊', '✨', '🌟', '💫', '🎯'].map((emoji, i) => (
                            <motion.div
                              key={i}
                              initial={{ y: 0, x: 0, opacity: 1, scale: 0 }}
                              animate={{
                                y: [-20, -80 - i * 20],
                                x: [(i - 2) * 30, (i - 2) * 50],
                                opacity: [1, 0],
                                scale: [0, 1.5, 0],
                              }}
                              transition={{ delay: 0.3 + i * 0.1, duration: 1.5 }}
                              className="absolute text-3xl"
                              style={{
                                left: `${45 + (i - 2) * 8}%`,
                                top: '40%',
                              }}
                            >
                              {emoji}
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}
                  </>
                ) : viewMode === 'single' && selectedMaterialId && materialContent ? (
                  <>
                    {/* Summary Section for Single Material */}
                    <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-white">{t('project.summary_single')}</h2>
                          <p className="text-sm text-white/40 truncate max-w-md">{materialContent.title}</p>
                        </div>
                      </div>
                      {materialContent.summary ? (
                        <div className="markdown-content text-white/70 leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-6 mb-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />,
                              h4: ({node, ...props}) => <h4 className="text-base font-semibold text-white mt-3 mb-2" {...props} />,
                              p: ({node, ...props}) => <p className="mb-4" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                              em: ({node, ...props}) => <em className="italic text-white/80" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="ml-4" {...props} />,
                              blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-blue-500/50 pl-4 my-4 italic text-white/60" {...props} />
                              ),
                              code: ({node, inline, className, children, ...props}: any) => (
                                inline ? (
                                  <code className="bg-blue-500/10 px-1.5 py-0.5 rounded text-sm text-blue-300 font-mono" {...props} />
                                ) : (
                                  <code className="block bg-black/30 p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono text-white/80" {...props} />
                                )
                              ),
                              pre: ({node, ...props}) => <pre className="mb-4" {...props} />,
                              hr: ({node, ...props}) => <hr className="border-white/10 my-6" {...props} />,
                            }}
                          >
                            {materialContent.summary}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-white/40 text-sm">{t('project.no_summary')}</p>
                      )}
                    </div>

                    {/* Notes Section for Single Material */}
                    {materialContent.notes && (
                      <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-400" />
                          </div>
                          <h2 className="text-xl font-semibold text-white">{t('project.key_notes')}</h2>
                        </div>
                        <div className="markdown-content text-white/70 leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-6 mb-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />,
                              h4: ({node, ...props}) => <h4 className="text-base font-semibold text-white mt-3 mb-2" {...props} />,
                              p: ({node, ...props}) => <p className="mb-4" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                              em: ({node, ...props}) => <em className="italic text-white/80" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="ml-4" {...props} />,
                              blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-blue-500/50 pl-4 my-4 italic text-white/60" {...props} />
                              ),
                              code: ({node, inline, className, children, ...props}: any) => (
                                inline ? (
                                  <code className="bg-blue-500/10 px-1.5 py-0.5 rounded text-sm text-blue-300 font-mono" {...props} />
                                ) : (
                                  <code className="block bg-black/30 p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono text-white/80" {...props} />
                                )
                              ),
                              pre: ({node, ...props}) => <pre className="mb-4" {...props} />,
                              hr: ({node, ...props}) => <hr className="border-white/10 my-6" {...props} />,
                            }}
                          >
                            {materialContent.notes}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl">
                    <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">{t('project.summary_generating')}</p>
                    <p className="text-white/30 text-sm mt-2">
                      Status: {content?.processing_status || 'pending'}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Flashcards Tab */}
            {activeTab === 'flashcards' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {(materialLoading || contentLoading) ? (
                  <div className="flex items-center justify-center py-20 col-span-full">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : viewMode === 'all' && content?.flashcards && content.flashcards.length > 0 ? (
                  <FlashcardsTab
                    material={{
                      id: 'all',
                      title: t('project.view_mode.all'),
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
                    onComplete={async () => {
                      try {
                        await markFlashcardsComplete();
                        toast.success(t('project.flashcards_completed'));
                      } catch {
                        toast.error(t('project.failed_mark_flashcards'));
                      }
                    }}
                  />
                ) : viewMode === 'single' && selectedMaterialId ? (
                  materialLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
                          onComplete={async () => {
                            try {
                              await markFlashcardsComplete();
                              toast.success(t('project.flashcards_completed'));
                            } catch {
                              toast.error(t('project.failed_mark_flashcards'));
                            }
                          }}
                        />
                      );
                    })()
                  ) : (
                    <div className="text-center py-20 col-span-full border border-dashed border-white/5 rounded-2xl">
                      <BrainCircuit className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/40">{t('project.no_flashcards')}</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-20 col-span-full border border-dashed border-white/5 rounded-2xl">
                    <BrainCircuit className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">{t('project.flashcards_generating')}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {(contentLoading || materialLoading) ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : viewMode === 'single' && selectedMaterialId ? (
                  // Single Material mode
                  materialLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
                    <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl">
                      <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/40">{t('project.no_quiz')}</p>
                    </div>
                  )
                ) : viewMode === 'all' && content?.quiz && content.quiz.length > 0 ? (
                  // All Materials mode - use new QuizTab with combined data
                  <QuizTab
                    material={{
                      id: 'all',
                      title: t('project.view_mode.all'),
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
                  <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl">
                    <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">{t('project.quiz_generating')}</p>
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
