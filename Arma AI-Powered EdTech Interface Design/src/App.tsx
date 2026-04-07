import { useState } from 'react';
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
import { ProjectDetailView as MaterialDetailView } from './components/dashboard/ProjectDetailView';
import { ProjectDetailView as ProjectPageView } from './pages/ProjectDetailView';
import { FlashcardsView } from './components/dashboard/FlashcardsView';
import { LanguagesView } from './components/dashboard/LanguagesView';
import { UploadModal } from './components/shared/UploadModal';
import { UpgradeModal } from './components/shared/UpgradeModal';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PricingPage } from './pages/PricingPage';
import { projectsApi } from './services/api';
import { OnboardingTour } from './components/dashboard/OnboardingTour';

export type ViewState = 'dashboard' | 'activity' | 'library' | 'flashcards' | 'languages' | 'profile' | 'materials';

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
    if (path.startsWith('projects')) return 'materials';
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

  const openProjectDestination = async (projectId: string) => {
    navigate(`/dashboard/projects/${projectId}`);
  };

  const handleUploadSuccess = async ({
    projectId,
    firstMaterialId,
    totalFiles,
  }: {
    projectId: string;
    firstMaterialId?: string;
    totalFiles: number;
  }) => {
    setRefreshTrigger(prev => prev + 1);
    navigate(`/dashboard/projects/${projectId}`);
  };

  const handleMaterialClick = (materialId: string) => {
    // Navigate to project instead of individual material
    // For now, we'll go to materials view - this should be updated to project view
    navigate(`/dashboard/materials/${materialId}`);
  };

  const handleProjectClick = async (projectId: string) => {
    await openProjectDestination(projectId);
  };

  return (
    <>
      <DashboardLayout
        currentView={getCurrentView()}
        onNavigate={handleNavigate}
        onUpload={handleUpload}
        onProjectSelect={handleProjectClick}
      >
        <Routes>
          <Route index element={<DashboardHome key={refreshTrigger} onMaterialClick={handleMaterialClick} onProjectClick={handleProjectClick} onUpload={handleUpload} />} />
          <Route path="activity" element={<ActivityView key={refreshTrigger} onProjectClick={handleMaterialClick} onUpload={handleUpload} />} />
          <Route path="library" element={<LibraryView key={refreshTrigger} onProjectClick={handleProjectClick} onUpload={handleUpload} />} />
          <Route path="flashcards" element={<FlashcardsView />} />
          <Route path="flashcards/:deckId" element={<FlashcardsView />} />
          <Route path="languages" element={<LanguagesView />} />
          <Route path="profile" element={<ProfileView />} />
          <Route path="materials/:id" element={<MaterialDetailView />} />
          <Route path="projects/:projectId" element={<ProjectPageView />} />
        </Routes>
      </DashboardLayout>

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <UploadModal
            onClose={handleCloseUploadModal}
            onSuccess={handleUploadSuccess}
          />
        )}
      </AnimatePresence>

      {/* Onboarding Tour - shows for first-time users */}
      <OnboardingTour />
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
            <UpgradeModal />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPageWrapper />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/pricing" element={<PricingPage />} />

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
