import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, Minimize2, X, FileText } from 'lucide-react';

interface PDFWrapperProps {
  pdfUrl?: string | null;
  fileName?: string | null;
  children: React.ReactNode;
}

/**
 * PDF Wrapper with split-screen toggle view
 * Shows AI-generated content alongside the original PDF
 */
export const PDFWrapper: React.FC<PDFWrapperProps> = ({
  pdfUrl,
  fileName,
  children,
}) => {
  const [showPdf, setShowPdf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleTogglePdf = useCallback(() => {
    setShowPdf((prev) => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleClosePdf = useCallback(() => {
    setShowPdf(false);
    setIsFullscreen(false);
  }, []);

  // If no PDF URL, render children only
  if (!pdfUrl) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FF8A3D]" />
          <span className="text-sm font-medium text-[#F3F3F3]">
            {fileName || 'Original Document'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle PDF View */}
          <button
            onClick={handleTogglePdf}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showPdf
                ? 'bg-[#FF8A3D] text-white'
                : 'bg-white/[0.06] text-[#9CA3AF] hover:text-[#F3F3F3]'
            }`}
          >
            {showPdf ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Hide PDF
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                View Original
              </>
            )}
          </button>

          {/* Fullscreen Toggle (only when PDF is shown) */}
          {showPdf && !isFullscreen && (
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-lg bg-white/[0.06] text-[#9CA3AF] hover:text-[#F3F3F3] transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {/* Close (only in fullscreen) */}
          {isFullscreen && (
            <button
              onClick={handleClosePdf}
              className="p-1.5 rounded-lg bg-white/[0.06] text-[#9CA3AF] hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`transition-all duration-500 ease-in-out ${
          showPdf
            ? isFullscreen
              ? 'h-full'
              : 'grid grid-cols-1 lg:grid-cols-2 gap-6'
            : ''
        }`}
      >
        {/* AI Content (children) */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{
            opacity: showPdf && !isFullscreen ? 1 : 1,
            maxWidth: showPdf && !isFullscreen ? '50%' : '100%',
          }}
          transition={{ duration: 0.4 }}
          className={`${
            showPdf && !isFullscreen ? 'lg:col-span-1' : ''
          } ${isFullscreen ? 'hidden' : ''}`}
        >
          {children}
        </motion.div>

        {/* PDF Viewer */}
        <AnimatePresence>
          {showPdf && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className={`${
                isFullscreen ? 'fixed inset-0 bg-[#0C0C0F] p-4' : 'lg:col-span-1'
              }`}
            >
              <div
                className={`h-[600px] lg:h-[calc(100vh-300px)] bg-[#121215] border border-white/[0.08] rounded-xl overflow-hidden ${
                  isFullscreen ? 'h-[calc(100vh-80px)]' : ''
                }`}
              >
                <iframe
                  src={`${pdfUrl}#toolbar=0`}
                  className="w-full h-full"
                  title="PDF Viewer"
                  style={{ border: 'none' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Simple PDF Viewer component (standalone)
 */
interface SimplePDFViewerProps {
  pdfUrl: string;
  onClose?: () => void;
}

export const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({
  pdfUrl,
  onClose,
}) => {
  return (
    <div className="relative w-full h-full">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-[#121215]/90 backdrop-blur border border-white/[0.08] text-[#9CA3AF] hover:text-[#F3F3F3] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <iframe
        src={pdfUrl}
        className="w-full h-full"
        title="PDF Viewer"
        style={{ border: 'none' }}
      />
    </div>
  );
};
