"use client";

import { FileText, X } from "lucide-react";
import { useState, useRef } from "react";
import { useTranslation } from '../../i18n/I18nContext';
import { toast } from "sonner";

interface FileInputProps {
  file?: File;
  onAdd?: (files: File[]) => void;
  onDelete?: () => void;
}

function FileInput({ file, onAdd, onDelete }: FileInputProps) {
  const { t } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const isValidFile = (file: File) => {
    // Check by MIME type
    const mimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    
    if (mimeTypes.includes(file.type)) {
      return true;
    }
    
    // Fallback: check by file extension (more reliable)
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    return allowedExtensions.includes(fileExtension);
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(isValidFile);
    const invalidFiles = files.length - validFiles.length;

    if (invalidFiles > 0) {
      toast.error(t('upload.unsupported_files'));
    }

    if (validFiles.length === 0) {
      return;
    }

    onAdd?.(validFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) {
      return;
    }

    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    e.target.value = "";
  };

  return (
    <div
      className={`flex-1 border-2 border-dashed rounded-xl flex flex-col transition-colors cursor-pointer ${
        dragActive
          ? "border-primary bg-primary/5"
          : file
            ? "border-primary/50 bg-primary/5 justify-start"
            : "border-white/10 hover:border-white/20 hover:bg-white/5 p-4 md:p-8 justify-center items-center"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !file && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {file ? (
        <div className="flex items-center p-2 justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`w-8 h-8 shrink-0 rounded-full flex justify-center items-center ${
                file
                  ? "bg-primary/20 text-primary"
                  : "bg-white/5 text-white/40"
              }`}
            >
              <FileText size={16} />
            </div>
            <p className="text-white/80 font-medium truncate">
              {file.name}
            </p>
            <p className="text-white/40 text-sm">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="p-2 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <div
            className={`w-16 h-16 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-4 ${
              file
                ? "bg-primary/20 text-primary"
                : "bg-white/5 text-white/40"
            }`}
          >
            <FileText size={32} />
          </div>
          <p className="text-white/80 font-medium mb-1">
            {t('upload.drag_drop')}
          </p>
          <p className="text-white/40 text-sm my-1">
            {t('upload.supported_formats')}
          </p>
          <p className="text-white/40 text-sm mb-4">
            {t('upload.or_browse')}
          </p>
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
            {t('upload.choose_files')}
          </button>
        </>
      )}
    </div>
  );
}

export { FileInput };
