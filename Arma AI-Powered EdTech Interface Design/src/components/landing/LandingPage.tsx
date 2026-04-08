import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Brain, Play, FileText, MessageSquare, Headphones, MonitorPlay, CheckCircle2, ChevronRight, Upload, Sparkles, Youtube, Check } from 'lucide-react';
import { AICore } from '../shared/AICore';
import { Header } from '../ui/header';
import { useTranslation } from '../../i18n/I18nContext';
import { useNavigate } from 'react-router-dom';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen bg-[#0C0C0F] text-foreground overflow-hidden font-sans selection:bg-primary/20 selection:text-primary relative">
      
      {/* GLOBAL ATMOSPHERE - Volumetric Light */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[800px] bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-40 blur-[100px]" />
        
        {/* Light Rays */}
        <div className="absolute top-[-20%] left-[20%] w-[1px] h-[120vh] bg-gradient-to-b from-white/[0.05] to-transparent rotate-[15deg] blur-[2px]" />
        <div className="absolute top-[-20%] right-[30%] w-[1px] h-[120vh] bg-gradient-to-b from-white/[0.03] to-transparent rotate-[-15deg] blur-[1px]" />
        
        {/* Soft floating orbs */}
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full" />
      </div>

      {/* NAVIGATION - Merged with Environment */}
      <Header />

      {/* HERO SECTION - Center Focus */}
      <section className="relative z-10 pt-40 pb-32 px-6 flex flex-col items-center justify-center min-h-[90vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-80"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse duration-[4s]" />
            <AICore size="xl" className="opacity-90" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center max-w-4xl mx-auto space-y-8 relative z-10"
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-white leading-[1.1] drop-shadow-2xl">
            {t('landing.hero_title')} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">
              {t('landing.hero_subtitle')}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/60 font-light max-w-2xl mx-auto leading-relaxed">
            {t('landing.hero_description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <button
              onClick={onStart}
              className="w-full sm:w-auto px-10 py-4 bg-white text-black text-lg font-bold rounded-full hover:bg-white/90 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center gap-2">{t('landing.start_learning_btn')} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>

            <button className="w-full sm:w-auto px-10 py-4 bg-white/5 text-white border border-white/10 text-lg font-medium rounded-full hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 backdrop-blur-md">
              {t('landing.learn_more_btn')}
            </button>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50"
        >
          <span className="text-xs uppercase tracking-widest text-white/40">Scroll to Explore</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/50 to-transparent" />
        </motion.div>
      </section>

      {/* HOW TO USE - Flow Layout */}
      <section className="py-32 relative z-10 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-3xl md:text-5xl font-medium text-white mb-6">{t('landing.how_to_use_title')}</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              {t('landing.how_to_use_desc')}
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-12">
            {/* Connecting Line */}
            <div className="absolute top-12 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent hidden md:block" />

            {[
              {
                step: "01",
                title: t('landing.step_01_title'),
                desc: t('landing.step_01_desc'),
                icon: <Upload className="w-6 h-6 text-white" />
              },
              {
                step: "02",
                title: t('landing.step_02_title'),
                desc: t('landing.step_02_desc'),
                icon: <Sparkles className="w-6 h-6 text-primary" />
              },
              {
                step: "03",
                title: t('landing.step_03_title'),
                desc: t('landing.step_03_desc'),
                icon: <Brain className="w-6 h-6 text-white" />
              }
            ].map((item, i) => (
              <div key={i} className="relative group">
                 <div className="w-24 h-24 rounded-full bg-[#0C0C0F] border border-white/10 flex items-center justify-center relative z-10 mx-auto mb-8 shadow-[0_0_30px_rgba(0,0,0,0.5)] group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(255,138,61,0.2)] transition-all duration-500">
                   {item.icon}
                 </div>
                 <div className="text-center space-y-3 px-4">
                   <span className="text-xs font-bold text-primary tracking-widest uppercase mb-2 block">Step {item.step}</span>
                   <h3 className="text-xl font-medium text-white group-hover:text-primary/90 transition-colors">{item.title}</h3>
                   <p className="text-white/40 leading-relaxed">{item.desc}</p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MORE WAYS TO LEARN - Glassy Panel */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-5xl mx-auto bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 md:p-16 relative overflow-hidden backdrop-blur-sm">
          {/* Ambient glow inside card */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-medium text-white">{t('landing.more_ways_title')}</h2>
              <p className="text-white/50 leading-relaxed">
                {t('landing.more_ways_desc')}
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{t('landing.upload_files')}</h4>
                    <p className="text-xs text-white/40">{t('landing.upload_files_desc')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-red-500/30 transition-colors group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                    <Youtube size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{t('landing.youtube_link')}</h4>
                    <p className="text-xs text-white/40">{t('landing.youtube_link_desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Representation of Input */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent blur-3xl opacity-30" />
              <div className="bg-[#121215] border border-white/10 rounded-2xl p-6 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-red-500/20" />
                     <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                     <div className="w-3 h-3 rounded-full bg-green-500/20" />
                   </div>
                   <span className="text-xs text-white/20 font-mono">input_processor.exe</span>
                </div>
                <div className="space-y-4">
                  <div className="h-10 bg-white/5 rounded-lg w-full animate-pulse" />
                  <div className="h-32 bg-white/5 rounded-lg w-full border border-dashed border-white/10 flex items-center justify-center text-white/20 text-sm">
                    Drag & Drop File Area
                  </div>
                  <div className="flex justify-end">
                    <div className="h-8 w-24 bg-primary/20 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI PROCESSING SECTION */}
      <section className="py-32 px-6 relative z-10 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="w-20 h-20 mx-auto mb-8 relative">
             <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping duration-[3s]" />
             <AICore size="sm" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-medium text-white">{t('landing.ai_process_title')}</h2>
          <p className="text-xl text-white/50 font-light leading-relaxed">
            {t('landing.ai_process_desc')}
          </p>

          {/* Progress Indicator Visual */}
          <div className="max-w-md mx-auto mt-12">
            <div className="flex justify-between text-xs text-white/40 mb-2 font-mono uppercase tracking-wider">
              <span>{t('landing.ai_analyzing')}</span>
              <span>{t('landing.ai_generating')}</span>
              <span>{t('landing.ai_complete')}</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
              <div className="absolute top-0 left-0 h-full w-2/3 bg-primary shadow-[0_0_10px_rgba(255,138,61,0.5)] rounded-full relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-32 px-6 max-w-7xl mx-auto border-t border-white/[0.03]">
        <div className="text-center mb-24">
          <h2 className="text-4xl font-medium text-white mb-4">{t('landing.features_title')}</h2>
          <p className="text-white/40 text-lg">{t('landing.features_desc')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <MessageSquare size={24} />,
              title: t('landing.feature_chat'),
              desc: t('landing.feature_chat_desc')
            },
            {
              icon: <Brain size={24} />,
              title: t('landing.feature_flashcards'),
              desc: t('landing.feature_flashcards_desc')
            },
            {
              icon: <CheckCircle2 size={24} />,
              title: t('landing.feature_quizzes'),
              desc: t('landing.feature_quizzes_desc')
            },
            {
              icon: <Headphones size={24} />,
              title: t('landing.feature_podcasts'),
              desc: t('landing.feature_podcasts_desc')
            },
            {
              icon: <MonitorPlay size={24} />,
              title: t('landing.feature_presentations'),
              desc: t('landing.feature_presentations_desc')
            }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              className="group p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/[0.05] to-transparent rounded-bl-full -mr-8 -mt-8 transition-opacity opacity-0 group-hover:opacity-100" />
              
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/80 mb-6 group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300 shadow-sm">
                {feature.icon}
              </div>
              
              <h3 className="text-xl font-medium text-white mb-3">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TRUST / SOCIAL PROOF */}
      <section className="py-20 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] backdrop-blur-sm">
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-white/10 border border-[#0C0C0F]" />
            ))}
          </div>
          <span className="text-sm text-white/60 font-medium ml-2">{t('landing.social_proof')}</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-white/[0.03] relative z-10 bg-[#0A0A0C]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <Brain className="w-5 h-5" />
            <span className="font-medium tracking-tight">arma</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-white/40">
            <a href="#" className="hover:text-white transition-colors">{t('landing.footer_product')}</a>
            <a href="#" className="hover:text-white transition-colors">{t('landing.footer_about')}</a>
            <a href="#" onClick={() => navigate('/pricing')} className="hover:text-white transition-colors">{t('landing.footer_pricing')}</a>
          </div>

          <div className="text-sm text-white/20">
            {t('landing.footer_rights')}
          </div>
        </div>
      </footer>
    </div>
  );
}
