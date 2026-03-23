# UX Components Integration Guide

This guide shows how to integrate the new UX components into your existing pages.

---

## 1. Processing Modal + Upload Flow

### Usage in Dashboard/Page Component

```tsx
import React, { useState } from 'react';
import { ProcessingModal } from '@/components/dashboard/ProcessingModal';
import { useMaterialUpload } from '@/hooks/useMaterialUpload';
import { DashboardHero } from '@/components/dashboard/DashboardHero';

export function MyDashboard() {
  const {
    uploading,
    showProcessingModal,
    status,
    isComplete,
    isFailed,
    statusError,
    startUpload,
    handleCloseModal,
  } = useMaterialUpload();

  const handleUploadPDF = async () => {
    await startUpload(async () => {
      // Your upload logic here
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      
      return new Promise<string>((resolve, reject) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return reject('No file selected');
          
          // Call your API
          const material = await materialsApi.create({
            title: file.name,
            material_type: 'pdf',
            file,
          });
          resolve(material.id);
        };
        input.click();
      });
    });
  };

  return (
    <>
      <DashboardHero
        onUploadPDF={handleUploadPDF}
        onUploadVideo={() => {/* similar */}}
        onUploadNotes={() => {/* similar */}}
        isUploading={uploading}
      />

      <ProcessingModal
        isOpen={showProcessingModal}
        realProgress={status?.progress || 0}
        isComplete={isComplete}
        isError={isFailed}
        errorMessage={statusError || undefined}
        onClose={handleCloseModal}
        materialName="Document Name"
      />
    </>
  );
}
```

---

## 2. Progressive Reveal for Content Sections

### Usage in Material Detail Page

```tsx
import React, { useEffect, useState } from 'react';
import { ProgressiveReveal, ProgressiveRevealGroup } from '@/components/dashboard/ProgressiveReveal';
import { useRevealSections } from '@/components/dashboard/ProgressiveReveal';

export function MaterialDetailPage({ materialId }) {
  const [material, setMaterial] = useState(null);
  const [summary, setSummary] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [quiz, setQuiz] = useState(null);

  // Fetch data...
  useEffect(() => {
    // Load all data at once
    Promise.all([
      materialsApi.get(materialId),
      materialsApi.getSummary(materialId),
      materialsApi.getFlashcards(materialId),
      materialsApi.getQuiz(materialId),
    ]).then(([mat, sum, flash, q]) => {
      setMaterial(mat);
      setSummary(sum);
      setFlashcards(flash);
      setQuiz(q);
    });
  }, [materialId]);

  // Reveal sections in sequence
  const revealedSections = useRevealSections(['summary', 'flashcards', 'quiz'], 800);

  return (
    <div className="space-y-8">
      {/* Summary - appears first */}
      {revealedSections.summary && summary && (
        <div className="summary-tab">
          <SummaryTab summary={summary} />
        </div>
      )}

      {/* Flashcards - appears after 1.4s */}
      {revealedSections.flashcards && flashcards && (
        <div className="flashcards-tab">
          <FlashcardsTab flashcards={flashcards} />
        </div>
      )}

      {/* Quiz - appears after 2.6s */}
      {revealedSections.quiz && quiz && (
        <div className="quiz-tab">
          <QuizTab quiz={quiz} />
        </div>
      )}
    </div>
  );
}
```

### Alternative: Using ProgressiveRevealGroup

```tsx
<ProgressiveRevealGroup
  sections={[
    { id: 'summary', content: <SummaryTab summary={summary} /> },
    { id: 'flashcards', content: <FlashcardsTab flashcards={flashcards} /> },
    { id: 'quiz', content: <QuizTab quiz={quiz} /> },
  ]}
  baseDelay={800}
  staggerDelay={600}
/>
```

---

## 3. Onboarding Tour

### Usage in Main App/Layout

