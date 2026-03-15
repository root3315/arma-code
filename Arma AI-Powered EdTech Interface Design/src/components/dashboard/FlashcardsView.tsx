import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Play, MoreHorizontal, Settings, Clock, Shuffle, Volume2, RotateCw, Check, X, Bookmark, Edit3, Plus, Layers, Grid, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, FileText, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { useMaterials, useFlashcards } from '../../hooks/useApi';
import type { Material, Flashcard } from '../../types/api';

export function FlashcardsView({ initialMaterialId }: { initialMaterialId?: string | null }) {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'home' | 'player' | 'deck-detail'>('home');
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

  useEffect(() => {
    // Если есть deckId в URL, используем его для запуска player mode
    if (deckId) {
      setActiveMaterialId(deckId);
      setViewMode('player');
    } else if (initialMaterialId) {
      setActiveMaterialId(initialMaterialId);
      setViewMode('player');
    }
  }, [deckId, initialMaterialId]);

  const handleMaterialClick = (id: string) => {
    setActiveMaterialId(id);
    setViewMode('deck-detail');
  };

  const handleStartStudy = () => {
    setViewMode('player');
  };

  const handleBackFromPlayer = () => {
    // Если пришли через URL (deckId), возвращаемся на страницу материала
    if (deckId) {
      navigate(`/dashboard/materials/${deckId}`);
    } else {
      setViewMode('deck-detail');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0C0C0F] relative overflow-hidden">
      {viewMode === 'home' && <FlashcardsHome onMaterialClick={handleMaterialClick} />}
      {viewMode === 'deck-detail' && activeMaterialId && (
        <DeckDetail materialId={activeMaterialId} onBack={() => setViewMode('home')} onStart={handleStartStudy} />
      )}
      {viewMode === 'player' && activeMaterialId && (
        <FlashcardsPlayer materialId={activeMaterialId} onBack={handleBackFromPlayer} />
      )}
    </div>
  );
}

