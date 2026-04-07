// User types
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_oauth: boolean;
  oauth_provider?: string;
  created_at: string;
  updated_at: string;
  subscription?: Subscription;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

// Material types
export type MaterialType = 'pdf' | 'youtube' | 'article' | 'docx' | 'doc' | 'txt' | 'rtf' | 'odt' | 'epub' | 'md' | 'html';
export type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface Material {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  type: MaterialType;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  source?: string;
  processing_status: ProcessingStatus;
  processing_progress: number;
  processing_error?: string;
  full_text?: string;
  rich_content?: any;
  podcast_script?: Array<{ speaker: string; text: string }>;
  podcast_audio_url?: string;
  presentation_status?: string;
  presentation_url?: string;
  presentation_embed_url?: string;
  presentation_content?: any;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialRequest {
  title: string;
  material_type: MaterialType;
  file?: File;
  source?: string;
}

// Summary & Notes
export interface MaterialSummary {
  id: string;
  material_id: string;
  summary: string;
  key_points?: string[];
  created_at: string;
}

export interface MaterialNotes {
  id: string;
  material_id: string;
  notes: string;
  created_at: string;
}

// Flashcards
export interface Flashcard {
  id: string;
  material_id: string;
  question: string;
  answer: string;
  difficulty?: string;
  created_at: string;
}

export interface CreateFlashcardRequest {
  material_id: string;
  question: string;
  answer: string;
}

// Quiz
export interface QuizQuestion {
  id: string;
  material_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;  // Full text of correct answer
  created_at: string;
  // Helper properties for easier rendering
  options?: string[];
  correct_answer?: number;
  explanation?: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  material_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  answers: Array<{
    question_id: string;
    selected_option: string;
    is_correct: boolean;
  }>;
  completed_at: string;
}

export interface SubmitQuizRequest {
  answers: Array<{
    question_id: string;
    selected_option: string;
  }>;
}

export interface QuizResult {
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  results: Array<{
    question_id: string;
    is_correct: boolean;
    correct_option: string;
  }>;
}

// Tutor Chat
export interface TutorMessage {
  id: string;
  material_id: string;
  role: 'user' | 'assistant';
  content: string;
  context: 'chat' | 'selection';
  created_at: string;
}

export interface SendTutorMessageRequest {
  message: string;
  context?: 'chat' | 'selection';
}

export interface TutorHistoryResponse {
  messages: TutorMessage[];
  total: number;
}

// Subscription & Billing types
export type PlanTier = 'free' | 'student' | 'pro';

export interface Subscription {
  plan_tier: PlanTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_end?: string;
  cancel_at_period_end: boolean;
}

export interface UsageSummary {
  resource_type: string;
  used: number;
  limit: number; // -1 = unlimited
}

export interface BillingInfo {
  subscription: Subscription;
  usage: UsageSummary[];
}

export interface QuotaExceededError {
  error: 'quota_exceeded' | 'plan_required';
  resource_type?: string;
  used?: number;
  limit?: number;
  required_plan?: string;
  current_plan?: string;
  message: string;
  upgrade_url: string;
}

// API Response types
export interface ApiError {
  detail: string | QuotaExceededError;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  page_size?: number;
}

// Search types
export type SearchResultType = 'pdf' | 'youtube' | 'article';
export type SearchPhase = 'fast' | 'full';

export interface SearchRequest {
  query: string;
  types?: SearchResultType[];
  limit?: number;
  phase?: SearchPhase;
}

export interface SearchResult {
  title: string;
  url: string;
  description?: string;
  type: SearchResultType;
  thumbnail_url?: string;
  source?: string;
  published_date?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  ai_answer?: string;
  is_partial: boolean;
  pending_types: SearchResultType[];
  cached: boolean;
}

// Project Progress
export interface ProjectProgress {
  id: string;
  project_id: string;
  summary_read: boolean;
  summary_read_at: string | null;
  flashcards_unlocked: boolean;
  flashcards_unlocked_at: string | null;
  flashcards_completed: boolean;
  flashcards_completed_at: string | null;
  quiz_unlocked: boolean;
  quiz_unlocked_at: string | null;
  quiz_completed: boolean;
  quiz_completed_at: string | null;
  quiz_best_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface MarkSummaryReadResponse {
  summary_read: boolean;
  summary_read_at: string;
  flashcards_unlocked: boolean;
}

export interface MarkFlashcardsCompleteResponse {
  flashcards_completed: boolean;
  flashcards_completed_at: string;
  quiz_unlocked: boolean;
}
