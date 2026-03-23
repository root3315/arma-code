# UX Improvement Plan — EduPlatform (Arma)

## 🎯 Goal
Make the user experience feel **fast, alive, and intuitive** by managing attention and perceived time, not just raw performance.

**Key Principle:** Perceived speed > Actual speed

---

## 📋 Implementation Phases

### Phase 1: Processing Experience (Highest Impact)
| Task | Component | Priority | Est. Time |
|------|-----------|----------|-----------|
| Fullscreen Processing Modal | `ProcessingModal.tsx` | 🔴 Critical | 4-6h |
| Fake Progress Smoothing | Algorithm in modal | 🔴 Critical | 2h |
| Staged Loading + AI Narration | Text updates | 🟠 High | 2h |
| Time Estimation | Countdown display | 🟠 High | 1h |

### Phase 2: Dashboard Redesign
| Task | Component | Priority | Est. Time |
|------|-----------|----------|-----------|
| New Hero with Primary CTA | `ProjectDetailView.tsx` | 🟠 High | 3h |
| Move Search to Secondary | Same as above | 🟡 Medium | 1h |
| Drag & Drop Zone | Upload component | 🟡 Medium | 2h |

### Phase 3: Progressive Reveal
| Task | Component | Priority | Est. Time |
|------|-----------|----------|-----------|
| Fake Delays for Content | Material detail page | 🟠 High | 2h |
| Staged Display Logic | Summary → Flashcards → Quiz | 🟠 High | 2h |

### Phase 4: Onboarding
| Task | Component | Priority | Est. Time |
|------|-----------|----------|-----------|
| Walkthrough Overlay | `OnboardingTour.tsx` | 🟡 Medium | 3h |
| localStorage Tracking | Same as above | 🟡 Medium | 1h |

### Phase 5: PDF Wrapper (Optional/Advanced)
| Task | Component | Priority | Est. Time |
|------|-----------|----------|-----------|
| Toggle View | `PDFWrapper.tsx` | 🟢 Low | 3h |
| Split Screen | Same as above | 🟢 Low | 2h |
| Click Sync (Advanced) | Backend + Frontend | 🟢 Low | 6h+ |

### Phase 6: Backend Enhancements
| Task | Endpoint | Priority | Est. Time |
|------|----------|----------|-----------|
| Processing Status API | `GET /api/v1/materials/{id}/processing-status` | 🟠 High | 2h |
| WebSocket/SSE for updates | Optional real-time | 🟢 Low | 4h+ |

---

## 🎨 Design Specifications

