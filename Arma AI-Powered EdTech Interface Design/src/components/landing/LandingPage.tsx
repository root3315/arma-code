import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Brain,
  FileText,
  ChevronRight,
  Upload,
  Sparkles,
  Plus,
  Youtube,
  MessageSquare,
  CheckCircle2,
  Headphones,
  MonitorPlay,
} from 'lucide-react';
import { AICore } from '../shared/AICore';

interface LandingPageProps {
  onStart: (payload?: { topic?: string; file?: File | null }) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const [topic, setTopic] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    onStart({
      topic,
      file: selectedFile,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== 'application/pdf') {
      return;
    }
    setSelectedFile(file);
  };

  return (
    <div
      className="flex flex-col min-h-screen bg-[#050505] text-foreground overflow-hidden selection:bg-primary/20 selection:text-primary relative"
      style={{ fontFamily: '"Sora", "Geist", "Inter", "Segoe UI", sans-serif' }}
    >
      
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
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 md:py-8 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3 group cursor-pointer">
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
            <button key={item} className="text-sm font-medium text-white/60 hover:text-white transition-colors relative group">
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => onStart()} className="hidden md:block text-sm font-medium text-white/80 hover:text-white transition-colors">Log in</button>
          <button 
            onClick={handleStart}
            className="group px-6 py-2.5 bg-primary/10 text-primary border border-primary/20 text-sm font-medium rounded-full hover:bg-primary hover:text-black hover:shadow-[0_0_25px_rgba(255,138,61,0.4)] transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            Start Learning
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </nav>

      {/* HERO SECTION - Center Focus */}
      <section className="relative z-10 pt-36 md:pt-40 pb-24 md:pb-32 px-4 sm:px-6 flex flex-col items-center justify-center min-h-[90vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[48%] -z-10 opacity-90 pointer-events-none"
        >
          <div className="relative">
            <div className="absolute inset-[-20%] bg-[#FF8C42]/25 blur-[90px] rounded-full animate-pulse duration-[4s]" />
            <div className="absolute inset-[8%] bg-[#FF8C42]/20 blur-[50px] rounded-full animate-pulse duration-[3s]" />
            <AICore size="xl" className="opacity-90" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center max-w-5xl mx-auto space-y-6 md:space-y-8 relative z-10"
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-white leading-[1.05] drop-shadow-2xl">
            Unlock Your Best <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">
              Learning With arma
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-white/50 max-w-2xl mx-auto">
            Type a topic or attach a PDF. After login, Arma continues exactly from your request.
          </p>

          <motion.div
            className="max-w-6xl mx-auto w-full pt-2 md:pt-4"
            animate={{
              boxShadow: [
                '0 0 0 rgba(255,140,66,0)',
                '0 0 36px rgba(255,140,66,0.18)',
                '0 0 0 rgba(255,140,66,0)',
              ],
            }}
            transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative rounded-[2rem] border border-[#FF8C42]/35 bg-[linear-gradient(95deg,rgba(9,9,12,0.95),rgba(22,13,9,0.92),rgba(6,9,16,0.95))] backdrop-blur-xl px-4 py-3 md:px-6 md:py-5 shadow-[0_0_0_1px_rgba(255,140,66,0.08),0_20px_70px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-3 md:gap-5">
                <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-[#FF8C42]/80 shrink-0" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  placeholder="What do you want to learn?"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-lg sm:text-2xl md:text-[2.6rem] text-white/92 placeholder:text-white/26 tracking-tight"
                />
                <div className="shrink-0 flex items-center gap-2 md:gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full text-white/80 hover:text-white hover:bg-white/8 transition-colors flex items-center justify-center"
                    title="Attach PDF"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/7 border border-white/10 text-white hover:bg-white/14 hover:border-white/25 transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    title="Start learning"
                  >
                    <ArrowUpRight className="w-6 h-6 md:w-7 md:h-7" />
                  </button>
                </div>
              </div>
            </div>

            {selectedFile && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs sm:text-sm text-white/75">
                <FileText className="w-4 h-4 text-[#FF8C42]" />
                <span>{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-white/50 hover:text-white"
                >
                  remove
                </button>
              </div>
            )}
          </motion.div>
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
            <h2 className="text-3xl md:text-5xl font-medium text-white mb-6">How to use? — Simple.</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Upload any type of document or YouTube video. arma processes the content and generates learning materials automatically.
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-12">
            {/* Connecting Line */}
            <div className="absolute top-12 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent hidden md:block" />
            
            {[
              { 
                step: "01", 
                title: "Upload what you don't understand", 
                desc: "PDF documents or YouTube video links.",
                icon: <Upload className="w-6 h-6 text-white" />
              },
              { 
                step: "02", 
                title: "Let our AI process your material", 
                desc: "Advanced neural processing analyzes structure.",
                icon: <Sparkles className="w-6 h-6 text-primary" />
              },
              { 
                step: "03", 
                title: "Learn using multiple formats", 
                desc: "Quizzes, Flashcards, Podcasts, Slides.",
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
              <h2 className="text-3xl font-medium text-white">More ways to learn with arma</h2>
              <p className="text-white/50 leading-relaxed">
                Seamlessly integrate your study materials. Whether it's a textbook chapter or an educational video, arma adapts.
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Upload Files (PDF)</h4>
                    <p className="text-xs text-white/40">Only PDF files are allowed for document upload.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-red-500/30 transition-colors group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                    <Youtube size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">YouTube Video Link</h4>
                    <p className="text-xs text-white/40">Paste any educational video URL.</p>
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
          
          <h2 className="text-3xl md:text-4xl font-medium text-white">Let our AI process your material</h2>
          <p className="text-xl text-white/50 font-light leading-relaxed">
            After you upload your material, our AI starts processing it <br className="hidden md:block" />
            and builds your personal learning experience.
          </p>
          
          {/* Progress Indicator Visual */}
          <div className="max-w-md mx-auto mt-12">
            <div className="flex justify-between text-xs text-white/40 mb-2 font-mono uppercase tracking-wider">
              <span>Analyzing</span>
              <span>Generating</span>
              <span>Complete</span>
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
          <h2 className="text-4xl font-medium text-white mb-4">Features</h2>
          <p className="text-white/40 text-lg">A complete toolkit for understanding.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: <MessageSquare size={24} />, 
              title: "AI Chat Box", 
              desc: "Ask anything about the material and get clear explanations." 
            },
            { 
              icon: <Brain size={24} />, 
              title: "Flashcards", 
              desc: "Generate flashcards to learn concepts and key terms faster." 
            },
            { 
              icon: <CheckCircle2 size={24} />, 
              title: "Quizzes", 
              desc: "Test your knowledge with AI-generated quizzes." 
            },
            { 
              icon: <Headphones size={24} />, 
              title: "AI Podcasts", 
              desc: "Listen to AI-generated podcasts to learn while doing other things." 
            },
            { 
              icon: <MonitorPlay size={24} />, 
              title: "Auto Presentations", 
              desc: "Create presentations from your material and export them as PPT or PDF." 
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
          <span className="text-sm text-white/60 font-medium ml-2">Over 10,000 learners are already using arma.</span>
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
            <a href="#" className="hover:text-white transition-colors">Product</a>
            <a href="#" className="hover:text-white transition-colors">About arma</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
          </div>
          
          <div className="text-sm text-white/20">
            © 2024 arma AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