```tsx
import React, { useEffect } from 'react';
import { OnboardingTour, useOnboarding } from '@/components/dashboard/OnboardingTour';

export function App() {
  const { needsOnboarding, markAsSeen } = useOnboarding();

  return (
    <>
      {/* Your app content */}
      <Dashboard />

      {/* Onboarding tour - shows automatically for first-time users */}
      <OnboardingTour
        isOpen={needsOnboarding}
        onComplete={() => {
          markAsSeen();
          console.log('Onboarding completed!');
        }}
        onSkip={() => {
          markAsSeen();
        }}
      />
    </>
  );
}
```

### Manual Trigger (e.g., "Show Tutorial" button)

```tsx
export function HelpMenu() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { resetOnboarding } = useOnboarding();

  const handleShowTutorial = () => {
    resetOnboarding(); // Clear the "has seen" flag
    setShowOnboarding(true);
  };

  return (
    <>
      <button onClick={handleShowTutorial}>Show Tutorial</button>
      <OnboardingTour isOpen={showOnboarding} onComplete={() => setShowOnboarding(false)} />
    </>
  );
}
```

---

## 4. PDF Wrapper with Split View

### Usage in Material Detail Page

```tsx
import React from 'react';
import { PDFWrapper } from '@/components/material/PDFWrapper';

export function MaterialDetailView({ material }) {
  const pdfUrl = material.file_path 
    ? `http://localhost:8000/storage/${material.file_path}`
    : null;

  return (
    <PDFWrapper
      pdfUrl={pdfUrl}
      fileName={material.file_name}
    >
      {/* Your AI-generated content */}
      <div className="space-y-6">
        <SummaryTab summary={material.summary} />
        <FlashcardsTab flashcards={material.flashcards} />
        <QuizTab quiz={material.quiz} />
      </div>
    </PDFWrapper>
  );
}
```

### Standalone PDF Viewer

```tsx
import { SimplePDFViewer } from '@/components/material/PDFWrapper';

export function PDFModal({ pdfUrl, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0C0C0F]">
      <SimplePDFViewer pdfUrl={pdfUrl} onClose={onClose} />
    </div>
  );
}
```

---

## 5. Dashboard Hero (New Primary CTA Design)

### Replace Old Hero Section

```tsx
import { DashboardHero } from '@/components/dashboard/DashboardHero';

export function Dashboard() {
  const handleUploadPDF = () => {
    // Your upload logic
  };

  const handleSearch = (query: string) => {
    // Your search logic
  };

  return (
    <div className="min-h-screen">
      <DashboardHero
        onUploadPDF={handleUploadPDF}
        onUploadVideo={() => {/* ... */}}
        onUploadNotes={() => {/* ... */}}
        onSearch={handleSearch}
        isUploading={false}
      />
    </div>
  );
}
```

---

## 6. Custom Hooks Reference

### useFakeProgress

```tsx
import { useFakeProgress } from '@/hooks/useProgress';

function MyComponent({ realProgress, isComplete }) {
  const {
    displayProgress,      // Smoothed progress value (0-100)
    currentStage,         // Current stage index (0-6)
    stageText,            // "Generating summary..."
    narrationText,        // Rotating narration text
    eta,                  // Estimated seconds remaining
  } = useFakeProgress({
    realProgress,
    isComplete,
    onStageChange: (stage) => console.log('Stage:', stage),
  });

  return <ProgressBar value={displayProgress} />;
}
```

### useMaterialUpload

```tsx
import { useMaterialUpload } from '@/hooks/useMaterialUpload';

function UploadButton() {
  const {
    uploading,
    showProcessingModal,
    currentMaterialId,
    status,
    isComplete,
    isFailed,
    statusError,
    startUpload,
    handleCloseModal,
  } = useMaterialUpload();

  const handleClick = async () => {
    await startUpload(async () => {
      // Return material ID
      const result = await uploadFile(file);
      return result.materialId;
    });
  };

  return (
    <>
      <button onClick={handleClick} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      <ProcessingModal
        isOpen={showProcessingModal}
        realProgress={status?.progress || 0}
        isComplete={isComplete}
        isError={isFailed}
        onClose={handleCloseModal}
      />
    </>
  );
}
```

---

## 7. Full Example: Complete Dashboard Integration

```tsx
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  DashboardHero,
  ProcessingModal,
  OnboardingTour,
  ProgressiveReveal,
} from '@/components/dashboard';
import { useMaterialUpload } from '@/hooks/useMaterialUpload';
import { materialsApi } from '@/services/api';

