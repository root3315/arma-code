import { useState, useEffect, useCallback, useRef } from 'react';
import { materialsApi } from '../services/api';

interface ProcessingStatus {
  material_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string | null;
  stage: number;
  stage_key: string;
  stage_text: string;
  has_summary: boolean;
  has_flashcards: boolean;
  has_quiz: boolean;
}

/**
 * Hook for polling material processing status
 */
export function useProcessingStatus(materialId: string | null, pollInterval?: number) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!materialId) {
      setStatus(null);
      return;
    }

    try {
      const newStatus = await materialsApi.getProcessingStatus(materialId);
      setStatus(newStatus);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch processing status');
    }
  }, [materialId]);

  useEffect(() => {
    if (!materialId) {
      setStatus(null);
      return;
    }

    // Initial fetch
    fetchStatus();

    // Poll if not completed or failed
    const interval = pollInterval || 2000; // Default 2 seconds
    const poller = setInterval(() => {
      const isStillProcessing = status && 
        (status.status.toLowerCase() === 'processing' || status.status.toLowerCase() === 'queued');
      
      if (isStillProcessing) {
        fetchStatus();
      }
    }, interval);

    return () => clearInterval(poller);
  }, [materialId, pollInterval, status?.status, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
    isComplete: status?.status === 'completed',
    isFailed: status?.status === 'failed',
    isProcessing: status?.status === 'processing' || status?.status === 'queued',
  };
}

/**
 * Hook for managing upload + processing flow
 */
export function useMaterialUpload(refetch?: () => void, materialId?: string | null) {
  const uploadingRef = useRef(false);
  const currentMaterialIdRef = useRef<string | null>(null);
  const showProcessingModalRef = useRef(false);
  const minShowTimeElapsedRef = useRef(false);
  
  const [uploading, setUploading] = useState(false);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [minShowTimeElapsed, setMinShowTimeElapsed] = useState(false);

  // Update currentMaterialId when prop changes
  useEffect(() => {
    if (materialId && materialId !== currentMaterialId) {
      setCurrentMaterialId(materialId);
      setShowProcessingModal(true);
      showProcessingModalRef.current = true;
      setMinShowTimeElapsed(false);
      minShowTimeElapsedRef.current = false;
    }
  }, [materialId, currentMaterialId]);

  const {
    status,
    isComplete,
    isFailed,
    error: statusError,
    refetch: refetchStatus,
  } = useProcessingStatus(materialId || currentMaterialId);

  // Ensure modal shows for at least 2 seconds (for perceived performance)
  useEffect(() => {
    if (showProcessingModalRef.current) {
      const timer = setTimeout(() => {
        minShowTimeElapsedRef.current = true;
        setMinShowTimeElapsed(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      minShowTimeElapsedRef.current = false;
      setMinShowTimeElapsed(false);
    }
  }, [showProcessingModal]);

  const startUpload = useCallback(async (uploadFn: () => Promise<string>) => {
    try {
      setUploading(true);
      uploadingRef.current = true;
      
      setShowProcessingModal(true);
      showProcessingModalRef.current = true;
      setMinShowTimeElapsed(false);
      minShowTimeElapsedRef.current = false;
      
      

      // Start upload and get material ID
      const materialId = await uploadFn();
      
      setCurrentMaterialId(materialId);
      currentMaterialIdRef.current = materialId;

      // Status polling will start automatically via useProcessingStatus
    } catch (err: any) {
      setUploading(false);
      uploadingRef.current = false;
      setShowProcessingModal(false);
      showProcessingModalRef.current = false;
      throw err;
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowProcessingModal(false);
    showProcessingModalRef.current = false;
    setCurrentMaterialId(null);
    currentMaterialIdRef.current = null;
    setUploading(false);
    uploadingRef.current = false;
    // Refresh data after modal closes
    if (refetch) {
      refetch(false); // Don't show loading animation
    }
  }, [refetch]);

  // Debug: log status changes
  useEffect(() => {
    if (status) {
    }
  }, [status]);

  return {
    uploading,
    showProcessingModal: showProcessingModal && (isComplete ? minShowTimeElapsed : true),
    currentMaterialId,
    status,
    isComplete,
    isFailed,
    statusError,
    startUpload,
    handleCloseModal,
  };
}
