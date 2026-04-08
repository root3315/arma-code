import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Play, CheckCircle2, Loader2, ChevronLeft, ChevronRight, RotateCw, X } from 'lucide-react';
import { useTranslation } from '../../../i18n/I18nContext';
import { toast } from 'sonner';
import type { Material, Flashcard } from '../../../types/api';

type FlashcardItem = Pick<Flashcard, 'question' | 'answer'> & Partial<Flashcard>;

export interface FlashcardsTabProps {
    material: Material;
    flashcards: FlashcardItem[];
    loading: boolean;
    viewMode?: 'all' | 'single';
    onComplete?: () => void;
}

const PREVIEW_COUNT = 3;

export function FlashcardsTab({ material, flashcards, loading, viewMode = 'single', onComplete }: FlashcardsTabProps) {
    const { t } = useTranslation();
    const [reviewStarted, setReviewStarted] = useState(false);
    const [currentCard, setCurrentCard] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [knownCards, setKnownCards] = useState<number[]>([]);
    const [learningCards, setLearningCards] = useState<number[]>([]);
    const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);

    // Notify parent when all cards are reviewed
    useEffect(() => {
        if (reviewStarted && knownCards.length + learningCards.length === flashcards.length && !hasNotifiedComplete) {
            setHasNotifiedComplete(true);
            onComplete?.();
        }
    }, [knownCards.length, learningCards.length, flashcards.length, reviewStarted, hasNotifiedComplete, onComplete]);

    // Debug
    // console.log('=== FlashcardsTab DEBUG ===', {
    //     hasFlashcards: !!flashcards,
    //     flashcardsLength: flashcards?.length,
    //     flashcards: flashcards,
    //     firstCard: flashcards?.[0]
    // });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-white/40">{t('flashcards.loading')}</p>
                </div>
            </div>
        );
    }

    if (!flashcards || flashcards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
                    <Brain size={40} />
                </div>
                <h2 className="text-2xl font-medium text-white mb-2">{t('flashcards.no_flashcards')}</h2>
                <p className="text-white/40 max-w-md mb-8">
                    {t('flashcards.not_generated', { context: viewMode === 'all' ? 'all' : 'single' })}
                </p>
                <button
                    onClick={() => toast.info(t('flashcards.coming_soon'))}
                    className="px-6 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all"
                >
                    {t('flashcards.generate')}
                </button>
            </div>
        );
    }

    // Review Session Complete
    if (reviewStarted && knownCards.length + learningCards.length === flashcards.length) {
        const percentage = Math.round((knownCards.length / flashcards.length) * 100);
        
        return (
            <div className="h-full overflow-y-auto">
                <div className="max-w-2xl mx-auto p-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="w-32 h-32 mx-auto mb-8 relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-primary/20 rounded-full" />
                            <div className="absolute inset-4 bg-gradient-to-br from-emerald-500/30 to-primary/30 rounded-full flex items-center justify-center">
                                <span className="text-4xl font-bold text-white">{percentage}%</span>
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold text-white mb-2">
                            {percentage >= 80 ? t('flashcards.excellent') : percentage >= 50 ? t('flashcards.good_progress') : t('flashcards.keep_learning')}
                        </h2>
                        <p className="text-white/60 mb-8">
                            {t('flashcards.reviewed_all', { count: flashcards.length })}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="text-3xl font-bold text-emerald-400 mb-1">{knownCards.length}</div>
                                <div className="text-sm text-white/60">{t('flashcards.known')}</div>
                            </div>
                            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                <div className="text-3xl font-bold text-amber-400 mb-1">{learningCards.length}</div>
                                <div className="text-sm text-white/60">{t('flashcards.learning')}</div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setReviewStarted(false);
                                    setCurrentCard(0);
                                    setIsFlipped(false);
                                    setKnownCards([]);
                                    setLearningCards([]);
                                }}
                                className="flex-1 px-6 py-4 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCw size={18} />
                                {t('flashcards.review_again')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Active Review Session
    if (reviewStarted) {
        const card = flashcards[currentCard];
        const progressPercent = ((knownCards.length + learningCards.length) / flashcards.length) * 100;

        return (
            <div className="h-full flex flex-col items-center justify-center p-8">
                {/* Progress */}
                <div className="w-full max-w-2xl mb-8">
                    <div className="flex justify-between text-sm text-white/60 mb-3">
                        <span>Card {currentCard + 1} of {flashcards.length}</span>
                        <span>{knownCards.length} {t('flashcards.known')} • {learningCards.length} {t('flashcards.learning')}</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            key={`progress-${knownCards.length + learningCards.length}`}
                            className="h-full bg-gradient-to-r from-primary to-amber-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                </div>

                {/* Flashcard */}
                <div className="w-full max-w-2xl mb-10">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`card-${currentCard}`}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="relative h-96 cursor-pointer"
                            onClick={() => setIsFlipped(!isFlipped)}
                        >
                        <motion.div
                            className="w-full h-full"
                            initial={false}
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ duration: 0.6, type: 'spring' }}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* Front */}
                            <div
                                className="absolute inset-0 p-10 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 flex flex-col items-center justify-center text-center backface-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="text-xs text-primary/60 uppercase tracking-wider mb-6">{t('flashcards.question')}</div>
                                <p className="text-2xl text-white leading-relaxed max-w-lg">{card.question}</p>
                                <div className="absolute bottom-8 text-sm text-white/40 flex items-center gap-2">
                                    <span>{t('flashcards.click_to_flip')}</span>
                                    <ChevronRight size={16} className="rotate-90" />
                                </div>
                            </div>

                            {/* Back */}
                            <div
                                className="absolute inset-0 p-10 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex flex-col items-center justify-center text-center"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)'
                                }}
                            >
                                <div className="text-xs text-primary/60 uppercase tracking-wider mb-6">{t('flashcards.answer')}</div>
                                <p className="text-2xl text-white leading-relaxed max-w-lg">{card.answer}</p>
                            </div>
                        </motion.div>
                    </motion.div>
                    </AnimatePresence>
                </div>

                {/* Controls */}
                <div className="flex gap-4 w-full max-w-2xl">
                    <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                            setLearningCards([...learningCards, currentCard]);
                            if (currentCard < flashcards.length - 1) {
                                setCurrentCard(currentCard + 1);
                                setIsFlipped(false);
                            }
                        }}
                        className="flex-1 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-center gap-2"
                    >
                        <X size={18} />
                        <span>{t('flashcards.still_learning')}</span>
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                            setKnownCards([...knownCards, currentCard]);
                            if (currentCard < flashcards.length - 1) {
                                setCurrentCard(currentCard + 1);
                                setIsFlipped(false);
                            }
                        }}
                        className="flex-1 px-6 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={18} />
                        <span>{t('flashcards.know_it')}</span>
                    </motion.button>
                </div>
            </div>
        );
    }

    // Preview Screen (Default)
    return (
        <div className="max-w-4xl mx-auto p-12 h-full overflow-y-auto">
            {/* Header Card */}
            <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-8 mb-8">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-24 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(255,138,61,0.1)] relative">
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <Brain size={32} className="text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-medium text-white mb-1">{t('flashcards.deck_title')}</h2>
                        <p className="text-white/40 text-sm">{material?.title || (viewMode === 'all' ? t('project.view_mode.all') : t('flashcards.material'))}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-xl font-bold text-white mb-1">{flashcards.length}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{t('flashcards.cards_label')}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-xl font-bold text-emerald-400 mb-1">{t('flashcards.ready')}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{t('flashcards.status')}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-xl font-bold text-white mb-1">{material?.type?.toUpperCase() || t('flashcards.na')}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{t('flashcards.source')}</div>
                    </div>
                </div>
            </div>

            {/* Preview Cards */}
            <div className="mb-8">
                <h3 className="text-sm font-medium text-white/60 mb-6 px-2">{t('flashcards.card_preview')}</h3>
                <div className="space-y-3">
                    {flashcards.slice(0, PREVIEW_COUNT).map((card, idx) => (
                        <div key={idx} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.03] transition-colors">
                            <div className="mb-3">
                                <div className="text-xs text-primary/60 uppercase tracking-wider mb-2">{t('flashcards.question')}</div>
                                <div className="text-white/90 text-base leading-relaxed">{card.question}</div>
                            </div>
                            <div className="pt-4 mt-4 border-t border-white/5">
                                <div className="text-xs text-emerald-500/60 uppercase tracking-wider mb-2">{t('flashcards.answer')}</div>
                                <div className="text-white/70 text-base leading-relaxed">{card.answer}</div>
                            </div>
                        </div>
                    ))}
                </div>
                {flashcards.length > PREVIEW_COUNT && (
                    <p className="text-xs text-white/30 text-center mt-6">+ {flashcards.length - PREVIEW_COUNT} {t('flashcards.more_cards')}</p>
                )}
            </div>

            {/* Start Button */}
            <button
                onClick={() => setReviewStarted(true)}
                className="w-full px-8 py-4 bg-primary text-black rounded-xl font-bold text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,138,61,0.2)] flex items-center justify-center gap-3"
            >
                <Play size={20} fill="currentColor" />
                {t('flashcards.start_review')}
            </button>
        </div>
    );
}
