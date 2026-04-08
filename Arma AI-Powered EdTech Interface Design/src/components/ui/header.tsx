"use client";

import * as React from "react";

import { motion, AnimatePresence } from 'motion/react';
import { Brain, ChevronRight, Globe, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/I18nContext';
import type { Language } from '../../i18n';
import { languageNames } from '../../i18n';

function Header({}: React.ComponentProps<"header">) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [langOpen, setLangOpen] = React.useState(false);
  const langRef = React.useRef<HTMLDivElement>(null);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header>
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 md:py-8 max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.1] flex items-center justify-center text-primary relative z-10 backdrop-blur-md shadow-inner">
                <Brain className="w-5 h-5" />
                </div>
            </div>
            <span className="text-xl font-medium tracking-tight text-white/90 group-hover:text-white transition-colors">arma</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
            {['features', 'pricing', 'about'].map((item) => (
                <button
                  key={item}
                  onClick={() => item === 'pricing' ? navigate('/pricing') : undefined}
                  className="text-sm font-medium text-white/60 hover:text-white transition-colors relative group cursor-pointer"
                >
                {t(`header.${item}`)}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
                </button>
            ))}
            </div>

            <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div ref={langRef} className="relative">
              <motion.button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.03] border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Globe className="w-3.5 h-3.5 text-primary" />
                <motion.span
                  key={language}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className=" sm:inline"
                >
                  {languageNames[language]}
                </motion.span>
                <motion.div
                  animate={{ rotate: langOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="w-3 h-3 text-white/40" />
                </motion.div>
                
              </motion.button>
              <AnimatePresence>
                
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-full mt-2 w-40 rounded-xl bg-[#1A1A1E] border border-white/10 shadow-xl overflow-hidden z-50"
                  >
                    
                    {(Object.keys(languageNames) as Language[]).map((lang) => (
                      <motion.button
                        key={lang}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (Object.keys(languageNames) as Language[]).indexOf(lang) * 0.04 }}
                        onClick={() => { setLanguage(lang); setLangOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 justify-between ${
                          language === lang
                            ? 'bg-primary/10 text-primary'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{languageNames[lang]}</span>
                        <AnimatePresence>
                          {language === lang && (
                            
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isAuthenticated ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                  {initials}
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors max-w-[120px] truncate">
                  {user?.full_name || user?.email || t('header.dashboard')}
                </span>
                <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="hidden md:block text-sm font-medium text-white/80 hover:text-white transition-colors cursor-pointer">{t('header.login')}</button>
                <button
                    onClick={() => navigate('/register')}
                    className="group px-6 py-2.5 bg-primary/10 text-primary border border-primary/20 text-sm font-medium rounded-full hover:bg-primary hover:text-black hover:shadow-[0_0_25px_rgba(255,138,61,0.4)] transition-all flex items-center gap-2 backdrop-blur-sm cursor-pointer"
                >
                    {t('header.start_learning')}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}
            </div>
        </nav>
    </header>
  );
}

export { Header };
