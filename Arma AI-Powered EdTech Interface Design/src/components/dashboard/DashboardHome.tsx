import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Youtube, Clock, Sparkles, Plus, ArrowUpRight, Loader2, RefreshCw, RotateCcw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AICore } from '../shared/AICore';
import { useMaterials } from '../../hooks/useApi';
import { toast } from 'sonner';
import { SearchResultsModal } from '../shared/SearchResultsModal';
import { searchApi, materialsApi } from '../../services/api';
import type { SearchResult } from '../../types/api';

// Pool of learning suggestions organized by category
const SUGGESTION_POOL = {
  programming: [
    'Python для начинающих',
    'JavaScript основы',
    'React tutorial',
    'SQL базы данных',
    'Git и GitHub',
    'TypeScript курс',
    'Node.js backend',
    'REST API design',
    'Docker контейнеры',
    'Алгоритмы и структуры данных',
  ],
  ai_ml: [
    'Machine Learning basics',
    'Deep Learning нейросети',
    'ChatGPT prompt engineering',
    'Computer Vision OpenCV',
    'NLP обработка текста',
    'TensorFlow tutorial',
    'PyTorch для начинающих',
    'Data Science Python',
  ],
  science: [
    'Квантовая физика',
    'Органическая химия',
    'Молекулярная биология',
    'Астрономия космос',
    'Математический анализ',
    'Линейная алгебра',
    'Теория вероятностей',
    'Статистика для Data Science',
  ],
  humanities: [
    'История искусства',
    'Философия Античности',
    'Психология личности',
    'Экономика для начинающих',
    'Маркетинг основы',
    'Финансовая грамотность',
    'Ораторское мастерство',
    'Критическое мышление',
  ],
  languages: [
    'English grammar',
    'Английский для IT',
    'Немецкий язык A1',
    'Испанский с нуля',
    'Китайский иероглифы',
    'Business English',
  ],
  creative: [
    'UI/UX дизайн',
    'Figma для начинающих',
    'Фотография композиция',
    'Видеомонтаж основы',
    '3D моделирование Blender',
    'Копирайтинг тексты',
  ],
};

// Flatten all suggestions for random selection
const ALL_SUGGESTIONS = Object.values(SUGGESTION_POOL).flat();

