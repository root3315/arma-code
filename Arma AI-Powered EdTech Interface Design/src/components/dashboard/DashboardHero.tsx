import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { FileText, Youtube, BookOpen, Search, Upload } from 'lucide-react';

interface DashboardHeroProps {
  onUploadPDF: () => void;
  onUploadVideo: () => void;
  onUploadNotes: () => void;
  onSearch?: (query: string) => void;
  isUploading?: boolean;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  onUploadPDF,
  onUploadVideo,
  onUploadNotes,
  onSearch,
  isUploading = false,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = useCallback(() => {
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  }, [searchQuery, onSearch]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-4xl mx-auto relative"
    >
      {/* Hero Section */}
      <div className="text-center mb-12 relative z-10">
        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-3xl md:text-5xl font-bold text-[#F3F3F3] mb-4"
        >
          What will you learn today?
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-base md:text-xl text-[#9CA3AF] max-w-2xl mx-auto"
        >
          Upload your study materials and let AI create personalized learning content
        </motion.p>
      </div>

      {/* Drag & Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="mb-8"
      >
        <div
          className="border-2 border-dashed border-white/[0.08] rounded-2xl p-8 md:p-12 text-center hover:border-[#FF8A3D]/30 hover:bg-white/[0.02] transition-all duration-300 cursor-pointer group"
          onClick={onUploadPDF}
        >
          <Upload className="w-10 h-10 text-[#9CA3AF] group-hover:text-[#FF8A3D] transition-colors mx-auto mb-4" />
          <p className="text-[#F3F3F3] font-medium mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-[#9CA3AF]">
            PDF, DOCX, TXT, RTF up to 50MB
          </p>
        </div>
      </motion.div>

      {/* Secondary Search Section */}
      {onSearch && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="text-center"
        >
          <p className="text-sm text-[#9CA3AF] mb-4">
            Use search if you want to find additional materials
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for topics, subjects..."
              className="w-full pl-12 pr-4 py-2 px-6 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[#F3F3F3] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF8A3D]/50 focus:ring-1 focus:ring-[#FF8A3D]/50 transition-all"
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

interface UploadCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  color: 'blue' | 'red' | 'purple';
}

const UploadCard: React.FC<UploadCardProps> = ({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/30',
    red: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/30',
    purple: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/30',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/[0.06] transition-all duration-300 min-w-[160px] ${
        colorClasses[color]
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="text-center">
        <p className="font-semibold text-[#F3F3F3] text-sm">{title}</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p>
      </div>
    </motion.button>
  );
};
