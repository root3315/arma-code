/**
 * Progress Utilities for Perceived Performance
 * These functions create the illusion of smooth, continuous progress
 * even when backend updates are sporadic.
 */

export interface ProgressState {
  displayProgress: number;
  currentStage: number;
  stageText: string;
  narrationText: string;
  eta: number;
}

export const PROCESSING_STAGES = [
  { key: 'uploading', text: 'Uploading your material...', duration: 3000 },
  { key: 'analyzing', text: 'Analyzing content structure...', duration: 5000 },
  { key: 'processing', text: 'Extracting key concepts...', duration: 6000 },
  { key: 'summary', text: 'Generating summary...', duration: 5000 },
  { key: 'flashcards', text: 'Creating smart flashcards...', duration: 5000 },
  { key: 'quiz', text: 'Building quiz questions...', duration: 5000 },
  { key: 'finalizing', text: 'Finalizing your learning space...', duration: 3000 },
] as const;

export const STAGE_NARRATIONS: Record<string, string[]> = {
  uploading: [
    'Uploading your material...',
    'Preparing for processing...',
  ],
  analyzing: [
    'Analyzing content structure...',
    'Identifying main topics...',
    'Detecting document layout...',
  ],
  processing: [
    'Extracting key concepts...',
    'Finding important definitions...',
    'Mapping knowledge structure...',
    'Processing content...',
  ],
  summary: [
    'Generating summary...',
    'Crafting concise overview...',
    'Distilling essential information...',
    'Creating executive summary...',
  ],
  flashcards: [
    'Creating smart flashcards...',
    'Generating Q&A pairs...',
    'Building study materials...',
    'Preparing flashcards...',
  ],
  quiz: [
    'Building quiz questions...',
    'Designing knowledge checks...',
    'Preparing test questions...',
    'Creating assessment...',
  ],
  finalizing: [
    'Finalizing your learning space...',
    'Putting everything together...',
    'Almost ready...',
  ],
};

/**
 * Calculate fake progress that always moves smoothly
 * even when real progress stalls
 */
export function calculateFakeProgress(
  realProgress: number,
  isComplete: boolean,
  previousProgress: number
): number {
  if (isComplete) {
    return 100;
  }

  // Cap display at 95% until real completion
  if (realProgress >= 100) {
    return 95;
  }

  // Ensure we always move forward (even if slowly)
  const minStep = 0.3;
  const maxStep = 2.5;
  const randomStep = Math.random() * (maxStep - minStep) + minStep;

  // Blend real progress with smooth movement
  const targetProgress = Math.min(realProgress, 95);
  const newProgress = Math.max(previousProgress + randomStep * 0.3, targetProgress * 0.9);

  return Math.min(newProgress, 95);
}

/**
 * Calculate ETA based on current stage and progress
 */
export function calculateETA(progress: number, currentStage: number): number {
  if (progress >= 100) return 0;

  const remainingStages = PROCESSING_STAGES.length - currentStage;
  const avgStageDuration = 2500; // ms
  const remainingTime = remainingStages * avgStageDuration * (1 - progress / 100);

  // Convert to seconds, minimum 1 second
  return Math.max(1, Math.ceil(remainingTime / 1000));
}

/**
 * Get narration text for current stage with rotation
 */
export function getNarrationText(stageKey: string, rotationIndex: number): string {
  const narrations = STAGE_NARRATIONS[stageKey] || STAGE_NARRATIONS.processing;
  const index = rotationIndex % narrations.length;
  return narrations[index];
}

/**
 * Determine current stage based on progress percentage
 */
export function getCurrentStage(progress: number): number {
  if (progress >= 100) return PROCESSING_STAGES.length - 1;

  const progressPerStage = 100 / PROCESSING_STAGES.length;
  const stage = Math.floor(progress / progressPerStage);
  return Math.min(stage, PROCESSING_STAGES.length - 1);
}

/**
 * Hook helper: Generate next progress state
 */
export function getNextProgressState(
  realProgress: number,
  isComplete: boolean,
  previousDisplayProgress: number,
  narrationRotation: number
): ProgressState {
  const displayProgress = calculateFakeProgress(
    realProgress,
    isComplete,
    previousDisplayProgress
  );

  const currentStageIndex = getCurrentStage(displayProgress);
  const currentStage = PROCESSING_STAGES[currentStageIndex];
  const stageText = currentStage.text;
  const narrationText = getNarrationText(currentStage.key, narrationRotation);
  const eta = calculateETA(displayProgress, currentStageIndex);

  return {
    displayProgress,
    currentStage: currentStageIndex,
    stageText,
    narrationText,
    eta,
  };
}