export function CompleteDashboard() {
  const {
    showProcessingModal,
    status,
    isComplete,
    isFailed,
    statusError,
    startUpload,
    handleCloseModal,
  } = useMaterialUpload();

  const [materials, setMaterials] = useState([]);

  const handleUploadPDF = async () => {
    await startUpload(async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';

      return new Promise((resolve, reject) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return reject('No file');

          const material = await materialsApi.create({
            title: file.name,
            material_type: 'pdf',
            file,
            project_id: 'some-project-id',
          });

          setMaterials(prev => [...prev, material]);
          resolve(material.id);
        };
        input.click();
      });
    });
  };

  return (
    <>
      <div className="min-h-screen bg-[#0C0C0F]">
        {/* Hero Section */}
        <DashboardHero
          onUploadPDF={handleUploadPDF}
          onUploadVideo={() => {}}
          onUploadNotes={() => {}}
          isUploading={showProcessingModal}
        />

        {/* Materials List */}
        <div className="materials-list mt-12 px-8">
          <h2 className="text-2xl font-bold text-[#F3F3F3] mb-6">
            Your Materials
          </h2>
          <div className="grid gap-4">
            {materials.map((material) => (
              <ProgressiveReveal
                key={material.id}
                sectionId={material.id}
                delay={200}
              >
                <MaterialCard material={material} />
              </ProgressiveReveal>
            ))}
          </div>
        </div>
      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={showProcessingModal}
        realProgress={status?.progress || 0}
        isComplete={isComplete}
        isError={isFailed}
        errorMessage={statusError}
        onClose={handleCloseModal}
      />

      {/* Onboarding Tour */}
      <OnboardingTour />
    </>
  );
}
```

---

## 8. Styling & Customization

### Color Variables (Tailwind)

All components use the design system colors from `DESIGN.md`:

```css
/* In your tailwind.config.js or globals.css */
:root {
  --color-primary: #FF8A3D;
  --color-accent: #F59E0B;
  --color-background: #0C0C0F;
  --color-surface: #121215;
  --color-foreground: #F3F3F3;
  --color-muted: #9CA3AF;
}
```

### Custom Animations

Components use `motion` from `motion/react` (Framer Motion). Customize easing:

```tsx
<motion.div
  transition={{
    duration: 0.4,
    ease: [0.22, 1, 0.36, 1], // Custom ease-out
  }}
/>
```

---

## 9. Troubleshooting

### Modal not showing
- Check `isOpen` prop is `true`
- Ensure z-index is not overridden by other elements

### Progress not moving
- Verify `realProgress` is being updated
- Check backend `/processing-status` endpoint

### Onboarding not appearing
- Clear localStorage: `localStorage.removeItem('hasSeenOnboarding')`
- Check `needsOnboarding` state

### PDF not loading
- Verify CORS settings on backend
- Check file path is accessible

---

## 10. File Structure

```
src/
├── components/
│   ├── dashboard/
│   │   ├── ProcessingModal.tsx
│   │   ├── DashboardHero.tsx
│   │   ├── ProgressiveReveal.tsx
│   │   ├── OnboardingTour.tsx
│   │   └── index.ts
│   └── material/
│       └── PDFWrapper.tsx
├── hooks/
│   ├── useProgress.ts
│   └── useMaterialUpload.ts
├── utils/
│   └── progressUtils.ts
└── services/
    └── api.ts (updated with getProcessingStatus)
```

---

**Last Updated:** 2026-03-22
**Version:** 1.0.0
