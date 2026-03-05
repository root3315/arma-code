import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

import { useExamQuizQuestions, useMaterials } from '../../hooks/useApi';
import { quizApi } from '../../services/api';
import type { ExamQuizQuestion } from '../../types/api';

type ViewMode = 'home' | 'setup' | 'session' | 'results';

interface ExamConfig {
  duration: number;
  questionCount: number;
}

interface ExamQuestionItem {
  id: string;
  question: string;
  options: string[];
}

interface ExamSessionState {
  materialId: string;
  materialTitle: string;
  durationMinutes: number;
  questions: ExamQuestionItem[];
}

interface ExamResultItem {
  question_id: string;
  question_text: string;
  is_correct: boolean;
  selected_option: string;
  correct_option: string;
  explanation: string;
}

interface ExamResultState {
  materialId: string;
  materialTitle: string;
  durationMinutes: number;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  rows: ExamResultItem[];
  saveFailed: boolean;
}

const PASS_THRESHOLD = 70;
const DEFAULT_CONFIG: ExamConfig = { duration: 30, questionCount: 10 };
const DURATION_OPTIONS = [15, 30, 45, 60];
const QUESTION_COUNT_BASE_OPTIONS = [5, 10, 15, 20];

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function buildExamQuestions(questions: ExamQuizQuestion[], desiredCount: number): ExamQuestionItem[] {
  const clampedCount = Math.max(1, Math.min(desiredCount, questions.length));

  return shuffleArray(questions)
    .slice(0, clampedCount)
    .map((q) => ({
      id: q.id,
      question: q.question,
      options: shuffleArray([q.option_a, q.option_b, q.option_c, q.option_d]),
    }));
}

