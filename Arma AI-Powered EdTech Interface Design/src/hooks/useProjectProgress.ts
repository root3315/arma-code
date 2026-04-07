import { useState, useEffect, useCallback } from 'react';
import { projectProgressApi } from '../services/api';
import type { ProjectProgress } from '../types/api';

/**
 * Hook for managing project learning progress.
 * Tracks the user's progression through summary → flashcards → quiz.
 */
export function useProjectProgress(projectId: string | null) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await projectProgressApi.get(projectId);
      setProgress(data);
    } catch (err: any) {
      // If progress doesn't exist yet, that's fine - it will be created on first action
      if (err.response?.status === 404) {
        setProgress(null);
        setError(null);
      } else {
        setError(err.response?.data?.detail || 'Failed to load progress');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const markSummaryRead = async () => {
    if (!projectId) return;

    try {
      const data = await projectProgressApi.markSummaryRead(projectId);
      setProgress(prev => prev ? {
        ...prev,
        summary_read: data.summary_read,
        summary_read_at: data.summary_read_at,
        flashcards_unlocked: data.flashcards_unlocked,
        flashcards_unlocked_at: new Date().toISOString(),
      } : null);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to mark summary as read');
      throw err;
    }
  };

  const markFlashcardsComplete = async () => {
    if (!projectId) return;

    try {
      const data = await projectProgressApi.markFlashcardsComplete(projectId);
      setProgress(prev => prev ? {
        ...prev,
        flashcards_completed: data.flashcards_completed,
        flashcards_completed_at: data.flashcards_completed_at,
        quiz_unlocked: data.quiz_unlocked,
        quiz_unlocked_at: new Date().toISOString(),
      } : null);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to mark flashcards as complete');
      throw err;
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    loading,
    error,
    refetch: fetchProgress,
    markSummaryRead,
    markFlashcardsComplete,
  };
}
