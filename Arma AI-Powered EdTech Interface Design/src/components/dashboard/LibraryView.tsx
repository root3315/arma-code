import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, Folder, Loader2, FolderOpen } from 'lucide-react';
import { useProjects } from '../../hooks/useApi';
import { useTranslation } from '../../i18n/I18nContext';
import { projectsApi } from '../../services/api';
import { toast } from 'sonner';
import { ProjectCard } from './ProjectCard';

interface LibraryViewProps {
  onProjectClick: (id: string) => void;
  onUpload: () => void;
}

export function LibraryView({ onProjectClick, onUpload }: LibraryViewProps) {
  const { t } = useTranslation();
  const { projects, loading, error, refetch } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (projectId: string) => {
    try {
      await projectsApi.delete(projectId);
      toast.success(t('library.deleted'));
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('library.delete_failed'));
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20"
        >
          {t('library.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0C0C0F] relative">

      {/* HEADER */}
      <div className="flex flex-col gap-6 p-8 pb-4">
         <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-medium text-white tracking-tight mb-2">{t('library.title')}</h1>
              <p className="text-white/40">{t('library.subtitle')}</p>
            </div>
            <button
              onClick={onUpload}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-bold hover:bg-white/90 transition-colors"
            >
              <Plus size={16} />
              <span>{t('library.new_project')}</span>
            </button>
         </div>

         <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
               <input
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder={t('library.search_placeholder')}
                 className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary/30 focus:outline-none transition-colors"
               />
            </div>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#1A1A1E] border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-xs font-medium"
            >
              <span>{t('library.refresh')}</span>
            </button>
         </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
         {loading ? (
           <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
           </div>
         ) : filteredProjects.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/5 rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                 <FolderOpen className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-lg font-medium text-white/60 mb-2">
                {searchQuery ? t('library.no_results') : t('library.no_projects')}
              </h3>
              <p className="text-sm text-white/30 mb-6">
                {searchQuery ? t('library.try_different') : t('library.upload_to_create')}
              </p>
              {!searchQuery && (
                <button
                  onClick={onUpload}
                  className="px-6 py-2.5 bg-primary text-black font-medium rounded-xl hover:bg-primary/90 transition-colors"
                >
                  {t('library.create_first')}
                </button>
              )}
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProjectCard
                    id={project.id}
                    name={project.name}
                    materialCount={project.material_count}
                    createdAt={project.created_at}
                    onClick={onProjectClick}
                    onDelete={() => refetch()}
                    onRefresh={refetch}
                  />
                </motion.div>
              ))}
           </div>
         )}
      </div>
    </div>
  );
}