export function ExamView() {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [config, setConfig] = useState<ExamConfig>(DEFAULT_CONFIG);
  const [sessionState, setSessionState] = useState<ExamSessionState | null>(null);
  const [resultState, setResultState] = useState<ExamResultState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { materials, loading: materialsLoading } = useMaterials();

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId]
  );

  const handleSelectMaterial = (materialId: string) => {
    setSelectedMaterialId(materialId);
    setResultState(null);
    setViewMode('setup');
  };

  const handleStartExam = (materialId: string, materialTitle: string, sourceQuestions: ExamQuizQuestion[]) => {
    if (sourceQuestions.length === 0) {
      toast.error('No exam questions available yet');
      return;
    }

    const examQuestions = buildExamQuestions(sourceQuestions, config.questionCount);

    setSessionState({
      materialId,
      materialTitle,
      durationMinutes: config.duration,
      questions: examQuestions,
    });

    setViewMode('session');
  };

  const handleSubmitExam = async (
    session: ExamSessionState,
    answers: Record<string, string>
  ): Promise<boolean> => {
    if (submitting) {
      return false;
    }

    const payloadAnswers = session.questions.map((q) => ({
      question_id: q.id,
      selected_option: answers[q.id] ?? '',
    }));

    try {
      setSubmitting(true);

      const submitResult = await quizApi.submit({ answers: payloadAnswers });

      const rows: ExamResultItem[] = submitResult.results.map((item) => ({ ...item }));

      let saveFailed = false;
      try {
        await quizApi.saveAttempt({
          material_id: session.materialId,
          score: submitResult.correct_answers,
          total_questions: submitResult.total_questions,
          percentage: Math.round(submitResult.score_percentage),
          answers: rows.map((row) => ({
            question_id: row.question_id,
            selected: row.selected_option,
            correct: row.is_correct,
            correct_option: row.correct_option,
            explanation: row.explanation,
          })),
        });
      } catch (saveErr) {
        saveFailed = true;
        console.error('Failed to save exam attempt:', saveErr);
        toast.warning('Result shown, but attempt was not saved');
      }

      setResultState({
        materialId: session.materialId,
        materialTitle: session.materialTitle,
        durationMinutes: session.durationMinutes,
        totalQuestions: submitResult.total_questions,
        correctAnswers: submitResult.correct_answers,
        scorePercentage: Math.round(submitResult.score_percentage),
        rows,
        saveFailed,
      });
      setViewMode('results');
      return true;
    } catch (err) {
      console.error('Failed to submit exam attempt:', err);
      toast.error('Failed to submit exam attempt. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0C0C0F] relative overflow-hidden">
      {viewMode === 'home' && (
        <ExamHome
          materials={materials}
          loading={materialsLoading}
          onSelectMaterial={handleSelectMaterial}
        />
      )}

      {viewMode === 'setup' && selectedMaterialId && (
        <ExamSetup
          materialId={selectedMaterialId}
          materialTitle={selectedMaterial?.title ?? 'Material'}
          config={config}
          setConfig={setConfig}
          onBack={() => setViewMode('home')}
          onStart={(questions) => handleStartExam(selectedMaterialId, selectedMaterial?.title ?? 'Material', questions)}
        />
      )}

      {viewMode === 'session' && sessionState && (
        <ExamSession
          data={sessionState}
          submitting={submitting}
          onBack={() => setViewMode('setup')}
          onFinish={(answers) => handleSubmitExam(sessionState, answers)}
        />
      )}

      {viewMode === 'results' && resultState && (
        <ExamResults
          data={resultState}
          onHome={() => {
            setSessionState(null);
            setResultState(null);
            setSelectedMaterialId(null);
            setViewMode('home');
          }}
          onRetry={() => {
            setSessionState(null);
            setViewMode('setup');
          }}
        />
      )}
    </div>
  );
}

function ExamHome({
  materials,
  loading,
  onSelectMaterial,
}: {
  materials: ReturnType<typeof useMaterials>['materials'];
  loading: boolean;
  onSelectMaterial: (materialId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const processedMaterials = materials.filter((m) => m.processing_status === 'completed');

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-medium text-white tracking-tight mb-2">Exam Prep</h1>
          <p className="text-white/40">Timed exam mode based on your uploaded materials</p>
        </div>
      </div>

      {processedMaterials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-medium text-white mb-2">No Materials Yet</h2>
          <p className="text-white/40 max-w-md">Upload and process materials to generate exam questions</p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-4">Select Material</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {processedMaterials.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => onSelectMaterial(material.id)}
                className="text-left p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <BookOpen size={20} />
                  </div>
                  <h3 className="font-medium text-white line-clamp-1 flex-1 group-hover:text-primary transition-colors">
                    {material.title}
                  </h3>
                </div>
                <p className="text-xs text-white/40">
                  {material.type.toUpperCase()} • {new Date(material.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ExamSetup({
  materialId,
  materialTitle,
  config,
  setConfig,
  onBack,
  onStart,
}: {
  materialId: string;
  materialTitle: string;
  config: ExamConfig;
  setConfig: React.Dispatch<React.SetStateAction<ExamConfig>>;
  onBack: () => void;
  onStart: (questions: ExamQuizQuestion[]) => void;
}) {
  const { questions, loading, error, refetch } = useExamQuizQuestions(materialId);
  const [generating, setGenerating] = useState(false);

  const availableCount = questions.length;
  const questionCountOptions = useMemo(
    () =>
      Array.from(new Set([...QUESTION_COUNT_BASE_OPTIONS, availableCount]))
        .filter((v) => v > 0)
        .sort((a, b) => a - b),
    [availableCount]
  );

  useEffect(() => {
    if (availableCount === 0) {
      return;
    }

    if (config.questionCount > availableCount) {
      setConfig((prev) => ({ ...prev, questionCount: availableCount }));
    }
  }, [availableCount, config.questionCount, setConfig]);

  const handleGenerate = async () => {
    if (generating) {
      return;
    }

    try {
      setGenerating(true);
      const requestedCount = Math.max(config.questionCount, 10);
      const response = await quizApi.regenerate(materialId, requestedCount);
      toast.success(response.message || 'Quiz regenerated');
      await refetch();
    } catch (err) {
      console.error('Failed to regenerate quiz:', err);
      toast.error('Failed to generate exam questions');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-8 justify-center">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 w-fit"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-3xl font-medium text-white mb-2">Start Exam</h1>
      <p className="text-white/40 mb-8">{materialTitle}</p>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6 mb-10">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Available Questions</div>
          <div className="text-2xl font-semibold text-white">{availableCount}</div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Question Count</label>
          <div className="grid grid-cols-4 gap-3">
            {questionCountOptions.map((count) => {
              const disabled = count > availableCount;
              const selected = config.questionCount === count;

              return (
                <button
                  key={count}
                  type="button"
                  disabled={disabled}
                  onClick={() => setConfig((prev) => ({ ...prev, questionCount: count }))}
                  className={`py-3 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Duration (Minutes)</label>
          <div className="grid grid-cols-4 gap-3">
            {DURATION_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, duration: minutes }))}
                className={`py-3 rounded-xl border transition-colors ${
                  config.duration === minutes
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                }`}
              >
                {minutes}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="md:w-auto px-6 py-3 rounded-xl border border-white/15 text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating...' : availableCount > 0 ? 'Regenerate Questions' : 'Generate Questions'}
        </button>

        <button
          type="button"
          onClick={() => onStart(questions)}
          disabled={availableCount === 0}
          className="flex-1 py-3 bg-primary text-black rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Timed Exam
        </button>
      </div>
    </div>
  );
}

function ExamSession({
  data,
  submitting,
  onBack,
  onFinish,
}: {
  data: ExamSessionState;
  submitting: boolean;
  onBack: () => void;
  onFinish: (answers: Record<string, string>) => Promise<boolean>;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(data.durationMinutes * 60);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState(false);
  const answersRef = useRef<Record<string, string>>({});

  const currentQuestion = data.questions[currentIndex];

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value && value.trim().length > 0).length,
    [answers]
  );

  const finishExam = async () => {
    if (finishing || submitting) {
      return;
    }

    setFinishing(true);
    const success = await onFinish(answersRef.current);
    if (!success) {
      setFinishing(false);
    }
  };

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (finishing || submitting) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          void finishExam();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finishing, submitting]);

  const handleSelectOption = (option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0C0C0F]">
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#121215]/70 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="text-white/40 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="text-white/60 text-sm">
          Question {currentIndex + 1} / {data.questions.length}
        </div>

        <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 font-mono text-primary font-medium flex items-center gap-2">
          <Clock3 size={14} /> {formatTime(timeLeft)}
        </div>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between text-xs text-white/40">
            <span>{answeredCount} answered</span>
            <span>{data.questions.length - answeredCount} unanswered</span>
          </div>

          <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / data.questions.length) * 100}%` }}
            />
          </div>

          <h2 className="text-2xl font-medium text-white mb-8 leading-relaxed">{currentQuestion.question}</h2>

          <div className="space-y-3 mb-8">
            {currentQuestion.options.map((option, index) => {
              const selected = answers[currentQuestion.id] === option;

              return (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                    selected
                      ? 'bg-primary/10 border-primary text-white shadow-[0_0_15px_rgba(255,138,61,0.12)]'
                      : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                      selected ? 'border-primary bg-primary text-black' : 'border-white/20 text-white/30'
                    }`}
                  >
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(data.questions.length - 1, prev + 1))}
                disabled={currentIndex === data.questions.length - 1}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={finishExam}
              disabled={finishing || submitting}
              className="px-6 py-2.5 rounded-lg bg-primary text-black font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {finishing || submitting ? 'Submitting...' : 'Finish Exam'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamResults({
  data,
  onHome,
  onRetry,
}: {
  data: ExamResultState;
  onHome: () => void;
  onRetry: () => void;
}) {
  const incorrectRows = data.rows.filter((row) => !row.is_correct);
  const passed = data.scorePercentage >= PASS_THRESHOLD;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div
            className={`w-24 h-24 rounded-full mx-auto mb-5 flex items-center justify-center border shadow-[0_0_30px] ${
              passed
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/20'
            }`}
          >
            <Trophy size={44} />
          </div>

          <h1 className="text-4xl font-medium text-white mb-2">Exam Completed</h1>
          <p className="text-white/50">{data.materialTitle}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className={`text-3xl font-bold mb-1 ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.scorePercentage}%
            </div>
            <div className="text-xs text-white/40">Score</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{data.correctAnswers}</div>
            <div className="text-xs text-white/40">Correct</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{data.totalQuestions - data.correctAnswers}</div>
            <div className="text-xs text-white/40">Incorrect</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{data.durationMinutes}m</div>
            <div className="text-xs text-white/40">Duration</div>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div className="text-white/80 font-medium">Status</div>
            <div className={`text-sm font-semibold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {passed ? 'PASS' : 'FAIL'}
            </div>
          </div>

          {data.saveFailed && (
            <div className="mt-4 flex items-center gap-2 text-amber-300 text-sm">
              <AlertCircle size={16} /> Attempt was not saved in history.
            </div>
          )}
        </div>

        <div className="mb-10">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-4">Mistakes & Explanations</h2>

          {incorrectRows.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-300">
              Perfect result. No mistakes in this attempt.
            </div>
          ) : (
            <div className="space-y-3">
              {incorrectRows.map((row, index) => (
                <div
                  key={row.question_id}
                  className={`rounded-xl border border-red-500/20 bg-red-500/5 p-4 transition-opacity ${
                    index === 0 ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  <div className="text-sm text-white mb-2">{row.question_text}</div>
                  <div className="text-xs text-white/60 mb-1">
                    Your answer: <span className="text-red-300">{row.selected_option || 'Not answered'}</span>
                  </div>
                  <div className="text-xs text-white/60 mb-2">
                    Correct answer: <span className="text-emerald-300">{row.correct_option}</span>
                  </div>
                  <div className="text-xs text-white/70">{row.explanation}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-3 rounded-xl border border-white/15 text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} /> Retry
          </button>
          <button
            type="button"
            onClick={onHome}
            className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
