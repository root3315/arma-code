"use client";

import * as React from "react";

import { Brain, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../../contexts/AuthContext';



function Header({}: React.ComponentProps<"header">) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

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
            {['Features', 'Pricing', 'About'].map((item) => (
                <button
                  key={item}
                  onClick={() => item === 'Pricing' ? navigate('/pricing') : undefined}
                  className="text-sm font-medium text-white/60 hover:text-white transition-colors relative group cursor-pointer"
                >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
                </button>
            ))}
            </div>

            <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                  {initials}
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors max-w-[120px] truncate">
                  {user?.full_name || user?.email || 'Dashboard'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="hidden md:block text-sm font-medium text-white/80 hover:text-white transition-colors cursor-pointer">Log in</button>
                <button
                    onClick={() => navigate('/register')}
                    className="group px-6 py-2.5 bg-primary/10 text-primary border border-primary/20 text-sm font-medium rounded-full hover:bg-primary hover:text-black hover:shadow-[0_0_25px_rgba(255,138,61,0.4)] transition-all flex items-center gap-2 backdrop-blur-sm cursor-pointer"
                >
                    Start Learning
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
