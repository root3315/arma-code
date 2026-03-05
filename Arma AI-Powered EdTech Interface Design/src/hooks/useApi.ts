import { useState, useEffect, useMemo } from 'react';
import {
  materialsApi,
  flashcardsApi,
  quizApi,
  tutorApi
} from '../services/api';
import type {
  Material,
  Flashcard,
  QuizQuestion,
  ExamQuizQuestion,
  TutorMessage,
  MaterialSummary,
  MaterialNotes
} from '../types/api';

/**
 * Hook для загрузки списка материалов
 * Автоматически обновляет данные каждые 3 секунды если есть материалы в обработке
 */
export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const data = await materialsApi.list();
      setMaterials(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load materials');
      console.error('Error fetching materials:', err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Создаем стабильный ключ для отслеживания изменений статусов
  const processingKey = useMemo(
    () => materials.map(m => `${m.id}-${m.processing_status}`).join(','),
    [materials]
  );

  // Автоматическое обновление для материалов в обработке
  useEffect(() => {
    // Проверяем есть ли материалы со статусом 'processing'
    const hasProcessingMaterials = materials.some(
      m => m.processing_status === 'processing'
    );

    if (!hasProcessingMaterials) {
      return;
    }

    // Устанавливаем интервал обновления каждые 3 секунды
    const intervalId = setInterval(() => {
      fetchMaterials(false); // false = не показывать лоадер при обновлении
    }, 3000);

    // Очищаем интервал при размонтировании или если нет больше обрабатывающихся материалов
    return () => clearInterval(intervalId);
  }, [processingKey]);

  return { materials, loading, error, refetch: fetchMaterials };
}

/**
 * Hook для загрузки одного материала
 */
export function useMaterial(id: string | null) {
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterial = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await materialsApi.get(id);
      setMaterial(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load material');
      console.error('Error fetching material:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterial();
  }, [id]);

  return { material, loading, error, refetch: fetchMaterial };
}

/**
 * Hook для загрузки summary материала
 */
export function useMaterialSummary(materialId: string | null) {
  const [summary, setSummary] = useState<MaterialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await materialsApi.getSummary(materialId);
      setSummary(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load summary');
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [materialId]);

  return { summary, loading, error, refetch: fetchSummary };
}

/**
 * Hook для загрузки notes материала
 */
export function useMaterialNotes(materialId: string | null) {
  const [notes, setNotes] = useState<MaterialNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await materialsApi.getNotes(materialId);
      setNotes(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load notes');
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [materialId]);

  return { notes, loading, error, refetch: fetchNotes };
}

/**
 * Hook для загрузки flashcards
 */
export function useFlashcards(materialId: string | null) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlashcards = async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await flashcardsApi.list(materialId);
      setFlashcards(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load flashcards');
      console.error('Error fetching flashcards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, [materialId]);

  return { flashcards, loading, error, refetch: fetchFlashcards };
}

/**
 * Hook для загрузки quiz вопросов
 */
export function useQuizQuestions(materialId: string | null) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await quizApi.getQuestions(materialId);
      setQuestions(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load quiz questions');
      console.error('Error fetching quiz questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [materialId]);

  return { questions, loading, error, refetch: fetchQuestions };
}

/**
 * Hook для загрузки quiz вопросов в exam режиме (без correct_option)
 */
export function useExamQuizQuestions(materialId: string | null) {
  const [questions, setQuestions] = useState<ExamQuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await quizApi.getExamQuestions(materialId);
      setQuestions(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load exam questions');
      console.error('Error fetching exam questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [materialId]);

  return { questions, loading, error, refetch: fetchQuestions };
}

/**
 * Hook для работы с tutor чатом
 */
export function useTutorChat(materialId: string | null) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const fetchHistory = async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await tutorApi.getHistory(materialId);
      setMessages(data.messages);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load chat history');
      console.error('Error fetching chat history:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string, context: 'chat' | 'selection' = 'chat') => {
    if (!materialId) return;

    try {
      setSending(true);
      const response = await tutorApi.sendMessage(materialId, { message, context });

      // Refresh history to get both user message and AI response
      await fetchHistory();

      return response;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send message');
      console.error('Error sending message:', err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    if (!materialId) return;

    try {
      await tutorApi.clearHistory(materialId);
      setMessages([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear history');
      console.error('Error clearing history:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [materialId]);

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    clearHistory,
    refetch: fetchHistory
  };
}

/**
 * Hook для создания материала
 */
export function useCreateMaterial() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMaterial = async (data: {
    title: string;
    material_type: 'pdf' | 'youtube';
    file?: File;
    source?: string;
  }) => {
    try {
      setCreating(true);
      setError(null);
      const material = await materialsApi.create(data);
      return material;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create material');
      console.error('Error creating material:', err);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return { createMaterial, creating, error };
}

/**
 * Hook для удаления материала
 */
export function useDeleteMaterial() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMaterial = async (id: string) => {
    try {
      setDeleting(true);
      setError(null);
      await materialsApi.delete(id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete material');
      console.error('Error deleting material:', err);
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return { deleteMaterial, deleting, error };
}
