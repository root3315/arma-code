import { useState, useEffect, useCallback } from 'react';
import {
  PROCESSING_STAGES,
  STAGE_NARRATIONS,
  getNextProgressState,
  getNarrationText,
  calculateETA,
  type ProgressState,
} from '../utils/progressUtils';

interface UseFakeProgressOptions {
  realProgress: number;
  isComplete: boolean;
  onStageChange?: (stageIndex: number) => void;
}

/**
 * Hook for managing fake progress with smooth animations
 * Creates the illusion of continuous movement even when backend is slow
 */
export function useFakeProgress({
  realProgress,
  isComplete,
  onStageChange,
}: UseFakeProgressOptions): ProgressState {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [previousDisplayProgress, setPreviousDisplayProgress] = useState(0);
  const [narrationRotation, setNarrationRotation] = useState(0);
  const [previousStage, setPreviousStage] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track elapsed time for stage transitions
  useEffect(() => {
    if (isComplete) return;
    
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 100); // Update every 100ms
    }, 100);
    
    return () => clearInterval(timer);
  }, [isComplete]);

  // Calculate current stage based on elapsed time (not progress)
  const getStageFromTime = useCallback(() => {
    let accumulatedTime = 0;
    for (let i = 0; i < PROCESSING_STAGES.length; i++) {
      accumulatedTime += PROCESSING_STAGES[i].duration;
      if (elapsedTime < accumulatedTime) {
        return i;
      }
    }
    return PROCESSING_STAGES.length - 1;
  }, [elapsedTime]);

  const currentStageFromTime = getStageFromTime();

  // Update display progress with smoothing
  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      return;
    }

    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        // Cap at 95% until real completion
        if (prev >= 95 && realProgress < 100) return prev;
        
        // Random step for natural feel (0.3-1%)
        const step = Math.random() * 0.7 + 0.3;
        return Math.min(prev + step, 95);
      });
    }, 200); // Update every 200ms

    return () => clearInterval(interval);
  }, [realProgress, isComplete]);

  // Notify on stage change
  useEffect(() => {
    if (currentStageFromTime !== previousStage && onStageChange) {
      onStageChange(currentStageFromTime);
      setPreviousStage(currentStageFromTime);
    }
  }, [currentStageFromTime, previousStage, onStageChange]);

  // Generate current state
  const currentStage = PROCESSING_STAGES[currentStageFromTime];
  const stageText = currentStage.text;
  const narrationText = getNarrationText(currentStage.key, narrationRotation);
  const eta = calculateETA(displayProgress, currentStageFromTime);

  return {
    displayProgress,
    currentStage: currentStageFromTime,
    stageText,
    narrationText,
    eta,
  };
}

/**
 * Hook for managing progressive reveal of content sections
 * Shows content in stages even if all data is ready
 */
export function useProgressiveReveal(sections: string[], baseDelay?: number) {
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reset visibility when sections change
    setVisibleSections({});

    const delays = baseDelay || 800;
    const timers = sections.map((section, index) => {
      return setTimeout(() => {
        setVisibleSections(prev => ({
          ...prev,
          [section]: true,
        }));
      }, delays + index * 1200); // Stagger by 1.2s each
    });

    return () => timers.forEach(clearTimeout);
  }, [sections, baseDelay]);

  return visibleSections;
}

/**
 * Hook for rotating narration text
 */
export function useNarrationRotation(stageKey: string, intervalMs: number = 3000) {
  const [rotationIndex, setRotationIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');

  const narrations = STAGE_NARRATIONS[stageKey] || STAGE_NARRATIONS.processing;

  useEffect(() => {
    setRotationIndex(0); // Reset when stage changes
  }, [stageKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotationIndex(prev => {
        const newIndex = prev + 1;
        const text = narrations[newIndex % narrations.length];
        setCurrentText(text);
        return newIndex;
      });
    }, intervalMs);

    // Initial text
    setCurrentText(narrations[0]);

    return () => clearInterval(interval);
  }, [stageKey, intervalMs]);

  return currentText;
}
