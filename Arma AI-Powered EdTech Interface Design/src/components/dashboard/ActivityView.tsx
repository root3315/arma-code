import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, MoreHorizontal, FileText, Youtube, MessageSquare, Brain, CheckCircle2, Play, ChevronRight, Upload, Plus, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useMaterials } from '../../hooks/useApi';
import { useTranslation } from '../../i18n/I18nContext';
import { toast } from 'sonner';
import type { Material } from '../../types/api';

interface ActivityViewProps {
  onProjectClick?: (id: string) => void;
  onUpload?: () => void;
}

export function ActivityView({ onProjectClick, onUpload }: ActivityViewProps) {
  const { t } = useTranslation();
  const { materials, loading } = useMaterials();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'pdf' | 'youtube'>('ALL');

  // Filter Logic
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  // Grouping by date
  const getTimeGroup = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return 'today';
    if (diffDays === 2) return 'yesterday';
    return 'older';
  };

  const todayMaterials = filteredMaterials.filter(m => getTimeGroup(m.created_at) === 'today');
  const yesterdayMaterials = filteredMaterials.filter(m => getTimeGroup(m.created_at) === 'yesterday');
  const olderMaterials = filteredMaterials.filter(m => getTimeGroup(m.created_at) === 'older');

  const processingMaterials = materials.filter(m => m.processing_status === 'processing');
  const completedMaterials = materials.filter(m => m.processing_status === 'completed').slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full relative">

      {/* HEADER */}
      <div className="flex-shrink-0 px-8 py-6 border-b border-white/5 bg-[#121215]/50 backdrop-blur-md z-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl font-medium text-white tracking-tight mb-1">{t('activity.title')}</h1>
              <p className="text-sm text-white/40">{t('activity.subtitle')}</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
               <div className="relative group flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('activity.search_placeholder')} 
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-primary/30 focus:outline-none transition-colors"
                  />
               </div>
               
               <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-1">
                  <FilterChip label={t('activity.filter_pdf')} active={filterType === 'pdf'} onClick={() => setFilterType(filterType === 'pdf' ? 'ALL' : 'pdf')} />
                  <FilterChip label={t('activity.filter_youtube')} active={filterType === 'youtube'} onClick={() => setFilterType(filterType === 'youtube' ? 'ALL' : 'youtube')} />
               </div>
            </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row">

        {/* LEFT COLUMN - TIMELINE LIST */}
        <div className="flex-1 p-8 space-y-8">

           {/* Today Group */}
           {todayMaterials.length > 0 && (
             <div className="space-y-3">
               <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-2">{t('activity.today')}</div>
               {todayMaterials.map(material => (
                 <MaterialRowCard key={material.id} material={material} onClick={() => onProjectClick?.(material.id)} />
               ))}
             </div>
           )}

           {/* Yesterday Group */}
           {yesterdayMaterials.length > 0 && (
             <div className="space-y-3">
               <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-2">{t('activity.yesterday')}</div>
               {yesterdayMaterials.map(material => (
                 <MaterialRowCard key={material.id} material={material} onClick={() => onProjectClick?.(material.id)} />
               ))}
             </div>
           )}

           {/* Older Group */}
           {olderMaterials.length > 0 && (
             <div className="space-y-3">
               <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-2">{t('activity.older')}</div>
               {olderMaterials.map(material => (
                 <MaterialRowCard key={material.id} material={material} onClick={() => onProjectClick?.(material.id)} />
               ))}
             </div>
           )}

           {filteredMaterials.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-white/20" />
                 </div>
                 <h3 className="text-lg font-medium text-white/60 mb-2">{t('activity.no_results')}</h3>
                 <p className="text-sm text-white/30 mb-4">{t('activity.upload_to_start')}</p>
                 <div className="flex gap-3">
                   <button onClick={() => {setFilterType('ALL'); setSearchQuery('');}} className="text-sm text-primary hover:underline">{t('activity.clear_filters')}</button>
                   <button onClick={onUpload} className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 text-sm font-medium">{t('activity.upload_material')}</button>
                 </div>
              </div>
           )}
        </div>

        {/* RIGHT COLUMN - UTILITY RAIL */}
        <div className="w-full md:w-[340px] border-l border-white/5 bg-[#0C0C0F]/30 p-6 space-y-8 hidden xl:block">

           {/* Block 1: Processing Queue */}
           <div>
             <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t('activity.processing_queue')}</h3>
             {processingMaterials.length > 0 ? (
               <div className="space-y-3">
                 {processingMaterials.map(item => (
                   <div key={item.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-white/80 truncate max-w-[180px]" title={item.title}>{item.title}</span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/10">{t('activity.working')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-primary/80 rounded-full" style={{ width: `${item.processing_progress}%` }} />
                        </div>
                        <span className="text-[10px] text-white/40">{item.processing_progress}%</span>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-xs text-white/20 italic p-2 border border-dashed border-white/5 rounded-lg text-center">{t('activity.nothing_processing')}</div>
             )}
           </div>

           {/* Block 2: Continue */}
           <div>
             <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t('activity.continue_learning')}</h3>
             {completedMaterials.length > 0 ? (
               <div className="space-y-2">
                  {completedMaterials.map(item => (
                    <button onClick={() => onProjectClick?.(item.id)} key={item.id} className="w-full group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 hover:shadow-lg transition-all text-left">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 shrink-0 ${item.type === 'pdf' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                          {item.type === 'pdf' ? <FileText size={14} /> : <Youtube size={14} />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white/80 truncate group-hover:text-white transition-colors">{item.title}</div>
                          <div className="text-[10px] text-white/30 truncate flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
                            <span>{t('activity.ready')}</span>
                          </div>
                       </div>
                       <ChevronRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
                    </button>
                  ))}
               </div>
             ) : (
               <div className="text-xs text-white/20 italic p-2 border border-dashed border-white/5 rounded-lg text-center">{t('activity.no_completed')}</div>
             )}
           </div>

           {/* Block 3: Quick Actions */}
           <div>
             <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t('activity.quick_actions')}</h3>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={onUpload} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-primary/20 hover:text-primary transition-all group">
                   <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                     <Upload size={16} />
                   </div>
                   <span className="text-xs font-medium text-white/60 group-hover:text-primary">{t('activity.upload_pdf')}</span>
                </button>
                <button onClick={onUpload} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-red-500/20 hover:text-red-400 transition-all group">
                   <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
                     <Youtube size={16} />
                   </div>
                   <span className="text-xs font-medium text-white/60 group-hover:text-red-400">{t('activity.youtube_link')}</span>
                </button>
             </div>
             <button onClick={onUpload} className="w-full mt-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 text-primary hover:bg-primary/10 hover:border-primary/30 transition-all text-xs font-bold uppercase tracking-wide">
               <Plus size={14} />
               <span>{t('activity.new_project')}</span>
             </button>
           </div>

        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active 
        ? 'bg-white/10 text-white' 
        : 'text-white/40 hover:text-white hover:bg-white/5'
    }`}>
      <span>{label}</span>
    </button>
  );
}

function MaterialRowCard({ material, onClick }: { material: Material, onClick: () => void }) {
  const { t } = useTranslation();
  const getStatusLabel = () => {
    switch (material.processing_status) {
      case 'completed': return 'READY';
      case 'processing': return 'PROCESSING';
      case 'queued': return 'QUEUED';
      case 'failed': return 'FAILED';
      default: return String(material.processing_status).toUpperCase();
    }
  };

  const getStatusColor = () => {
    switch (material.processing_status) {
      case 'completed': return 'bg-emerald-500/5 text-emerald-500';
      case 'processing': return 'bg-amber-500/5 text-amber-500';
      case 'queued': return 'bg-blue-500/5 text-blue-500';
      case 'failed': return 'bg-red-500/5 text-red-500';
      default: return 'bg-white/5 text-white/60';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex items-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200 hover:shadow-lg overflow-hidden cursor-pointer w-full"
      onClick={onClick}
    >
      {/* Metallic Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex items-center w-full justify-between gap-4">

         {/* LEFT SIDE: Info & Icon */}
         <div className="flex items-center gap-4 min-w-0 flex-1">
             {/* Icon */}
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 shrink-0 shadow-sm ${material.type === 'pdf' ? 'bg-blue-500/10 text-blue-400' : material.type === 'youtube' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'}`}>
                {material.type === 'pdf' ? <FileText size={18} /> : material.type === 'youtube' ? <Youtube size={18} /> : <LinkIcon size={18} />}
             </div>

             {/* Info */}
             <div className="min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                   <h3 className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{material.title}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40 font-mono truncate">
                   <span>{material.type.toUpperCase()}</span>
                   <span className="w-1 h-1 rounded-full bg-white/20" />
                   <span>{new Date(material.created_at).toLocaleDateString()}</span>
                </div>
             </div>
         </div>

         {/* RIGHT SIDE: CTA SLOT */}
         <div className="flex items-center justify-end gap-3 pl-4 border-l border-white/5 shrink-0 relative h-10">

             {/* Default State: Status & Main Button */}
             <div className="flex items-center justify-end gap-3 transition-opacity duration-200 group-hover:opacity-0">
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor()}`}>
                  {getStatusLabel()}
                </div>
                <button className={`px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm whitespace-nowrap ${
                  material.processing_status === 'completed'
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white border border-white/10'
                }`}>
                  {material.processing_status === 'completed' ? t('activity.continue') : material.processing_status === 'processing' ? t('activity.view') : t('activity.retry')}
                </button>
             </div>

             {/* Hover State: Quick Actions */}
             <div className="flex items-center justify-end gap-1 absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#0C0C0F] md:bg-transparent">
                <ActionButton icon={<Play size={14} />} tooltip={t('activity.continue')} onClick={(e) => { e.stopPropagation(); onClick(); }} />
                <ActionButton icon={<Brain size={14} />} tooltip={t('activity.tabs_flashcards')} onClick={(e) => { e.stopPropagation(); toast.info(t('activity.opening_flashcards')); }} />
                <ActionButton icon={<CheckCircle2 size={14} />} tooltip={t('activity.tabs_quiz')} onClick={(e) => { e.stopPropagation(); toast.info(t('activity.starting_quiz')); }} />
                <div className="w-px h-4 bg-white/10 mx-1" />
                <ActionButton icon={<MoreHorizontal size={14} />} onClick={(e) => { e.stopPropagation(); toast.info("More options"); }} />
             </div>
         </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon, tooltip, onClick }: { icon: React.ReactNode, tooltip?: string, onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-transparent hover:border-white/5 cursor-pointer" title={tooltip}>
      {icon}
    </button>
  );
}
