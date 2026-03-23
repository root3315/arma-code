import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Learning Space',
    description:
      'This is your personalized dashboard where AI transforms your study materials into interactive learning content.',
    targetSelector: '.dashboard-hero',
    position: 'center',
  },
  {
    id: 'upload',
    title: 'Upload Your Materials',
    description:
      'Click any of these buttons to upload PDFs, YouTube videos, or notes. Our AI will process them automatically.',
    targetSelector: '.upload-cards',
    position: 'bottom',
  },
  {
    id: 'materials',
    title: 'Your Materials',
    description:
      'All your uploaded content appears here. Click on any material to view its details and AI-generated content.',
    targetSelector: '.materials-list',
    position: 'right',
  },
  {
    id: 'summary',
    title: 'AI Summary',
    description:
      'Get concise summaries of your documents. Perfect for quick review before exams.',
    targetSelector: '.summary-tab',
    position: 'top',
  },
  {
    id: 'flashcards',
    title: 'Smart Flashcards',
    description:
      'AI-generated flashcards help you memorize key concepts with active recall.',
    targetSelector: '.flashcards-tab',
    position: 'top',
  },
  {
    id: 'quiz',
    title: 'Interactive Quiz',
    description:
      'Test your knowledge with automatically generated quiz questions based on your materials.',
    targetSelector: '.quiz-tab',
    position: 'top',
  },
  {
    id: 'tutor',
    title: 'AI Tutor Chat',
    description:
      'Ask questions about your materials and get instant, context-aware answers from your personal AI tutor.',
    targetSelector: '.tutor-chat',
    position: 'top',
  },
];

interface OnboardingTourProps {
  isOpen?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen: externalIsOpen,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setInternalIsOpen(true);
    }
  }, []);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      localStorage.setItem('hasSeenOnboarding', 'true');
      onComplete?.();
      setInternalIsOpen(false);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    onSkip?.();
    setInternalIsOpen(false);
  }, [onSkip]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        handlePrev();
      }
    },
    [isOpen, handleNext, handlePrev, handleSkip, currentStep]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll target into view when step changes
  useEffect(() => {
    if (!step) return;

    const target = document.querySelector(step.targetSelector);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, step]);

  if (!isOpen || !step) return null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#0C0C0F]/80 backdrop-blur-sm z-[60]"
            onClick={handleSkip}
          />
        )}
      </AnimatePresence>

      {/* Spotlight effect */}
      <div className="fixed inset-0 z-[61] pointer-events-none">
        <div className="absolute inset-0 bg-[#0C0C0F]/60" />
        {step && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="absolute w-64 h-64 rounded-full border-2 border-[#FF8A3D]/50 shadow-[0_0_60px_20px_rgba(255,138,61,0.2)]"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
      </div>

      {/* Tooltip Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed z-[62] left-1/2 -translate-x-1/2 bottom-32 md:bottom-40 max-w-md w-full mx-4"
      >
        <div className="bg-[#121215] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#FF8A3D] uppercase tracking-wider">
                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
              </span>
              <div className="flex gap-1">
                {ONBOARDING_STEPS.map((_, index) => (
                  <div
                    key={_.id}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index <= currentStep
                        ? 'bg-[#FF8A3D]'
                        : 'bg-white/[0.1]'
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="text-[#9CA3AF] hover:text-[#F3F3F3] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#F3F3F3] mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                currentStep === 0
                  ? 'text-[#9CA3AF]/50 cursor-not-allowed'
                  : 'text-[#9CA3AF] hover:text-[#F3F3F3]'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF8A3D] text-white rounded-lg hover:bg-[#FF8A3D]/90 transition-colors font-medium text-sm"
            >
              {isLastStep ? (
                <>
                  Get Started
                  <Check className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

/**
 * Check if user needs onboarding and show tour
 */
export function useOnboarding() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeen) {
      setNeedsOnboarding(true);
    }
  }, []);

  const markAsSeen = useCallback(() => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setNeedsOnboarding(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem('hasSeenOnboarding');
    setNeedsOnboarding(true);
  }, []);

  return {
    needsOnboarding,
    markAsSeen,
    resetOnboarding,
  };
}
