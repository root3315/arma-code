import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    CheckCircle2, ChevronRight, Play, Brain, Check, X, RotateCw, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { Material, QuizQuestion } from '../../../types/api';

export interface QuizTabProps {
    material: Material;
    questions: QuizQuestion[];
    loading: boolean;
    viewMode?: 'all' | 'single';
}

const PREVIEW_COUNT = 3;

export function QuizTab({ material, questions, loading, viewMode = 'single' }: QuizTabProps) {
    const [quizStarted, setQuizStarted] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [showResult, setShowResult] = useState(false);
    const [isAnswerLocked, setIsAnswerLocked] = useState(false);

    const handleSelectAnswer = (answerText: string) => {
        if (isAnswerLocked) return;
        setSelectedAnswer(answerText);
    };

    const handleConfirmAnswer = () => {
        if (!selectedAnswer) return;
        setIsAnswerLocked(true);
        setAnswers(prev => ({ ...prev, [currentQuestion]: selectedAnswer }));
    };

    const handleNextQuestion = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            setSelectedAnswer(answers[currentQuestion + 1] || null);
            setIsAnswerLocked(!!answers[currentQuestion + 1]);
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
            setSelectedAnswer(answers[currentQuestion - 1] || null);
            setIsAnswerLocked(!!answers[currentQuestion - 1]);
        }
    };

    const handleRestartQuiz = () => {
        setQuizStarted(true);
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setAnswers({});
        setShowResult(false);
        setIsAnswerLocked(false);
    };

    const getCorrectAnswerText = (q: QuizQuestion): string => {
        return q.correct_option || '';
    };

    const calculateScore = () => {
        let correct = 0;
        questions.forEach((q, idx) => {
            const userAnswerText = answers[idx];
            const correctAnswerText = getCorrectAnswerText(q);
            if (userAnswerText === correctAnswerText) {
                correct++;
            }
        });
        return correct;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-white/40">Loading quiz...</p>
                </div>
            </div>
        );
    }

    if (!questions || questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-medium text-white mb-2">No Quiz Yet</h2>
                <p className="text-white/40 max-w-md mb-8">
                    Quiz questions have not been generated for {viewMode === 'all' ? 'these materials' : 'this material'} yet.
                </p>
                <button
                    onClick={() => toast.info('Quiz generation coming soon')}
                    className="px-6 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all"
                >
                    Generate Quiz
                </button>
            </div>
        );
    }

    // Quiz Results Screen
    if (showResult) {
        const score = calculateScore();
        const percentage = Math.round((score / questions.length) * 100);
        const isPassing = percentage >= 70;

        return (
            <div className="h-full overflow-y-auto">
                <div className="max-w-2xl mx-auto p-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="relative w-48 h-48 mx-auto mb-8">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="96" cy="96" r="88" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
                                <motion.circle
                                    cx="96"
                                    cy="96"
                                    r="88"
                                    fill="none"
                                    stroke={isPassing ? '#10b981' : '#f97316'}
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                    initial={{ strokeDasharray: '0 553' }}
                                    animate={{ strokeDasharray: `${percentage * 5.53} 553` }}
                                    transition={{ duration: 1.5, ease: 'easeOut' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className={`text-5xl font-bold ${isPassing ? 'text-emerald-400' : 'text-primary'}`}
                                >
                                    {percentage}%
                                </motion.span>
                                <span className="text-white/40 text-sm">Score</span>
                            </div>
                        </div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <h2 className={`text-3xl font-bold mb-2 ${isPassing ? 'text-emerald-400' : 'text-primary'}`}>
                                {isPassing ? '🎉 Excellent!' : '📚 Keep Learning!'}
                            </h2>
                            <p className="text-white/60 mb-6">
                                You got {score} out of {questions.length} questions correct
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="grid grid-cols-3 gap-4 mb-8"
                        >
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="text-2xl font-bold text-emerald-400">{score}</div>
                                <div className="text-xs text-white/40">Correct</div>
                            </div>
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                <div className="text-2xl font-bold text-red-400">{questions.length - score}</div>
                                <div className="text-xs text-white/40">Incorrect</div>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="text-2xl font-bold text-white">{questions.length}</div>
                                <div className="text-xs text-white/40">Total</div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                            className="flex gap-4"
                        >
                            <button
                                onClick={handleRestartQuiz}
                                className="flex-1 px-6 py-4 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCw size={18} />
                                Try Again
                            </button>
                            <button
                                onClick={() => {
                                    setQuizStarted(false);
                                    setShowResult(false);
                                    setCurrentQuestion(0);
                                    setAnswers({});
                                }}
                                className="px-6 py-4 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition-all"
                            >
                                Back to Preview
                            </button>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Active Quiz Session
    if (quizStarted) {
        const question = questions[currentQuestion];
        const options = [
            { letter: 'A', text: question.option_a },
            { letter: 'B', text: question.option_b },
            { letter: 'C', text: question.option_c },
            { letter: 'D', text: question.option_d }
        ];
        const correctAnswerText = getCorrectAnswerText(question);
        const isCorrect = selectedAnswer === correctAnswerText;

        return (
            <div className="h-full flex flex-col bg-[#0A0A0C]">
                {/* Quiz Header */}
                <div className="flex-shrink-0 border-b border-white/5 bg-[#0D0D0F]">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
                                        setQuizStarted(false);
                                        setCurrentQuestion(0);
                                        setAnswers({});
                                    }
                                }}
                                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
                            >
                                <X size={18} />
                                <span className="text-sm">Exit Quiz</span>
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-white/60">
                                    Question <span className="text-white font-bold">{currentQuestion + 1}</span> of {questions.length}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-amber-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Question Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-6 py-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentQuestion}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                                    <span className="text-xs font-bold text-primary">QUESTION {currentQuestion + 1}</span>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-medium text-white leading-relaxed mb-10">
                                    {question.question}
                                </h2>

                                <div className="space-y-4">
                                    {options.map((option, idx) => {
                                        const isSelected = selectedAnswer === option.text;
                                        const isCorrectOption = option.text === correctAnswerText;
                                        const showFeedback = isAnswerLocked && isSelected;

                                        return (
                                            <motion.button
                                                key={`${currentQuestion}-${option.letter}-${idx}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                onClick={() => handleSelectAnswer(option.text)}
                                                disabled={isAnswerLocked}
                                                className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${isAnswerLocked
                                                        ? isCorrectOption
                                                            ? 'bg-emerald-500/10 border-emerald-500/50'
                                                            : isSelected
                                                                ? 'bg-red-500/10 border-red-500/50'
                                                                : 'bg-white/[0.02] border-white/5 opacity-50'
                                                        : isSelected
                                                            ? 'bg-primary/10 border-primary'
                                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${isAnswerLocked
                                                            ? isCorrectOption
                                                                ? 'bg-emerald-500 text-white'
                                                                : isSelected
                                                                    ? 'bg-red-500 text-white'
                                                                    : 'bg-white/5 text-white/30'
                                                            : isSelected
                                                                ? 'bg-primary text-black'
                                                                : 'bg-white/5 text-white/60'
                                                        }`}>
                                                        {isAnswerLocked && (isSelected || isCorrectOption) ? (
                                                            isCorrectOption ? <Check size={20} /> : <X size={20} />
                                                        ) : (
                                                            option.letter
                                                        )}
                                                    </div>
                                                    <span className={`text-base md:text-lg flex-1 ${isAnswerLocked
                                                            ? isCorrectOption
                                                                ? 'text-emerald-400'
                                                                : isSelected
                                                                    ? 'text-red-400'
                                                                    : 'text-white/30'
                                                            : isSelected
                                                                ? 'text-white'
                                                                : 'text-white/70'
                                                        }`}>
                                                        {option.text}
                                                    </span>
                                                </div>
                                                {showFeedback && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${isCorrect
                                                                ? 'bg-emerald-500 text-white'
                                                                : 'bg-red-500 text-white'
                                                            }`}
                                                    >
                                                        {isCorrect ? 'Correct!' : 'Incorrect'}
                                                    </motion.div>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {isAnswerLocked && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`mt-6 p-6 rounded-2xl border ${isCorrect
                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                : 'bg-amber-500/5 border-amber-500/20'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                                                }`}>
                                                {isCorrect ? (
                                                    <CheckCircle2 size={20} className="text-emerald-400" />
                                                ) : (
                                                    <Brain size={20} className="text-amber-400" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`text-sm font-bold mb-3 ${isCorrect ? 'text-emerald-400' : 'text-amber-400'
                                                    }`}>
                                                    {isCorrect ? '🎉 Correct!' : '💡 Explanation'}
                                                </h4>
                                                <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                    <div className="text-xs text-emerald-400/60 uppercase tracking-wider mb-1">Correct Answer</div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white font-bold flex items-center justify-center">
                                                            <Check size={16} />
                                                        </span>
                                                        <span className="text-emerald-400 font-medium">
                                                            {correctAnswerText}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isCorrect && selectedAnswer && (
                                                    <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                                        <div className="text-xs text-red-400/60 uppercase tracking-wider mb-1">Your Answer</div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-8 h-8 rounded-lg bg-red-500 text-white font-bold flex items-center justify-center">
                                                                <X size={16} />
                                                            </span>
                                                            <span className="text-red-400 font-medium">
                                                                {selectedAnswer}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Quiz Footer */}
                <div className="flex-shrink-0 border-t border-white/5 bg-[#0D0D0F]">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevQuestion}
                                    disabled={currentQuestion === 0}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Previous
                                </button>
                            </div>

                            {!isAnswerLocked ? (
                                <button
                                    onClick={handleConfirmAnswer}
                                    disabled={!selectedAnswer}
                                    className="px-8 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    Confirm Answer
                                    <ChevronRight size={18} />
                                </button>
                            ) : (
                                <button
                                    onClick={currentQuestion === questions.length - 1 ? () => setShowResult(true) : handleNextQuestion}
                                    className="px-8 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                                >
                                    {currentQuestion === questions.length - 1 ? 'See Results' : 'Next Question'}
                                    <ChevronRight size={18} />
                                </button>
                            )}

                            <div className="flex items-center gap-1.5">
                                {questions.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setCurrentQuestion(idx);
                                            setSelectedAnswer(answers[idx] || null);
                                            setIsAnswerLocked(!!answers[idx]);
                                        }}
                                        className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentQuestion
                                                ? 'bg-primary scale-125'
                                                : answers[idx]
                                                    ? answers[idx] === getCorrectAnswerText(questions[idx])
                                                        ? 'bg-emerald-500'
                                                        : 'bg-red-500'
                                                    : 'bg-white/20 hover:bg-white/40'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz Preview Screen (Default)
    return (
        <div className="max-w-3xl mx-auto p-8 h-full overflow-y-auto">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-24 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.1)] relative">
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-medium text-white mb-1">Quiz Ready</h2>
                        <p className="text-white/40 text-sm">{material?.title || (viewMode === 'all' ? 'All Materials' : 'Material')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-xl font-bold text-white mb-1">{questions.length}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Questions</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-xl font-bold text-emerald-400 mb-1">Multiple Choice</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Format</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-xl font-bold text-white mb-1">{material?.type?.toUpperCase() || 'N/A'}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Source</div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 mb-8">
                <h3 className="text-sm font-medium text-white/60 mb-4">Question Preview</h3>
                {questions.slice(0, PREVIEW_COUNT).map((q, idx) => {
                    const options = [q.option_a, q.option_b, q.option_c, q.option_d];
                    return (
                        <div key={q.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                            <div>
                                <div className="text-xs text-white/30 mb-1">Question {idx + 1}:</div>
                                <div className="text-white/90">{q.question}</div>
                            </div>
                            <div>
                                <div className="text-xs text-white/30 mb-1">Options:</div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
                                    {options.map((option, optIdx) => (
                                        <div key={optIdx} className="flex items-start gap-1">
                                            <span className="text-white/40">{String.fromCharCode(65 + optIdx)}.</span>
                                            <span className="line-clamp-1">{option}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {questions.length > PREVIEW_COUNT && (
                    <p className="text-xs text-white/30 text-center">+ {questions.length - PREVIEW_COUNT} more questions</p>
                )}
            </div>

            <button
                onClick={() => setQuizStarted(true)}
                className="w-full px-8 py-4 bg-primary text-black rounded-xl font-bold text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,138,61,0.2)] flex items-center justify-center gap-3"
            >
                <Play size={20} fill="currentColor" />
                Start Quiz
            </button>
        </div>
    );
}
