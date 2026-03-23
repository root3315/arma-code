import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Youtube, Clock, Sparkles, Plus, ArrowUpRight, Loader2, RefreshCw, RotateCcw, AlertCircle, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AICore } from '../shared/AICore';
import { useMaterials, useProjects } from '../../hooks/useApi';
import { toast } from 'sonner';
import { SearchResultsModal } from '../shared/SearchResultsModal';
import { searchApi, materialsApi } from '../../services/api';
import type { SearchPhase, SearchResponse, SearchResult } from '../../types/api';
import { ProjectCard } from './ProjectCard';
import { DashboardHero } from './DashboardHero';

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
  onProjectClick?: (id: string) => void;
}

export function DashboardHome({ onMaterialClick, onUpload, onProjectClick }: DashboardHomeProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | undefined>(undefined);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefiningSearch, setIsRefiningSearch] = useState(false);
  const [searchPhase, setSearchPhase] = useState<SearchPhase>('fast');
  const [suggestions, setSuggestions] = useState<string[]>(() => getRandomSuggestions(3));
  const [suggestionKey, setSuggestionKey] = useState(0); // For animation reset
  const { materials, loading, refetch } = useMaterials();
  const { projects, loading: projectsLoading, refetch: refetchProjects } = useProjects();

  const handleProjectDelete = () => {
    refetchProjects();
  };

  // Rotate suggestions every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestions(getRandomSuggestions(3));
      setSuggestionKey(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh suggestions
  const refreshSuggestions = useCallback(() => {
    setSuggestions(getRandomSuggestions(3));
    setSuggestionKey(prev => prev + 1);
  }, []);

  // Get recent materials (last 6)
  const recentMaterials = materials.slice(0, 6);

  const mergeSearchResults = useCallback((current: SearchResult[], incoming: SearchResult[]) => {
    const merged = new Map<string, SearchResult>();

    for (const result of current) {
      merged.set(result.url, result);
    }

    for (const result of incoming) {
      merged.set(result.url, result);
    }

    return Array.from(merged.values());
  }, []);

  const sortSearchResults = useCallback((results: SearchResult[]) => {
    const sourceScore = (result: SearchResult) => {
      const source = (result.source || '').toLowerCase();

      if (result.type === 'youtube') return 200;
      if (source.includes('arxiv.org')) return 180;
      if (source.includes('docs.python.org')) return 170;
      if (source.includes('python.org')) return 165;
      if (source.includes('w3schools.com')) return 160;
      if (source.includes('youtube.com')) return 150;
      if (source.includes('researchgate.net')) return 20;
      return 100;
    };

    return [...results].sort((a, b) => sourceScore(b) - sourceScore(a));
  }, []);

  const handleSearch = async (query?: string) => {
    const searchText = query || inputValue;
    if (!searchText.trim()) return;

    // Update input if searching from suggestion
    if (query) {
      setInputValue(query);
    }

    setSearchQuery(searchText);
    setSearchPhase('fast');
    setIsSearching(true);
    setIsRefiningSearch(false);
    setIsSearchModalOpen(true);
    setSearchResults([]);
    setAiAnswer(undefined);

    try {
      const fastResponse = await searchApi.search({
        query: searchText,
        types: ['pdf', 'youtube', 'article'],
        limit: 10,
        phase: 'fast',
      });

      setSearchResults(sortSearchResults(fastResponse.results || []));
      setAiAnswer(fastResponse.ai_answer);
      setSearchPhase('fast');

      if (fastResponse.is_partial) {
        setIsRefiningSearch(true);

        try {
          const fullResponse = await searchApi.search({
            query: searchText,
            types: ['pdf', 'youtube', 'article'],
            limit: 10,
            phase: 'full',
          });

          setSearchResults((prev) => sortSearchResults(mergeSearchResults(prev, fullResponse.results || [])));
          setAiAnswer(fullResponse.ai_answer ?? fastResponse.ai_answer);
          setSearchPhase('full');
        } catch {
          toast.error('Refined search failed. Showing fast results only.');
        } finally {
          setIsRefiningSearch(false);
        }
      }
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

      await Promise.all([refetch(), refetchProjects()]);
      setInputValue('');
      setIsSearchModalOpen(false);
      if (material.project_id && onProjectClick) {
        onProjectClick(material.project_id);
      }
      return true;
    } catch (error) {
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
    <div className="min-h-full flex flex-col relative pb-32 md:pb-20 overflow-x-hidden">

      {/* PULSING ORB BACKGROUND – radial gradient for clean, controlled glow */}
      <div className="absolute left-1/2 -translate-x-1/2 top-20 pointer-events-none z-0 orb-glow-bg" />

      {/* AI CHAT HERO SECTION */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-8 md:pt-24 pb-8 md:pb-16 px-4 md:px-4">

        

        {/* Primary Upload CTAs - NEW DashboardHero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="w-full max-w-4xl relative z-10"
        >
          <DashboardHero
            onUploadPDF={onUpload}
            onUploadVideo={onUpload}
            onUploadNotes={onUpload}
            onSearch={(query) => {
              setInputValue(query);
              handleSearch(query);
            }}
            isUploading={false}
          />
        </motion.div>

        {/* Chips with rotation - moved below DashboardHero */}
        <div className="relative z-10 flex md:justify-center items-center gap-2 md:gap-3 mt-6 md:mt-8 overflow-x-auto scrollbar-hide pb-2 md:pb-0 px-1 md:px-0">
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
      </div>

      {/* PROJECTS SECTION */}
      <div className="relative z-10 px-4 md:px-8 py-8 md:py-12">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-primary/70" />
            <h2 className="text-lg md:text-xl font-medium text-white/80">Your Projects</h2>
          </div>
          <button
            onClick={onUpload}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Plus size={14} />
            New Project
          </button>
        </div>

        {projectsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl">
            <FolderOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 mb-4">No projects yet</p>
            <button
              onClick={onUpload}
              className="px-6 py-2.5 bg-primary text-black font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <ProjectCard
                  id={project.id}
                  name={project.name}
                  materialCount={project.material_count}
                  createdAt={project.created_at}
                  onClick={onProjectClick}
                  onDelete={handleProjectDelete}
                  onRefresh={refetchProjects}
                />
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
          refining={isRefiningSearch}
          phase={searchPhase}
          aiAnswer={aiAnswer}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectResult={handleSelectResult}
        />
      )}
    </div>
  );
}