### Processing Modal
```
┌─────────────────────────────────────────────┐
│                                             │
│              [Animated Icon]                │
│                                             │
│     "Building your personalized             │
│      learning space..."                     │
│                                             │
│     [████████████░░░░░] 67%                 │
│                                             │
│     "Generating summary..."                 │
│     ~8 seconds remaining                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Visual Requirements:**
- Dark background with blur: `bg-[#0C0C0F]/90 backdrop-blur-xl`
- Large progress bar: height 8px, width 320px
- Orange accent: `#FF8A3D`
- Smooth animations: `transition-all duration-300`
- Ambient glow effect around icon

### Stages (with AI Narration)
| Stage | Internal Key | Display Text | Duration |
|-------|--------------|--------------|----------|
| 1 | `uploading` | "Uploading your material..." | 1-2s |
| 2 | `analyzing` | "Analyzing content structure..." | 2-3s |
| 3 | `processing` | "Extracting key concepts..." | 3-4s |
| 4 | `summary` | "Generating summary..." | 2-3s |
| 5 | `flashcards` | "Creating smart flashcards..." | 2-3s |
| 6 | `quiz` | "Building quiz questions..." | 2-3s |
| 7 | `finalizing` | "Finalizing your learning space..." | 1-2s |
| 8 | `complete` | "Ready! Redirecting..." | 0.5s |

**Narration Variants (rotate every 2s):**
```typescript
const narrations = {
  analyzing: [
    "Analyzing content structure...",
    "Identifying main topics...",
    "Detecting document layout...",
  ],
  processing: [
    "Extracting key concepts...",
    "Finding important definitions...",
    "Mapping knowledge structure...",
  ],
  summary: [
    "Generating summary...",
    "Crafting concise overview...",
    "Distilling essential information...",
  ],
  flashcards: [
    "Creating smart flashcards...",
    "Generating Q&A pairs...",
    "Building study materials...",
  ],
  quiz: [
    "Building quiz questions...",
    "Designing knowledge checks...",
    "Preparing test questions...",
  ],
};
```

### Dashboard Hero
```
┌─────────────────────────────────────────────┐
│                                             │
│        "What will you learn today?"         │
│              (text-5xl, bold)               │
│                                             │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│   │ 📄       │ │ 🎥       │ │ 📝       │   │
│   │ Upload   │ │ Upload   │ │ Upload   │   │
│   │ PDF      │ │ Video    │ │ Notes    │   │
│   └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │     Drop files here or click        │   │
│   │           to browse                 │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│         (dashed border, p-8)                │
│                                             │
│   "Use search if you want additional        │
│    materials" (text-sm, muted)              │
│                                             │
│   [Search bar - secondary styling]          │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Fake Progress Algorithm
```typescript
function useFakeProgress(realProgress: number, isComplete: boolean) {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100);
      return;
    }

    const interval = setInterval(() => {
      setDisplayProgress(current => {
        // Cap at 95% until real completion
        if (current >= 95 && realProgress < 100) return current;
        
        // Random step for natural feel (0.5-3%)
        const step = Math.random() * 2.5 + 0.5;
        return Math.min(current + step, realProgress);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [realProgress, isComplete]);

  return displayProgress;
}
```

### Progressive Reveal (Fake Delays)
```typescript
// In material detail page
const [visibleSections, setVisibleSections] = useState({
  summary: false,
  flashcards: false,
  quiz: false,
});

useEffect(() => {
  // Staged reveal even if all data is ready
  const timers = [
    setTimeout(() => setVisibleSections(s => ({ ...s, summary: true })), 800),
    setTimeout(() => setVisibleSections(s => ({ ...s, flashcards: true })), 2000),
    setTimeout(() => setVisibleSections(s => ({ ...s, quiz: true })), 3500),
  ];
  return () => timers.forEach(clearTimeout);
}, []);
```

### Onboarding State Management
```typescript
// Use localStorage to track first-time users
const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');

useEffect(() => {
  if (!hasSeenOnboarding && user.isLoggedIn) {
    setRunOnboarding(true);
    localStorage.setItem('hasSeenOnboarding', 'true');
  }
}, [user.isLoggedIn]);
```

---

## 📁 New Files to Create

```
src/
├── components/
│   ├── dashboard/
│   │   ├── ProcessingModal.tsx        # NEW
│   │   ├── DashboardHero.tsx          # NEW (or extract from ProjectDetailView)
│   │   ├── UploadCard.tsx             # NEW
│   │   └── OnboardingTour.tsx         # NEW
│   └── material/
│       ├── PDFWrapper.tsx             # NEW
│       └── ProgressiveReveal.tsx      # NEW
├── hooks/
│   ├── useFakeProgress.ts             # NEW
│   ├── useProgressiveReveal.ts        # NEW
│   └── useOnboarding.ts               # NEW
└── utils/
    └── progressUtils.ts               # NEW (algorithms)
```

---

## 🎯 Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Time to first action | ~10s thinking | <3s |
| Perceived wait time | "Feels slow" | <15s with engagement |
| Drop-off during processing | High | <20% |
| Onboarding completion | N/A | >80% first-time |

---

## ⚠️ Gotchas & Considerations

1. **Don't over-fake:** If progress stalls at 95% for >30s, show message
2. **Mobile responsive:** Modal must work on small screens (full screen on mobile)
3. **Accessibility:** Progress bar needs `aria-valuenow`, `aria-label`
4. **Error handling:** If processing fails, show clear error + retry option
5. **Performance:** Don't render heavy animations while processing

---

## 🚀 Rollout Plan

**Week 1:**
- ✅ Processing Modal + Fake Progress (Tasks 2-4)
- ✅ Time Estimation (Task 7)

**Week 2:**
- ✅ Dashboard Redesign (Tasks 5-6)
- ✅ Progressive Reveal (Task 6)

**Week 3:**
- ✅ Onboarding (Task 8)
- ✅ Backend endpoint (Task 10)

**Week 4:**
- ✅ PDF Wrapper (Task 9, optional)
- ✅ Polish + Testing (Task 11)

---

**Last Updated:** 2026-03-22
**Status:** In Progress
