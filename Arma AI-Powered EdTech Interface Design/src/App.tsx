import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { ActivityView } from './components/dashboard/ActivityView';
import { LibraryView } from './components/dashboard/LibraryView';
import { ProfileView } from './components/dashboard/ProfileView';
import { ProjectDetailView } from './components/dashboard/ProjectDetailView';
import { FlashcardsView } from './components/dashboard/FlashcardsView';
import { LanguagesView } from './components/dashboard/LanguagesView';
import { ExamView } from './components/dashboard/ExamView';
import { VoiceTeacherView } from './components/dashboard/VoiceTeacherView';
import { UploadModal } from './components/shared/UploadModal';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';

export type ViewState = 'dashboard' | 'activity' | 'library' | 'flashcards' | 'languages' | 'exam' | 'voice' | 'profile' | 'materials';

function LandingPageWrapper() {
  const navigate = useNavigate();
  return <LandingPage onStart={() => navigate('/login')} />;
}

function DashboardWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Определяем текущий view из URL
  const getCurrentView = (): ViewState => {
    const path = location.pathname.split('/dashboard/')[1] || '';
    if (path.startsWith('materials')) return 'materials';
    if (path.startsWith('voice')) return 'voice';
    if (path === '' || path === '/') return 'dashboard';
    return path.split('/')[0] as ViewState;
  };

  const handleNavigate = (view: ViewState) => {
    if (view === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${view}`);
    }
  };

  const handleUpload = () => {
    setUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setUploadModalOpen(false);
  };

  const handleUploadStart = (type: 'PDF' | 'YouTube' | 'Link', title: string) => {
    // После успешной загрузки можно перейти к материалу или остаться на текущей странице
    // Материал будет добавлен через API внутри UploadModal
    // Upload started via UploadModal API call
  };

  const handleUploadSuccess = () => {
    // Триггер для обновления списка материалов во всех компонентах
    setRefreshTrigger(prev => prev + 1);
  };

  const handleMaterialClick = (materialId: string) => {
    navigate(`/dashboard/materials/${materialId}`);
  };

  return (
    <>
      <DashboardLayout
        currentView={getCurrentView()}
        onNavigate={handleNavigate}
        onUpload={handleUpload}
        onProjectSelect={handleMaterialClick}
      >
        <Routes>
          <Route index element={<DashboardHome key={refreshTrigger} onMaterialClick={handleMaterialClick} onUpload={handleUpload} />} />
          <Route path="activity" element={<ActivityView key={refreshTrigger} onProjectClick={handleMaterialClick} onUpload={handleUpload} />} />
          <Route path="library" element={<LibraryView key={refreshTrigger} onProjectClick={handleMaterialClick} onUpload={handleUpload} />} />
          <Route path="flashcards" element={<FlashcardsView />} />
          <Route path="flashcards/:deckId" element={<FlashcardsView />} />
          <Route path="languages" element={<LanguagesView />} />
          <Route path="exam" element={<ExamView />} />
          <Route path="voice" element={<VoiceTeacherView />} />
          <Route path="profile" element={<ProfileView />} />
          <Route path="materials/:id" element={<ProjectDetailView />} />
        </Routes>
      </DashboardLayout>

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <UploadModal
            onClose={handleCloseUploadModal}
            onUploadStart={handleUploadStart}
            onSuccess={handleUploadSuccess}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary dark">
            <Toaster />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPageWrapper />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected routes */}
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute>
                    <DashboardWrapper />
                  </ProtectedRoute>
                }
              />

              {/* Redirect unknown routes */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