function FlashcardsHome({ onMaterialClick }: { onMaterialClick: (id: string) => void }) {
  const { materials, loading } = useMaterials();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Filter materials that have been processed (likely to have flashcards)
  const processedMaterials = materials.filter(m => m.processing_status === 'completed');

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full scrollbar-hide">
       <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-medium text-white tracking-tight mb-2">Flashcards</h1>
            <p className="text-white/40">Review flashcards from your materials</p>
          </div>
       </div>

       {processedMaterials.length === 0 ? (
         <div className="flex flex-col items-center justify-center py-20 text-center">
           <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
             <Layers size={40} />
           </div>
           <h2 className="text-2xl font-medium text-white mb-2">No Materials Yet</h2>
           <p className="text-white/40 max-w-md">
             Upload materials to generate flashcards for studying
           </p>
         </div>
       ) : (
         <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Study Materials</h2>
            </div>
            <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-4">
               {processedMaterials.map(material => (
                 <div
                   key={material.id}
                   onClick={() => onMaterialClick(material.id)}
                   className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 cursor-pointer transition-all"
                 >
                    <div className="flex justify-between items-start mb-4">
                       <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 ${
                         material.type === 'pdf' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                       }`}>
                          {material.type === 'pdf' ? <FileText size={18} /> : <Youtube size={18} />}
                       </div>
                       <button className="cursor-pointer text-white/20 hover:text-white transition-colors">
                          <MoreHorizontal size={16} />
                       </button>
                    </div>
                    <h3 className="font-medium text-white mb-1 group-hover:text-primary transition-colors line-clamp-2">
                      {material.title}
                    </h3>
                    <div className="text-xs text-white/40">
                      {new Date(material.created_at).toLocaleDateString()}
                    </div>
                 </div>
               ))}
            </div>
         </section>
       )}
    </div>
  );
}

function DeckDetail({ materialId, onBack, onStart }: { materialId: string, onBack: () => void, onStart: () => void }) {
  const materialsContext = useMaterials();
  const material = materialsContext.materials.find(m => m.id === materialId) || null;
  const { flashcards, loading } = useFlashcards(materialId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-white/40">Material not found</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-white/5 text-white rounded-lg">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-medium text-white">{material.title}</h1>
      </div>

      {flashcards.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-6">
            <Layers size={40} />
          </div>
          <h2 className="text-2xl font-medium text-white mb-2">No Flashcards Yet</h2>
          <p className="text-white/40 max-w-md text-center mb-8">
            Flashcards haven't been generated for this material yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="md:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                 <h2 className="text-lg font-medium text-white mb-4">Statistics</h2>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 text-center">
                       <div className="text-2xl font-bold text-white mb-1">{flashcards.length}</div>
                       <div className="text-xs text-white/40">Total Cards</div>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/10 text-center">
                       <div className="text-2xl font-bold text-primary mb-1">{flashcards.length}</div>
                       <div className="text-xs text-primary/60">Ready to Study</div>
                    </div>
                 </div>
              </div>

              <div>
                 <h2 className="text-lg font-medium text-white mb-4">Cards Preview</h2>
                 <div className="space-y-2">
                    {flashcards.slice(0, 5).map(card => (
                      <div key={card.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                         <div className="text-sm text-white/80 mb-1">{card.question}</div>
                         <div className="text-xs text-white/40">→ {card.answer.substring(0, 50)}...</div>
                      </div>
                    ))}
                    {flashcards.length > 5 && (
                      <p className="text-xs text-white/30 text-center pt-2">+ {flashcards.length - 5} more cards</p>
                    )}
                 </div>
              </div>
           </div>

           <div className="space-y-4">
              <button
                onClick={onStart}
                className="w-full py-4 bg-primary text-black rounded-xl font-bold text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
              >
                Start Study Session
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

function FlashcardsPlayer({ materialId, onBack }: { materialId: string, onBack: () => void }) {
  const { materials } = useMaterials();
  const material = materials.find(m => m.id === materialId) || null;
  const { flashcards, loading } = useFlashcards(materialId);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1 = right, -1 = left

  // Переменные для использования в хуках (определяем до хуков)
  const currentCard = flashcards[currentIndex];
  const progress = Math.min(((currentIndex + 1) / flashcards.length) * 100, 100);

  const handleSwipe = (dir: number) => {
    if (currentIndex >= flashcards.length) return;
    setDirection(dir);

    setTimeout(() => {
      setDirection(0);
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
      toast(dir > 0 ? "Marked as Known" : "Marked for Review", {
        position: 'bottom-center',
        duration: 1000
      });
    }, 280);
  };

  // Keyboard shortcuts - ДОЛЖЕН быть ДО условных returns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentIndex >= flashcards.length) return;
      if (e.key === ' ') setIsFlipped(prev => !prev);
      if (e.key === 'ArrowRight') handleSwipe(1);
      if (e.key === 'ArrowLeft') handleSwipe(-1);
      if (e.key === 'ArrowUp') handleSwipe(1);
      if (e.key === 'ArrowDown') handleSwipe(-1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, flashcards.length]);

  // Теперь можно делать условные returns
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!material || flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-white/40 mb-4">No flashcards available</p>
        <button onClick={onBack} className="px-4 py-2 bg-white/5 text-white rounded-lg">
          Go Back
        </button>
      </div>
    );
  }

  if (currentIndex >= flashcards.length) {
      return (
          <div className="flex flex-col h-full bg-[#0C0C0F] items-center justify-center">
              <div className="text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 text-emerald-400">
                      <Check size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
                  <p className="text-white/40 mb-8">You've reviewed all cards from {material.title}.</p>
                  <button onClick={onBack} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors">
                      Back to Deck
                  </button>
              </div>
          </div>
      );
  }

  // Calculate visible stack (current + next 2)
  const stack = [0, 1, 2].map(offset => {
      const idx = currentIndex + offset;
      if (idx >= flashcards.length) return null;
      return { ...flashcards[idx], idx, offset };
  }).filter(Boolean).reverse() as (Flashcard & { idx: number, offset: number })[];

  return (
    <div className="flex flex-col h-full bg-[#0C0C0F]">
       {/* PLAYER HEADER */}
       <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#121215]/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
               <ArrowLeft size={18} />
             </button>
             <div>
               <h2 className="text-sm font-medium text-white">{material.title}</h2>
               <div className="flex items-center gap-2 mt-0.5">
                   <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                   </div>
                   <p className="text-[10px] text-white/30">{currentIndex + 1}/{flashcards.length}</p>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button className="cursor-pointer p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
               <Settings size={18} />
             </button>
          </div>
       </div>

       {/* PLAYER STAGE */}
       <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">

          {/* Card Stack Effect */}
          <div className="relative w-full max-w-xl aspect-[3/2] perspective-[1000px]">

             <AnimatePresence>
             {stack.map((card) => {
                 const isTop = card.offset === 0;
                 return (
                    <motion.div
                        key={card.id}
                        className="absolute inset-0 cursor-pointer"
                        style={{ zIndex: 30 - card.offset }}
                        initial={{ scale: 1 - card.offset * 0.05, y: card.offset * 12, opacity: 1 - card.offset * 0.3 }}
                        animate={{
                            scale: 1 - card.offset * 0.05,
                            opacity: 1 - card.offset * 0.3,
                            x: isTop ? (direction === 1 ? direction * 50 : direction * 50) : 0,
                            y: isTop ? (direction !== 0 ? 50 : card.offset * 12) : card.offset * 12,
                            rotate: isTop ? direction * 5 : 0
                        }}
                        exit={{
                           x: direction * 500,
                           y: 200,
                           opacity: 0,
                           transition: { duration: 0.28, ease: "easeOut" }
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        onClick={() => isTop && setIsFlipped(!isFlipped)}
                    >
                         {/* Card Content Wrapper to handle Flip with 3D animation */}
                         <div
                           className="w-full h-full relative transition-transform duration-500"
                           style={{
                             transformStyle: 'preserve-3d',
                             transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                           }}
                         >
                             {/* FRONT - Question */}
                             <div
                               className="absolute inset-0 bg-[#1A1A1E] border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 md:p-12 text-center hover:border-white/20 transition-colors"
                               style={{
                                 backfaceVisibility: 'hidden',
                                 WebkitBackfaceVisibility: 'hidden'
                               }}
                             >
                                <div className="absolute top-6 left-6 text-xs text-white/20 font-mono tracking-widest uppercase">Question</div>
                                <h3 className="text-xl md:text-3xl font-medium text-white leading-tight select-none">
                                  {card.question}
                                </h3>
                                {isTop && <div className="absolute bottom-6 text-xs text-white/20 animate-pulse">Tap to Flip</div>}
                             </div>

                             {/* BACK - Answer */}
                             <div
                               className="absolute inset-0 bg-[#151518] border border-primary/20 rounded-2xl shadow-[0_0_50px_rgba(255,138,61,0.1)] flex flex-col items-start text-left p-8 md:p-12 overflow-y-auto"
                               style={{
                                 backfaceVisibility: 'hidden',
                                 WebkitBackfaceVisibility: 'hidden',
                                 transform: 'rotateY(180deg)'
                               }}
                             >
                                <div className="absolute top-6 left-6 text-xs text-primary/50 font-mono tracking-widest uppercase">Answer</div>
                                <div className="absolute top-6 right-6 flex gap-3">
                                   <button onClick={(e) => {e.stopPropagation(); toast.info("Reading aloud...")}} className="text-white/20 hover:text-white transition-colors"><Volume2 size={18} /></button>
                                </div>

                                <div className="mt-6 w-full">
                                  <p className="text-lg text-white/90 leading-relaxed select-none font-medium whitespace-pre-wrap">
                                    {card.answer}
                                  </p>
                                </div>

                                <div className="mt-auto pt-4 border-t border-white/5 w-full">
                                   <div className="flex items-center gap-2 text-[10px] font-mono text-white/30 uppercase tracking-wider">
                                     <Layers size={12} />
                                     <span>Source: {material.title}</span>
                                   </div>
                                </div>
                             </div>
                         </div>
                    </motion.div>
                 )
             })}
             </AnimatePresence>

          </div>

          {/* Controls */}
          <div className="flex items-center gap-8 mt-12 z-40">
             <button
               onClick={() => handleSwipe(-1)}
               disabled={direction !== 0}
               className="flex flex-col items-center gap-2 text-white/30 hover:text-red-400 transition-colors group"
             >
               <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center bg-white/5 group-hover:border-red-500/50 group-hover:bg-red-500/10 transition-all scale-100 active:scale-95">
                 <X size={24} />
               </div>
               <span className="text-xs font-medium uppercase tracking-wide">Don't Know</span>
             </button>

             <button
               onClick={() => setIsFlipped(!isFlipped)}
               disabled={direction !== 0}
               className="flex flex-col items-center gap-2 text-white/40 hover:text-white transition-colors group"
             >
               <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-all scale-100 active:scale-95">
                 <RotateCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
               </div>
               <span className="text-xs">Flip</span>
             </button>

             <button
               onClick={() => handleSwipe(1)}
               disabled={direction !== 0}
               className="flex flex-col items-center gap-2 text-white/30 hover:text-emerald-400 transition-colors group"
             >
               <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center bg-white/5 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition-all scale-100 active:scale-95">
                 <Check size={24} />
               </div>
               <span className="text-xs font-medium uppercase tracking-wide">Know</span>
             </button>
          </div>
       </div>
    </div>
  );
}
