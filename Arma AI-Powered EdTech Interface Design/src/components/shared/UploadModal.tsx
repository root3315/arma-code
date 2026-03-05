import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Youtube, Link, FileText, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useCreateMaterial } from '../../hooks/useApi';

interface UploadModalProps {
  onClose: () => void;
  onUploadStart: (type: 'PDF' | 'YouTube' | 'Link', title: string) => void;
  onSuccess?: () => void; // Callback для обновления списка материалов
  initialTab?: 'upload' | 'youtube' | 'link';
  initialInputValue?: string;
  initialFile?: File | null;
  autoUpload?: boolean;
}

export function UploadModal({
  onClose,
  onUploadStart,
  onSuccess,
  initialTab,
  initialInputValue,
  initialFile,
  autoUpload = false,
}: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'youtube' | 'link'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoUploadTriggered = useRef(false);
  
  const { createMaterial, creating } = useCreateMaterial();

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (typeof initialInputValue === 'string') {
      setInputValue(initialInputValue);
    }
    if (initialFile) {
      setSelectedFile(initialFile);
      setActiveTab('upload');
    }
    autoUploadTriggered.current = false;
  }, [initialTab, initialInputValue, initialFile]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const handleUploadPDF = async () => {
    if (!selectedFile) return;

    try {
      const material = await createMaterial({
        title: selectedFile.name.replace('.pdf', ''),
        material_type: 'pdf',
        file: selectedFile,
      });

      toast.success('PDF uploaded successfully! Processing started.');
      onUploadStart('PDF', material.title);
      onSuccess?.(); // Обновляем список материалов
      onClose();
    } catch (err) {
      toast.error('Failed to upload PDF');
    }
  };

  useEffect(() => {
    if (!autoUpload || !selectedFile || creating || autoUploadTriggered.current) {
      return;
    }
    autoUploadTriggered.current = true;
    void handleUploadPDF();
  }, [autoUpload, selectedFile, creating]);

  const handleSubmitYouTube = async () => {
    if (!inputValue) return;

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(inputValue)) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    try {
      // Extract video title from URL or use a default
      const videoId = inputValue.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      const title = `YouTube Video ${videoId || ''}`.trim();

      const material = await createMaterial({
        title: title,
        material_type: 'youtube',
        source: inputValue,
      });

      toast.success('YouTube video added! Processing started.');
      onUploadStart('YouTube', material.title);
      onSuccess?.(); // Обновляем список материалов
      onClose();
    } catch (err) {
      toast.error('Failed to add YouTube video');
    }
  };

  const handleSubmitLink = async () => {
    if (!inputValue) return;

    // Validate URL
    try {
      new URL(inputValue);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    try {
      const material = await createMaterial({
        title: 'Web Resource',
        material_type: 'pdf', // For now, treating links as PDFs - adjust based on your backend
        source: inputValue,
      });

      toast.success('Link added! Processing started.');
      onUploadStart('Link', material.title);
      onSuccess?.(); // Обновляем список материалов
      onClose();
    } catch (err) {
      toast.error('Failed to add link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#121215] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-sm font-medium text-white">Add New Material</h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
           <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'bg-primary text-black' : 'text-white/60 hover:text-white'}`}
              >
                <Upload size={14} /> Upload PDF
              </button>
              <button 
                onClick={() => setActiveTab('youtube')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'youtube' ? 'bg-primary text-black' : 'text-white/60 hover:text-white'}`}
              >
                <Youtube size={14} /> YouTube
              </button>
              <button 
                onClick={() => setActiveTab('link')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'link' ? 'bg-primary text-black' : 'text-white/60 hover:text-white'}`}
              >
                <Link size={14} /> Link
              </button>
           </div>

           <div className="min-h-[200px] flex flex-col justify-center">
             {creating ? (
               <div className="flex flex-col items-center justify-center text-center">
                 <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                 <p className="text-white/80 font-medium">Processing...</p>
                 <p className="text-white/40 text-sm">Uploading and analyzing content</p>
               </div>
             ) : (
               <>
                 {activeTab === 'upload' && (
                    <div className="space-y-4">
                      <div 
                        className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer ${
                          dragActive ? 'border-primary bg-primary/5' : 
                          selectedFile ? 'border-primary/50 bg-primary/5' :
                          'border-white/10 hover:border-white/20 hover:bg-white/5'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                         <input
                           ref={fileInputRef}
                           type="file"
                           accept=".pdf"
                           onChange={handleFileSelect}
                           className="hidden"
                         />
                         <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                           selectedFile ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40'
                         }`}>
                           <FileText size={32} />
                         </div>
                         {selectedFile ? (
                           <>
                             <p className="text-white/80 font-medium mb-1">{selectedFile.name}</p>
                             <p className="text-white/40 text-sm">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                           </>
                         ) : (
                           <>
                             <p className="text-white/80 font-medium mb-1">Drag & drop your PDF here</p>
                             <p className="text-white/40 text-sm mb-4">or click to browse files</p>
                             <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
                               Choose File
                             </button>
                           </>
                         )}
                      </div>
                      {selectedFile && (
                        <button 
                          onClick={handleUploadPDF}
                          className="w-full py-3 bg-primary text-black font-medium rounded-xl hover:bg-primary/90 transition-all"
                        >
                          Upload PDF
                        </button>
                      )}
                    </div>
                 )}

                 {activeTab === 'youtube' && (
                    <div className="space-y-4">
                       <div>
                         <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                           Video URL
                         </label>
                         <input 
                           type="text" 
                           value={inputValue}
                           onChange={(e) => setInputValue(e.target.value)}
                           placeholder="https://youtube.com/watch?v=..."
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none transition-colors"
                         />
                       </div>
                       <button 
                         onClick={handleSubmitYouTube}
                         disabled={!inputValue}
                         className="w-full py-3 bg-primary text-black font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                       >
                         Add YouTube Video
                       </button>
                    </div>
                 )}

                 {activeTab === 'link' && (
                    <div className="space-y-4">
                       <div>
                         <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                           Web Page URL
                         </label>
                         <input 
                           type="text" 
                           value={inputValue}
                           onChange={(e) => setInputValue(e.target.value)}
                           placeholder="https://example.com/article"
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none transition-colors"
                         />
                       </div>
                       <button 
                         onClick={handleSubmitLink}
                         disabled={!inputValue}
                         className="w-full py-3 bg-primary text-black font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                       >
                         Add Link
                       </button>
                    </div>
                 )}
               </>
             )}
           </div>
        </div>
      </motion.div>
    </div>
  );
}