// Function to get random unique suggestions
const getRandomSuggestions = (count: number = 3): string[] => {
  const shuffled = [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

interface DashboardHomeProps {
  onMaterialClick: (id: string) => void;
  onUpload: () => void;
  prefillQuery?: string;
  onPrefillConsumed?: () => void;
}

export function DashboardHome({ onMaterialClick, onUpload, prefillQuery = '', onPrefillConsumed }: DashboardHomeProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | undefined>(undefined);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(() => getRandomSuggestions(3));
  const [suggestionKey, setSuggestionKey] = useState(0); // For animation reset
  const { materials, loading, refetch } = useMaterials();

  // Rotate suggestions every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestions(getRandomSuggestions(3));
      setSuggestionKey(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const preparedQuery = prefillQuery.trim();
    if (!preparedQuery) {
      return;
    }

    setInputValue(preparedQuery);
    void handleSearch(preparedQuery);
    onPrefillConsumed?.();
  }, [prefillQuery]);

  // Manual refresh suggestions
  const refreshSuggestions = useCallback(() => {
    setSuggestions(getRandomSuggestions(3));
    setSuggestionKey(prev => prev + 1);
  }, []);

  // Get recent materials (last 6)
  const recentMaterials = materials.slice(0, 6);

  const handleSearch = async (query?: string) => {
    const searchText = query || inputValue;
    if (!searchText.trim()) return;

    // Update input if searching from suggestion
    if (query) {
      setInputValue(query);
    }

    setSearchQuery(searchText);
    setIsSearching(true);
    setIsSearchModalOpen(true);
    setSearchResults([]);
    setAiAnswer(undefined);

    try {
      const response = await searchApi.search({
        query: searchText,
        types: ['pdf', 'youtube', 'article'],
        limit: 10
      });
      setSearchResults(response.results || []);
      setAiAnswer((response as any).ai_answer);  // AI answer when no materials found
    } catch (error) {
      toast.error('Failed to search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle suggestion chip click - insert and search
  const handleSuggestionClick = (text: string) => {
    handleSearch(text);
  };

  const handleSelectResult = async (result: SearchResult) => {
    try {
      // Determine material type based on result type
      const materialType = result.type === 'youtube' ? 'youtube' : result.type === 'article' ? 'article' : 'pdf';

      // Create material from search result
      const material = await materialsApi.create({
        title: result.title,
        material_type: materialType,
        source: result.url
      });

      // Refresh materials list immediately
      await refetch();

      // Close modal
      setInputValue('');

      // Show success message
      toast.success(`Added "${material.title}" successfully!`);
      return true;
    } catch (error) {
      toast.error('Failed to add material');
      throw error;
    }
  };

  // State for tracking retry in progress
  const [retryingMaterialId, setRetryingMaterialId] = useState<string | null>(null);

  const handleRetryMaterial = async (e: React.MouseEvent, materialId: string) => {
    e.stopPropagation(); // Prevent card click

    setRetryingMaterialId(materialId);
    try {
      await materialsApi.retry(materialId);
      toast.success('Processing restarted');
      // Refresh materials to get updated status
      await refetch();
    } catch (error) {
      toast.error('Failed to restart processing');
    } finally {
      setRetryingMaterialId(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col relative pb-32 md:pb-20">

      {/* PULSING ORB BACKGROUND */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none z-0">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-[100px] animate-pulse mix-blend-screen" />
        <div className="absolute inset-[20%] bg-primary/5 rounded-full blur-[60px] animate-pulse delay-75 mix-blend-screen" />
        <div className="absolute inset-[40%] bg-white/5 rounded-full blur-[40px] animate-pulse delay-150 mix-blend-overlay" />
      </div>

      {/* AI CHAT HERO SECTION */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-8 md:pt-24 pb-8 md:pb-16 px-4 md:px-4">

        {/* Floating AI Core */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 md:mb-10 relative"
        >
          {/* Sphere Core Visual */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-white/10 to-white/0 border border-white/10 backdrop-blur-sm relative flex items-center justify-center shadow-[0_0_60px_rgba(255,138,61,0.2)]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-primary/20 to-transparent opacity-50" />
            <AICore size="md" className="drop-shadow-[0_0_30px_rgba(255,138,61,0.5)] w-16 h-16 md:w-20 md:h-20 text-primary" />
          </div>
        </motion.div>

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-center mb-8 md:mb-10 space-y-2 md:space-y-3 px-4 md:px-0 w-full md:w-auto"
        >
          <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-white drop-shadow-xl">
            Good to see you.
          </h1>
          <p className="text-lg md:text-2xl text-white/50 font-light tracking-wide">
            How can I help you learn today?
          </p>
        </motion.div>

        {/* Primary Input (Desktop: Center / Mobile: Sticky Bottom) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="w-full max-w-2xl relative group fixed bottom-[80px] md:bottom-auto md:relative z-40 md:z-10 px-4 md:px-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl hidden md:block pointer-events-none" />

          <div className="relative bg-[#0A0A0C]/90 md:bg-[#0A0A0C]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl transition-all duration-300 md:group-hover:border-primary/30 md:group-hover:shadow-[0_0_40px_rgba(0,0,0,0.4)] flex items-center gap-4 pr-3">
            <div className="pl-4 hidden md:block">
              <Sparkles className="w-5 h-5 text-primary/70 animate-pulse" />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="What do you want to learn?"
              className="flex-1 h-12 bg-transparent border-none outline-none text-base md:text-lg text-white placeholder:text-white/20 font-light pl-2 md:pl-0"
            />
            <div className="flex items-center gap-1">
              <button onClick={onUpload} className="p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-colors" title="Attach file">
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={() => handleSearch()} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors">
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chips with rotation */}
          <div className="relative z-10 flex md:justify-center items-center gap-2 md:gap-3 mt-4 md:mt-6 scrollbar-hide pb-2 md:pb-0 px-1 md:px-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={suggestionKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-2 md:gap-3"
              >
                {suggestions.map((text, i) => (
                  <motion.button
                    key={`${suggestionKey}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                    onClick={() => handleSuggestionClick(text)}
                    className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.02] hover:bg-primary/10 text-sm text-white/60 hover:text-primary whitespace-nowrap transition-all duration-200 hover:border-primary/30 hover:shadow-md shrink-0 group"
                  >
                    <span className="flex items-center gap-2">
                      {text}
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Refresh button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={refreshSuggestions}
              className="p-2 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-all duration-200 hover:rotate-180 shrink-0"
              title="Show different suggestions"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* RECENT MATERIALS SECTION */}
      <div className="relative z-10 px-4 md:px-8 py-8 md:py-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-xl font-medium text-white/80">Recent materials</h2>
          <button className="text-sm text-primary hover:underline">View all</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : recentMaterials.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl">
            <p className="text-white/40 mb-4">No materials yet</p>
            <button
              onClick={onUpload}
              className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
            >
              Upload your first material
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentMaterials.map((material, i) => (
              <motion.div
                key={material.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => onMaterialClick(material.id)}
                className="group relative p-5 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer overflow-hidden"
              >
                {/* Progress bar for processing materials */}
                {material.processing_status === 'processing' && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${material.processing_progress}%` }}
                    />
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 mb-4 ${material.type === 'pdf' ? 'bg-blue-500/10 text-blue-400' :
                    material.type === 'youtube' ? 'bg-red-500/10 text-red-400' :
                      'bg-purple-500/10 text-purple-400'
                  }`}>
                  {material.type === 'pdf' ? <FileText size={20} /> : <Youtube size={20} />}
                </div>

                <h3 className="text-base font-medium text-white/90 mb-2 line-clamp-2 group-hover:text-white transition-colors">
                  {material.title}
                </h3>

                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Clock size={12} />
                  <span>{new Date(material.created_at).toLocaleDateString()}</span>
                </div>

                {/* Processing status */}
                {material.processing_status === 'processing' && material.processing_progress > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Loader2 size={14} className="text-primary animate-spin" />
                    <span className="text-xs text-primary">Processing {material.processing_progress}%</span>
                  </div>
                )}

                {/* Stuck at 0% - show retry */}
                {material.processing_status === 'processing' && material.processing_progress === 0 && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="text-primary animate-spin" />
                      <span className="text-xs text-primary">Processing 0%</span>
                    </div>
                    <button
                      onClick={(e) => handleRetryMaterial(e, material.id)}
                      disabled={retryingMaterialId === material.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors disabled:opacity-50"
                      title="Restart processing"
                    >
                      {retryingMaterialId === material.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      Retry
                    </button>
                  </div>
                )}

                {/* Failed status - show error and retry */}
                {material.processing_status === 'failed' && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle size={14} />
                      <span className="text-xs">Failed</span>
                    </div>
                    <button
                      onClick={(e) => handleRetryMaterial(e, material.id)}
                      disabled={retryingMaterialId === material.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors disabled:opacity-50"
                      title="Retry processing"
                    >
                      {retryingMaterialId === material.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      Retry
                    </button>
                  </div>
                )}

                {material.processing_status === 'completed' && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">
                    Ready
                  </span>
                )}

                {/* Error badge in corner for failed materials */}
                {material.processing_status === 'failed' && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold uppercase">
                    Error
                  </span>
                )}

                <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Search Results Modal */}
      {isSearchModalOpen && (
        <SearchResultsModal
          query={searchQuery}
          results={searchResults}
          loading={isSearching}
          aiAnswer={aiAnswer}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectResult={handleSelectResult}
        />
      )}
    </div>
  );
}
