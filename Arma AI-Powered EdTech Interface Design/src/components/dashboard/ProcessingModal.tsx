import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { useFakeProgress } from '../../hooks/useProgress';
import { PROCESSING_STAGES } from '../../utils/progressUtils';
import { useTranslation } from '../../i18n/I18nContext';

interface ProcessingModalProps {
  isOpen: boolean;
  realProgress: number;
  isComplete: boolean;
  isError?: boolean;
  errorMessage?: string;
  onClose?: () => void;
  onComplete?: () => void;
  materialName?: string;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  realProgress,
  isComplete,
  isError = false,
  errorMessage,
  onClose,
  onComplete,
  materialName,
}) => {
  const { t } = useTranslation();
  const [showComplete, setShowComplete] = useState(false);
  const shouldShowProgress = !isComplete && !isError && realProgress < 100;

  const {
    displayProgress,
    currentStage,
    stageText,
    narrationText,
    eta,
  } = useFakeProgress({
    realProgress: shouldShowProgress ? realProgress : 100,
    isComplete: isComplete || isError,
    onStageChange: () => {},
  });

  // Show complete screen when done
  useEffect(() => {
    if (isComplete && !showComplete) {
      setShowComplete(true);
    }
  }, [isComplete, showComplete]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowComplete(false);
    }
  }, [isOpen]);

  const handleContinue = () => {
    setShowComplete(false);
    // Full page reload to ensure fresh data from backend
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#0C0C0F]/85 backdrop-blur-md z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none"
          >
            <div className="w-full max-w-md mx-4 pointer-events-auto">
              {/* Glass panel with orange border glow */}
              <div className="rounded-3xl border border-[#FF8A3D]/20 bg-gradient-to-b from-[#FF8A3D]/[0.04] to-white/[0.02] backdrop-blur-xl shadow-[0_0_60px_-12px_rgba(255,138,61,0.15)] overflow-hidden relative">
                {/* Top orange line */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#FF8A3D]/60 to-transparent" />

                <div className="p-8 md:p-10">
                  {/* Spinner icon - orange */}
                  <div className="flex justify-center mb-8">
                    {isComplete ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle className="w-14 h-14 text-emerald-400" />
                      </motion.div>
                    ) : isError ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <AlertCircle className="w-14 h-14 text-red-400" />
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-14 h-14 text-[#FF8A3D]" strokeWidth={2} />
                      </motion.div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-[#F3F3F3] mb-1">
                      {isComplete
                        ? t('processing.ready')
                        : isError
                        ? t('processing.failed')
                        : t('processing.building')}
                    </h2>
                    {materialName && !isComplete && !isError && (
                      <p className="text-sm text-[#9CA3AF] truncate max-w-full">{materialName}</p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {!isError && (
                    <div className="mb-6">
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${displayProgress}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            isComplete
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                              : 'bg-gradient-to-r from-[#FF8A3D] to-[#F59E0B]'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-2.5">
                        <span className="text-xs font-medium text-[#FF8A3D]">
                          {Math.round(displayProgress)}%
                        </span>
                        {!isComplete && eta > 0 && (
                          <span className="text-[10px] text-[#9CA3AF]/60">~{eta}s {t('processing.remaining')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stage Narration */}
                  {!isComplete && !isError && (
                    <div className="text-center min-h-[20px]">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={narrationText}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          className="text-xs text-[#9CA3AF]/70"
                        >
                          {narrationText}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Error State */}
                  {isError && errorMessage && (
                    <div className="text-center">
                      <p className="text-sm text-red-400/80 mb-5">{errorMessage}</p>
                      {onClose && (
                        <button
                          onClick={onClose}
                          className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/[0.06] border border-white/[0.08] text-[#F3F3F3] rounded-xl hover:bg-white/[0.08] transition-colors text-sm font-medium"
                        >
                          {t('processing.close')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Complete State */}
                  {isComplete && showComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-center"
                    >
                      <p className="text-xs text-emerald-400/70 mb-5">
                        {t('processing.complete_desc')}
                      </p>
                      <button
                        onClick={handleContinue}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-[#FF8A3D] text-black rounded-xl font-semibold text-sm hover:bg-[#FF8A3D]/90 transition-colors shadow-[0_0_20px_rgba(255,138,61,0.2)]"
                      >
                        {t('processing.continue')}
                        <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

