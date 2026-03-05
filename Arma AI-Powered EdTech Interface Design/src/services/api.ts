import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Material,
  CreateMaterialRequest,
  MaterialSummary,
  MaterialNotes,
  Flashcard,
  CreateFlashcardRequest,
  QuizQuestion,
  ExamQuizQuestion,
  QuizResult,
  SubmitQuizRequest,
  QuizAttemptSaveRequest,
  TutorMessage,
  SendTutorMessageRequest,
  TutorHistoryResponse,
  ApiError,
  MessageResponse,
  SearchRequest,
  SearchResponse,
} from '../types/api';

// Base configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor: Add JWT token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH API
// ============================================================================
export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

// ============================================================================
// MATERIALS API
// ============================================================================
export const materialsApi = {
  list: async (): Promise<Material[]> => {
    const response = await apiClient.get<Material[]>('/materials');
    return response.data;
  },

  get: async (id: string): Promise<Material> => {
    const response = await apiClient.get<Material>(`/materials/${id}`);
    return response.data;
  },

  create: async (data: CreateMaterialRequest): Promise<Material> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('material_type', data.material_type);

    if (data.file) {
      formData.append('file', data.file);
    }

    if (data.source) {
      formData.append('source', data.source);
    }

    const response = await apiClient.post<Material>('/materials', formData);
    return response.data;
  },

  update: async (id: string, data: Partial<Material>): Promise<Material> => {
    const response = await apiClient.put<Material>(`/materials/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/materials/${id}`);
  },

  process: async (id: string): Promise<void> => {
    await apiClient.post(`/materials/${id}/process`);
  },

  retry: async (id: string): Promise<void> => {
    await apiClient.post(`/materials/${id}/retry`);
  },

  // Summary
  getSummary: async (id: string): Promise<MaterialSummary | null> => {
    try {
      const response = await apiClient.get<MaterialSummary>(`/materials/${id}/summary`);
      return response.data;
    } catch {
      return null;
    }
  },

  regenerateSummary: async (id: string): Promise<MaterialSummary> => {
    const response = await apiClient.post<MaterialSummary>(`/materials/${id}/regenerate/summary`);
    return response.data;
  },

  // Notes
  getNotes: async (id: string): Promise<MaterialNotes | null> => {
    try {
      const response = await apiClient.get<MaterialNotes>(`/materials/${id}/notes`);
      return response.data;
    } catch {
      return null;
    }
  },

  regenerateNotes: async (id: string): Promise<MaterialNotes> => {
    const response = await apiClient.post<MaterialNotes>(`/materials/${id}/regenerate/notes`);
    return response.data;
  },

  // Podcast
  generatePodcastScript: async (id: string): Promise<{ podcast_script: Array<{ speaker: string; text: string }> }> => {
    const response = await apiClient.post(`/materials/${id}/podcast/generate-script`);
    return response.data;
  },

  generatePodcastAudio: async (
    id: string,
    ttsProvider: 'edge' | 'elevenlabs' = 'edge'
  ): Promise<{
    podcast_audio_url: string;
    provider: string;
    message: string;
  }> => {
    const response = await apiClient.post(
      `/materials/${id}/podcast/generate-audio`,
      null,
      {
        params: {
          tts_provider: ttsProvider
        }
      }
    );
    return response.data;
  },

  // Presentation
  generatePresentation: async (id: string): Promise<{
    presentation_url: string;
    presentation_embed_url: string;
    presentation_status: string;
  }> => {
    const response = await apiClient.post(`/materials/${id}/presentation/generate`);
    return response.data;
  },

  // Tutor TTS
  tutorSpeak: async (materialId: string, messageId: string): Promise<{ audio_url: string; message_id: string }> => {
    const response = await apiClient.post(`/materials/${materialId}/tutor/${messageId}/speak`);
    return response.data;
  },
};

// ============================================================================
// TUTOR CHAT API
// ============================================================================
export const tutorApi = {
  sendMessage: async (materialId: string, data: SendTutorMessageRequest): Promise<TutorMessage> => {
    const response = await apiClient.post<TutorMessage>(`/materials/${materialId}/tutor`, data);
    return response.data;
  },

  getHistory: async (materialId: string): Promise<TutorHistoryResponse> => {
    const response = await apiClient.get<TutorHistoryResponse>(`/materials/${materialId}/tutor/history`);
    return response.data;
  },

  clearHistory: async (materialId: string): Promise<void> => {
    await apiClient.delete(`/materials/${materialId}/tutor/history`);
  },

  speakMessage: async (materialId: string, messageId: string): Promise<{ audio_url: string; message_id: string }> => {
    const response = await apiClient.post(`/materials/${materialId}/tutor/${messageId}/speak`);
    return response.data;
  },
};

// ============================================================================
// FLASHCARDS API
// ============================================================================
export const flashcardsApi = {
  list: async (materialId: string): Promise<Flashcard[]> => {
    const response = await apiClient.get<{ flashcards: Flashcard[]; total: number }>(`/materials/${materialId}/flashcards`);
    return response.data.flashcards;
  },

  create: async (data: CreateFlashcardRequest): Promise<Flashcard> => {
    const response = await apiClient.post<Flashcard>('/flashcards', data);
    return response.data;
  },

  get: async (id: string): Promise<Flashcard> => {
    const response = await apiClient.get<Flashcard>(`/flashcards/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<Flashcard>): Promise<Flashcard> => {
    const response = await apiClient.put<Flashcard>(`/flashcards/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/flashcards/${id}`);
  },

  regenerate: async (materialId: string): Promise<Flashcard[]> => {
    const response = await apiClient.post<Flashcard[]>(`/materials/${materialId}/regenerate/flashcards`);
    return response.data;
  },
};

// ============================================================================
// QUIZ API
// ============================================================================
export const quizApi = {
  getQuestions: async (materialId: string): Promise<QuizQuestion[]> => {
    const response = await apiClient.get<{ questions: QuizQuestion[]; total: number }>(`/materials/${materialId}/quiz`);
    return response.data.questions;
  },

  getExamQuestions: async (materialId: string): Promise<ExamQuizQuestion[]> => {
    const response = await apiClient.get<{ questions: ExamQuizQuestion[]; total: number }>(`/materials/${materialId}/quiz/exam`);
    return response.data.questions;
  },

  submit: async (data: SubmitQuizRequest): Promise<QuizResult> => {
    const response = await apiClient.post<QuizResult>('/quiz/attempt', data);
    return response.data;
  },

  saveAttempt: async (data: QuizAttemptSaveRequest): Promise<void> => {
    await apiClient.post('/quiz/attempts/save', data);
  },

  regenerate: async (materialId: string, count: number = 10): Promise<MessageResponse> => {
    const response = await apiClient.post<MessageResponse>(`/materials/${materialId}/regenerate/quiz?count=${count}`);
    return response.data;
  },
};

// ============================================================================
// SEARCH API
// ============================================================================
export const searchApi = {
  search: async (data: SearchRequest): Promise<SearchResponse> => {
    const response = await apiClient.post<SearchResponse>('/search', data);
    return response.data;
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
export const setAuthToken = (token: string) => {
  localStorage.setItem('access_token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

// Export axios instance for custom requests
export { apiClient };
