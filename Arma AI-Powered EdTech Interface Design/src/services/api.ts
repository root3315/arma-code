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
  QuizResult,
  SubmitQuizRequest,
  TutorMessage,
  SendTutorMessageRequest,
  TutorHistoryResponse,
  ApiError,
  SearchRequest,
  SearchResponse,
  BillingInfo,
  UsageSummary,
  PlanTier,
  ProjectProgress,
  MarkSummaryReadResponse,
  MarkFlashcardsCompleteResponse,
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

// Response interceptor: Handle 401 and 402 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Don't redirect on auth endpoints (login/register) — let the caller handle it
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

      if (!isAuthEndpoint) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    if (error.response?.status === 402) {
      // Dispatch quota-exceeded event for global UpgradeModal
      const detail = error.response.data?.detail;
      window.dispatchEvent(new CustomEvent('quota-exceeded', { detail }));
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

  updateMe: async (data: { full_name?: string; email?: string }): Promise<User> => {
    const response = await apiClient.put<User>('/auth/me', data);
    return response.data;
  },

  changePassword: async (data: { current_password: string; new_password: string }): Promise<void> => {
    await apiClient.post('/auth/me/change-password', data);
  },
};

// ============================================================================
// MATERIALS API
// ============================================================================
export const materialsApi = {
  list: async (projectId?: string): Promise<Material[]> => {
    const params = projectId ? { project_id: projectId } : {};
    const response = await apiClient.get<Material[]>('/materials', { params });
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

  // Batch upload (new)
  uploadBatch: async (data: {
    project_id?: string;
    project_name?: string;
    files?: File[];
    youtube_urls?: string[];
    link_urls?: string[];
  }): Promise<{
    batch_id: string;
    project_id: string;
    materials: Material[];
    status: string;
    total_files: number;
  }> => {
    const formData = new FormData();
    
    if (data.project_id) {
      formData.append('project_id', data.project_id);
    }
    if (data.project_name) {
      formData.append('project_name', data.project_name);
    }

    if (data.files && data.files.length > 0) {
      data.files.forEach(file => {
        formData.append('files', file);
      });
    }

    if (data.youtube_urls && data.youtube_urls.length > 0) {
      data.youtube_urls.forEach(url => {
        formData.append('youtube_urls', url);
      });
    }

    if (data.link_urls && data.link_urls.length > 0) {
      data.link_urls.forEach(url => {
        formData.append('link_urls', url);
      });
    }

    const response = await apiClient.post('/materials/batch', formData);
    return response.data;
  },

  getBatch: async (batchId: string): Promise<Material[]> => {
    const response = await apiClient.get<Material[]>(`/materials/batch/${batchId}`);
    return response.data;
  },

  // Project content (new)
  getProjectContent: async (projectId: string): Promise<{
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
  }> => {
    const response = await apiClient.get(`/materials/projects/${projectId}/content`);
    return response.data;
  },

  getMaterialContent: async (materialId: string): Promise<{
    id: string;
    material_id: string;
    title: string;
    summary: string | null;
    notes: string | null;
    flashcards: Array<{ question: string; answer: string }> | null;
    quiz: Array<any> | null;
    processing_status: string;
    type: string;
  }> => {
    const response = await apiClient.get(`/materials/${materialId}/content`);
    return response.data;
  },

  regenerateProjectContent: async (projectId: string): Promise<{
    status: string;
    message: string;
    project_id: string;
  }> => {
    const response = await apiClient.post(`/materials/projects/${projectId}/content/regenerate`);
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

  getProcessingStatus: async (id: string): Promise<{
    material_id: string;
    status: string;
    progress: number;
    error?: string | null;
    stage: number;
    stage_key: string;
    stage_text: string;
    has_summary: boolean;
    has_flashcards: boolean;
    has_quiz: boolean;
  }> => {
    const response = await apiClient.get(`/materials/${id}/processing-status`);
    return response.data;
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

  projectTutorSpeak: async (projectId: string, messageId: string): Promise<{ audio_url: string; message_id: string }> => {
    const response = await apiClient.post(`/materials/projects/${projectId}/tutor/${messageId}/speak`);
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

  // Project-wide chat (for "All Materials" mode)
  sendProjectMessage: async (projectId: string, data: SendTutorMessageRequest): Promise<TutorMessage> => {
    const response = await apiClient.post<TutorMessage>(`/materials/projects/${projectId}/tutor`, data);
    return response.data;
  },

  getHistory: async (materialId: string): Promise<TutorHistoryResponse> => {
    const response = await apiClient.get<TutorHistoryResponse>(`/materials/${materialId}/tutor/history`);
    return response.data;
  },

  // Project-wide history
  getProjectHistory: async (projectId: string): Promise<TutorHistoryResponse> => {
    const response = await apiClient.get<TutorHistoryResponse>(`/materials/projects/${projectId}/tutor/history`);
    return response.data;
  },

  clearHistory: async (materialId: string): Promise<void> => {
    await apiClient.delete(`/materials/${materialId}/tutor/history`);
  },

  clearProjectHistory: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/materials/projects/${projectId}/tutor/history`);
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

  submit: async (data: SubmitQuizRequest): Promise<QuizResult> => {
    const response = await apiClient.post<QuizResult>('/quiz/attempt', data);
    return response.data;
  },

  regenerate: async (materialId: string): Promise<QuizQuestion[]> => {
    const response = await apiClient.post<QuizQuestion[]>(`/materials/${materialId}/regenerate/quiz`);
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
// PROJECTS API
// ============================================================================
export const projectsApi = {
  list: async (): Promise<Array<{
    id: string;
    name: string;
    created_at: string;
    material_count: number;
  }>> => {
    const response = await apiClient.get('/projects');
    return response.data;
  },

  get: async (projectId: string): Promise<{
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
  }> => {
    const response = await apiClient.get(`/projects/${projectId}`);
    return response.data;
  },

  create: async (name: string): Promise<{
    id: string;
    name: string;
    created_at: string;
  }> => {
    const response = await apiClient.post('/projects', null, {
      params: { name },
    });
    return response.data;
  },

  delete: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}`);
  },

  getContent: async (projectId: string): Promise<{
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
  }> => {
    const response = await apiClient.get(`/materials/projects/${projectId}/content`);
    return response.data;
  },

};

// ============================================================================
// PROJECT PROGRESS API
// ============================================================================
export const projectProgressApi = {
  get: async (projectId: string): Promise<ProjectProgress> => {
    const response = await apiClient.get<ProjectProgress>(`/projects/${projectId}/progress`);
    return response.data;
  },

  markSummaryRead: async (projectId: string): Promise<MarkSummaryReadResponse> => {
    const response = await apiClient.post<MarkSummaryReadResponse>(`/projects/${projectId}/progress/mark-summary-read`);
    return response.data;
  },

  markFlashcardsComplete: async (projectId: string): Promise<MarkFlashcardsCompleteResponse> => {
    const response = await apiClient.post<MarkFlashcardsCompleteResponse>(`/projects/${projectId}/progress/mark-flashcards-complete`);
    return response.data;
  },
};

// ============================================================================
// BILLING API
// ============================================================================
export const billingApi = {
  getSubscription: async (): Promise<BillingInfo> => {
    const response = await apiClient.get<BillingInfo>('/billing/subscription');
    return response.data;
  },

  createCheckout: async (planTier: PlanTier, successUrl: string, cancelUrl: string): Promise<string> => {
    const response = await apiClient.post<{ checkout_url: string }>('/billing/checkout', {
      plan_tier: planTier,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return response.data.checkout_url;
  },

  createPortal: async (returnUrl: string): Promise<string> => {
    const response = await apiClient.post<{ portal_url: string }>('/billing/portal', {
      return_url: returnUrl,
    });
    return response.data.portal_url;
  },

  getUsage: async (): Promise<{ usage: UsageSummary[] }> => {
    const response = await apiClient.get<{ usage: UsageSummary[] }>('/billing/usage');
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
