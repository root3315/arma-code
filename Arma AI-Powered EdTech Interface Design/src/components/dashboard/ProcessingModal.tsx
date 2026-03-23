import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { useFakeProgress } from '../../hooks/useProgress';
import { PROCESSING_STAGES } from '../../utils/progressUtils';

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
  // Only show fake progress if material is still processing
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
    onStageChange: (stageIndex) => {
      // Silent stage changes
    },
  });

  // Auto-close on complete immediately
  useEffect(() => {
    if (isComplete && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  // Get stage icon
  const getStageIcon = () => {
    if (isComplete) {
      return (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', duration: 0.6, ease: 'easeOut' }}
        >
          <CheckCircle className="w-20 h-20 text-emerald-500" />
        </motion.div>
      );
    }

    if (isError) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          <AlertCircle className="w-20 h-20 text-red-500" />
        </motion.div>
      );
    }

    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="w-20 h-20 text-[#FF8A3D]" />
      </motion.div>
    );
  };

  // Get progress bar gradient
  const getProgressGradient = () => {
    if (isComplete) {
      return 'from-emerald-500 to-emerald-600';
    }
    if (isError) {
      return 'from-red-500 to-red-600';
    }
    return 'from-[#FF8A3D] to-[#F59E0B]';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#0C0C0F]/90 backdrop-blur-xl z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none"
          >
            <div className="bg-[#121215] border border-white/[0.08] rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full mx-4 pointer-events-auto">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                {getStageIcon()}
              </div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-center mb-6"
              >
                <h2 className="text-2xl font-bold text-[#F3F3F3] mb-2">
                  {isComplete
                    ? 'Ready!'
                    : isError
                    ? 'Processing Failed'
                    : 'Building your learning space...'}
                </h2>
                {materialName && !isComplete && !isError && (
                  <p className="text-sm text-[#9CA3AF] mt-1">
                    {materialName}
                  </p>
                )}
              </motion.div>

              {/* Progress Bar */}
              {!isError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="mb-6"
                >
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${displayProgress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={`h-full bg-gradient-to-r ${getProgressGradient()} rounded-full`}
                    />
                  </div>

                  {/* Progress Text */}
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-sm font-medium text-[#F3F3F3]">
                      {Math.round(displayProgress)}%
                    </span>
                    {!isComplete && eta > 0 && (
                      <span className="text-xs text-[#9CA3AF]">
                        ~{eta}s remaining
                      </span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Stage Text */}
              {!isComplete && !isError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="text-center"
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={narrationText}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm text-[#9CA3AF]"
                    >
                      {narrationText}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Error Message */}
              {isError && errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <p className="text-sm text-red-400 mb-4">{errorMessage}</p>
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-[#FF8A3D] text-white rounded-lg hover:bg-[#FF8A3D]/90 transition-colors text-sm font-medium"
                    >
                      Try Again
                    </button>
                  )}
                </motion.div>
              )}

              {/* Success Message */}
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <p className="text-sm text-emerald-400">
                    Your materials are ready to explore
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
