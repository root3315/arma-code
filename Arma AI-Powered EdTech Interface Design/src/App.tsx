import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UploadModal } from './components/shared/UploadModal';
import { Toaster } from './components/ui/sonner';
import { clearLandingIntent, consumeLandingIntent, setLandingIntent } from './utils/landingIntent';

export type ViewState = 'dashboard' | 'activity' | 'library' | 'flashcards' | 'languages' | 'exam' | 'voice' | 'profile' | 'materials';

const DashboardLayout = lazy(() =>
  import('./components/dashboard/DashboardLayout').then((m) => ({ default: m.DashboardLayout }))
);
const DashboardHome = lazy(() =>
  import('./components/dashboard/DashboardHome').then((m) => ({ default: m.DashboardHome }))
);
const ActivityView = lazy(() =>
  import('./components/dashboard/ActivityView').then((m) => ({ default: m.ActivityView }))
);
const LibraryView = lazy(() =>
  import('./components/dashboard/LibraryView').then((m) => ({ default: m.LibraryView }))
);
const ProfileView = lazy(() =>
  import('./components/dashboard/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const ProjectDetailView = lazy(() =>
  import('./components/dashboard/ProjectDetailView').then((m) => ({ default: m.ProjectDetailView }))
);
const FlashcardsView = lazy(() =>
  import('./components/dashboard/FlashcardsView').then((m) => ({ default: m.FlashcardsView }))
);
const LanguagesView = lazy(() =>
  import('./components/dashboard/LanguagesView').then((m) => ({ default: m.LanguagesView }))
);
const ExamView = lazy(() =>
  import('./components/dashboard/ExamView').then((m) => ({ default: m.ExamView }))
);
const VoiceTeacherView = lazy(() =>
  import('./components/dashboard/VoiceTeacherView').then((m) => ({ default: m.VoiceTeacherView }))
);

function LandingPageWrapper() {
  const navigate = useNavigate();
  return (
    <LandingPage
      onStart={(payload) => {
        const hasTopic = Boolean(payload?.topic?.trim());
        const hasFile = Boolean(payload?.file);

        if (hasTopic || hasFile) {
          setLandingIntent({
            topic: payload?.topic,
            file: payload?.file || null,
          });
        } else {
          clearLandingIntent();
        }

        navigate('/login');
      }}
    />
  );
}

function DashboardWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [landingTopicQuery, setLandingTopicQuery] = useState('');
  const [uploadPrefill, setUploadPrefill] = useState<{
    initialTab?: 'upload' | 'youtube' | 'link';
    initialInputValue?: string;
    initialFile?: File | null;
    autoUpload?: boolean;
  } | null>(null);

  useEffect(() => {
    const pendingIntent = consumeLandingIntent();
    if (!pendingIntent) {
      return;
    }

    if (pendingIntent.topic) {
      setLandingTopicQuery(pendingIntent.topic);
    }

    if (pendingIntent.file) {
      setUploadPrefill({
        initialTab: 'upload',
        initialFile: pendingIntent.file,
        autoUpload: true,
      });
      setUploadModalOpen(true);
    }
  }, []);

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
    setUploadPrefill(null);
    setUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setUploadModalOpen(false);
    setUploadPrefill(null);
  };

  const handleUploadStart = (type: 'PDF' | 'YouTube' | 'Link', title: string) => {
    // После успешной загрузки можно перейти к материалу или остаться на текущей странице
    // Материал будет добавлен через API внутри UploadModal
    console.log(`Upload started: ${type} - ${title}`);
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
      <Suspense fallback={<div className="min-h-screen bg-[#0C0C0F]" />}>
        <DashboardLayout
          currentView={getCurrentView()}
          onNavigate={handleNavigate}
          onUpload={handleUpload}
          onProjectSelect={handleMaterialClick}
        >
          <Routes>
            <Route
              index
              element={(
                <DashboardHome
                  key={refreshTrigger}
                  onMaterialClick={handleMaterialClick}
                  onUpload={handleUpload}
                  prefillQuery={landingTopicQuery}
                  onPrefillConsumed={() => setLandingTopicQuery('')}
                />
              )}
            />
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
      </Suspense>

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <UploadModal
            onClose={handleCloseUploadModal}
            onUploadStart={handleUploadStart}
            onSuccess={handleUploadSuccess}
            initialTab={uploadPrefill?.initialTab}
            initialInputValue={uploadPrefill?.initialInputValue}
            initialFile={uploadPrefill?.initialFile}
            autoUpload={uploadPrefill?.autoUpload}
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
      </AuthProvider>
    </BrowserRouter>
  );
}
