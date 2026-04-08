import React, { useState, useEffect } from 'react';
import { X, Upload, Youtube, Link, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../../i18n/I18nContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useBatchUpload } from '../../hooks/useApi';
import { FileInput } from '../upload/FileInput';
import { ProcessingModal } from '../dashboard/ProcessingModal';
import { useMaterialUpload } from '../../hooks/useMaterialUpload';

interface UploadModalProps {
  onClose: () => void;
  projectId?: string;
  onSuccess?: (result: {
    projectId: string;
    firstMaterialId?: string;
    totalFiles: number;
  }) => void;
}

interface FileObject {
  id: string;
  file: File;
}

export function UploadModal({ onClose, projectId, onSuccess }: UploadModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'upload' | 'youtube' | 'link'>('upload');
  const [projectName, setProjectName] = useState('');
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>([]);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [materials, setMaterials] = useState<FileObject[]>([]);
  const { uploadBatch, uploading } = useBatchUpload();
  
  // Processing modal state
  const [uploadedMaterialId, setUploadedMaterialId] = useState<string | null>(null);
  const {
    showProcessingModal,
    status: uploadStatus,
    isComplete: uploadComplete,
    isFailed: uploadFailed,
    statusError: uploadError,
    handleCloseModal,
  } = useMaterialUpload(() => {}, uploadedMaterialId);

  const MAX_FILES = 10;
  const totalItems = materials.length + youtubeUrls.length + linkUrls.length;
  const actionLabel = totalItems === 1
    ? t('upload.upload_label_one')
    : t('upload.upload_label_many', { count: totalItems });

  const isDuplicateFile = (a: File, b: File) =>
    a.name === b.name &&
    a.size === b.size &&
    a.lastModified === b.lastModified;

  const addMaterials = (files: File[]) => {
    setMaterials((prev) => {
      let next = [...prev];
      let duplicateCount = 0;
      let limitHit = false;

      for (const file of files) {
        const alreadyExists = next.some((item) => isDuplicateFile(item.file, file));
        if (alreadyExists) {
          duplicateCount += 1;
          continue;
        }

        if (next.length >= MAX_FILES) {
          limitHit = true;
          break;
        }

        next.push({
          id: crypto.randomUUID(),
          file,
        });
      }

      if (duplicateCount > 0) {
        toast.error(
          duplicateCount === 1
            ? t('upload.duplicate_one')
            : t('upload.duplicate_many', { count: duplicateCount }),
        );
      }

      if (limitHit) {
        toast.error(t('upload.max_files', { count: MAX_FILES }));
      }

      return next;
    });
  };

  const removeMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((file) => file.id !== id));
  };

  const addYoutubeUrl = () => {
    if (!youtubeInput.trim()) return;

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeInput)) {
      toast.error(t('upload.invalid_youtube'));
      return;
    }

    if (youtubeUrls.length >= MAX_FILES) {
      toast.error(t('upload.max_urls', { count: MAX_FILES }));
      return;
    }

    setYoutubeUrls((prev) => [...prev, youtubeInput]);
    setYoutubeInput('');
  };

  const addLinkUrl = () => {
    if (!linkInput.trim()) return;

    try {
      new URL(linkInput);
    } catch {
      toast.error(t('upload.invalid_url'));
      return;
    }

    if (linkUrls.length >= MAX_FILES) {
      toast.error(t('upload.max_urls', { count: MAX_FILES }));
      return;
    }

    setLinkUrls((prev) => [...prev, linkInput]);
    setLinkInput('');
  };

  const handleUpload = async () => {
    if (totalItems === 0) {
      toast.error(t('upload.add_one'));
      return;
    }

    if (!projectName.trim()) {
      toast.error(t('upload.enter_name'));
      return;
    }

    try {
      toast.success(t('upload.starting'));

      const result = await uploadBatch({
        project_id: projectId || undefined,
        project_name: projectId ? undefined : projectName.trim(),
        files: materials.map((item) => item.file),
        youtube_urls: youtubeUrls,
        link_urls: linkUrls,
      });

      // Set material ID for processing modal
      const firstMaterialId = result.materials[0]?.id;
      if (firstMaterialId) {
        setUploadedMaterialId(firstMaterialId);
      }

      toast.success(t('upload.uploaded', { count: result.total_files }));
      window.dispatchEvent(new CustomEvent('project-created', { detail: { projectId: result.project_id } }));

      if (onSuccess) {
        onSuccess({
          projectId: result.project_id,
          firstMaterialId: result.materials[0]?.id,
          totalFiles: result.total_files,
        });
      } else {
        // Don't navigate immediately - let user see processing modal
        // navigate(`/dashboard/projects/${result.project_id}`);
      }

      // Don't close modal yet - let processing modal show
      // onClose();
    } catch (error: any) {
      toast.error(error.message || t('upload.failed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-scroll" onClick={onClose}>
      <div className="flex w-full items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#121215] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/5 p-4 md:p-6">
            <div>
              <h2 className="text-sm font-medium text-white">{t('upload.add_materials')}</h2>
              <p className="mt-1 text-xs text-white/40">
                {totalItems}/{MAX_FILES} {t('upload.items_selected')}
              </p>
            </div>
            <button onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 transition-colors hover:text-white">
              <X size={18} />
            </button>
          </div>

          {!projectId && (
            <div className="border-b border-white/5 px-4 py-3 md:px-6 md:py-5">
              <div className="rounded-2xl border border-white/10 bg-[#0A0A0C]/90 p-3 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary/70" />
                  <input
                    type="text"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder={t('upload.project_name')}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="max-h-[80vh] overflow-y-auto p-4 md:p-6">
            <div className="mb-6 flex gap-2 rounded-2xl bg-white/5 p-1">
              {[
                { id: 'upload' as const, label: t('upload.tab_files'), icon: <Upload size={14} /> },
                { id: 'youtube' as const, label: t('upload.tab_youtube'), icon: <Youtube size={14} /> },
                { id: 'link' as const, label: t('upload.tab_link'), icon: <Link size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex h-11 py-2 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === tab.id ? 'bg-primary text-black' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {uploading ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="font-medium text-white/80">{t('upload.processing')}</p>
                <p className="text-sm text-white/40">{t('upload.queueing')}</p>
              </div>
            ) : (
              <>
                {activeTab === 'upload' && (
                  <div className="space-y-4">
                    <div className={materials.length < 4 ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto'}>
                      {materials.map((item) => (
                        <UploadItem
                          key={item.id}
                          icon={<FileText className="w-5 h-5 text-primary/70" />}
                          title={item.file.name}
                          subtitle={`${(item.file.size / 1024 / 1024).toFixed(2)} MB`}
                          onRemove={() => removeMaterial(item.id)}
                        />
                      ))}

                      {materials.length < MAX_FILES && <FileInput onAdd={addMaterials} />}
                    </div>
                    
                    <button
                      onClick={handleUpload}
                      disabled={uploading || totalItems === 0}
                      className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      
                      {actionLabel}
                    </button>
                  </div>
                )}

                {activeTab === 'youtube' && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={youtubeInput}
                        onChange={(event) => setYoutubeInput(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && addYoutubeUrl()}
                        placeholder="https://youtube.com/watch?v=..."
                        className="h-11 py-2 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none"
                      />
                      <button
                        onClick={addYoutubeUrl}
                        disabled={!youtubeInput}
                        className="h-11 rounded-2xl bg-primary/20 px-4 text-sm font-medium text-primary transition-all hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('upload.add')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {youtubeUrls.map((url, index) => (
                        <UploadItem
                          key={`${url}-${index}`}
                          icon={<Youtube className="w-5 h-5 text-red-400" />}
                          title={url}
                          onRemove={() => setYoutubeUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'link' && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={linkInput}
                        onChange={(event) => setLinkInput(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && addLinkUrl()}
                        placeholder="https://example.com/article"
                        className="h-11 py-2 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none"
                      />
                      <button
                        onClick={addLinkUrl}
                        disabled={!linkInput}
                        className="h-11 rounded-2xl bg-primary/20 px-4 text-sm font-medium text-primary transition-all hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('upload.add')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {linkUrls.map((url, index) => (
                        <UploadItem
                          key={`${url}-${index}`}
                          icon={<Link className="w-5 h-5 text-blue-400" />}
                          title={url}
                          onRemove={() => setLinkUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {!uploading && activeTab !== 'upload' && (
            <div className="px-4 pb-4 md:px-6 md:pb-6">
              <button
                onClick={handleUpload}
                disabled={totalItems === 0}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLabel}
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={!!uploadedMaterialId && showProcessingModal}
        realProgress={uploadStatus?.progress || 0}
        isComplete={uploadComplete}
        isError={uploadFailed}
        errorMessage={uploadError}
        onClose={() => {
          handleCloseModal();
          setUploadedMaterialId(null);
          onClose();
        }}
        onComplete={() => {
          // Navigate to project when processing is complete
          handleCloseModal();
          setUploadedMaterialId(null);
          onClose();
          // Use onSuccess callback if available, otherwise navigate
          if (projectId) {
            window.location.href = `/dashboard/projects/${projectId}`;
          }
        }}
        materialName=""
      />
    </div>
  );
}

function UploadItem({
  icon,
  title,
  subtitle,
  onRemove,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{title}</p>
        {subtitle && <p className="text-[10px] text-white/40">{subtitle}</p>}
      </div>
      <button
        onClick={onRemove}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/30 transition-colors hover:text-red-400"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
