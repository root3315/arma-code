import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  materialsApi,
  flashcardsApi,
  quizApi,
  tutorApi,
  projectsApi
} from '../services/api';
import type {
  Material,
  Flashcard,
  QuizQuestion,
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
      const content = await materialsApi.getMaterialContent(materialId);
      setSummary(
        content.summary
          ? {
              id: content.id,
              material_id: content.material_id,
              summary: content.summary,
              created_at: new Date().toISOString(),
            }
          : null
      );
    } catch (err: any) {
      try {
        const data = await materialsApi.getSummary(materialId);
        setSummary(data);
        setError(null);
      } catch (fallbackErr: any) {
        const status = fallbackErr.response?.status;
        if (status === 404) {
          setSummary(null);
          setError(null);
        } else {
          setError(fallbackErr.response?.data?.detail || 'Failed to load summary');
        }
      }
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
      const content = await materialsApi.getMaterialContent(materialId);
      setNotes(
        content.notes
          ? {
              id: content.id,
              material_id: content.material_id,
              notes: content.notes,
              created_at: new Date().toISOString(),
            }
          : null
      );
    } catch (err: any) {
      try {
        const data = await materialsApi.getNotes(materialId);
        setNotes(data);
        setError(null);
      } catch (fallbackErr: any) {
        const status = fallbackErr.response?.status;
        if (status === 404) {
          setNotes(null);
          setError(null);
        } else {
          setError(fallbackErr.response?.data?.detail || 'Failed to load notes');
        }
      }
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
 * @param materialId ID материала (для single material mode)
 * @param projectId ID проекта (для all materials mode)
 */
export function useTutorChat(materialId: string | null, projectId?: string | null) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const isProjectMode = !!projectId && !materialId;

  const fetchHistory = async () => {
    if (!materialId && !projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = isProjectMode
        ? await tutorApi.getProjectHistory(projectId!)
        : await tutorApi.getHistory(materialId!);
      setMessages(data.messages);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string, context: 'chat' | 'selection' = 'chat') => {
    if (!materialId && !projectId) return;

    try {
      setSending(true);
      setIsTyping(true);

      // Optimistically add user message to UI
      const userMessage: TutorMessage = {
        id: `temp-${Date.now()}`,
        material_id: materialId || '',
        role: 'user',
        content: message,
        context,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Send message to API
      const response = isProjectMode
        ? await tutorApi.sendProjectMessage(projectId!, { message, context })
        : await tutorApi.sendMessage(materialId!, { message, context });


      // Refresh history to get AI response
      await fetchHistory();

      setIsTyping(false);

      return response;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send message');
      setIsTyping(false);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id?.startsWith('temp-')));
      throw err;
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    if (!materialId && !projectId) return;

    try {
      if (isProjectMode) {
        await tutorApi.clearProjectHistory(projectId!);
      } else {
        await tutorApi.clearHistory(materialId!);
      }
      setMessages([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear history');
      throw err;
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [materialId, projectId]);

  return {
    messages,
    loading,
    error,
    sending,
    isTyping,
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
    material_type: 'pdf' | 'docx' | 'txt' | 'youtube';
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

      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return { deleteMaterial, deleting, error };
}

/**
 * Hook для batch upload материалов
 */
export function useBatchUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const uploadBatch = async (data: {
    project_id?: string;
    project_name?: string;
    files?: File[];
    youtube_urls?: string[];
    link_urls?: string[];
  }) => {
    try {
      setUploading(true);
      setError(null);
      const result = await materialsApi.uploadBatch(data);
      setBatchId(result.batch_id);
      return result;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload materials');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return { uploadBatch, uploading, error, batchId };
}

/**
 * Hook для project content
 */
export function useProjectContent(projectId: string | null) {
  const [content, setContent] = useState<{
    id: string;
    project_id: string;
    summary: string | null;
    notes: string | null;
    flashcards: Array<{ question: string; answer: string }> | null;
    quiz: Array<any> | null;
    processing_status: string;
    processing_progress: number;
    total_materials: number;
    created_at: string;
    updated_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await materialsApi.getProjectContent(projectId);
      setContent(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load project content');
    } finally {
      setLoading(false);
    }
  };

  const regenerateContent = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      await materialsApi.regenerateProjectContent(projectId);
      await fetchContent();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to regenerate content');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [projectId]);

  // Auto-refresh if processing
  useEffect(() => {
    if (!content || !['queued', 'processing'].includes(content.processing_status)) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchContent();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [content?.processing_status]);

  return {
    content,
    loading,
    error,
    refetch: fetchContent,
    regenerate: regenerateContent,
  };
}

/**
 * Hook для списка проектов
 */
export function useProjects() {
  const [projects, setProjects] = useState<Array<{
    id: string;
    name: string;
    created_at: string;
    material_count: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectsApi.list();
      setProjects(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return { projects, loading, error, refetch: fetchProjects };
}

/**
 * Hook для одного проекта
 */
export function useProject(projectId: string | null) {
  const [project, setProject] = useState<{
    id: string;
    name: string;
    created_at: string;
    materials: Array<{
      id: string;
      title: string;
      type: string;
      processing_status: string;
      processing_progress: number;
      created_at: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await projectsApi.get(projectId);
      setProject(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  return { project, loading, error, refetch: fetchProject };
}

/**
 * Hook для контента одного материала
 */
export function useMaterialContent(materialId: string | null) {
  const [content, setContent] = useState<{
    id: string;
    material_id: string;
    title: string;
    summary: string | null;
    notes: string | null;
    flashcards: Array<{ question: string; answer: string }> | null;
    quiz: Array<any> | null;
    processing_status: string;
    type: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    if (!materialId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await materialsApi.getMaterialContent(materialId);
      setContent(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load material content');
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchContent();
  }, [materialId, fetchContent]);

  return { content, loading, error, refetch: fetchContent };
}
