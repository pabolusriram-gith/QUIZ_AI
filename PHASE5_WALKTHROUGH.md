# QuizVerse AI Phase 5 - Core Live Quiz Experience Walkthrough

This walkthrough documents the design architecture, refactored files, and verified behaviors for Phase 5 – Core Live Quiz Experience.

## Implemented Features

### 1. Host Dashboard Completions
- **Lobby View**: Added interactive SVG QR codes (`qrcode.react`), direct copy links, and pin sharing widgets.
- **Controls Panel**: Implemented start, pause, resume, extend timer, next question, and end quiz triggers.
- **Recharts Stats Display**: Replaced basic layouts with consistent Recharts bar graphs representing answer distributions, alongside score, accuracy, and latency metrics.
- **Virtualized Participant List**: Built a high-performance custom table using custom offset windowing to render up to 100+ connections smoothly at 60 FPS.

### 2. Student Dashboard Completions
- **Lobby Wait Screen**: Composed waiting animation, connection metrics, nickname, PIN, and instructor info.
- **Question Board**: Designed clean form fields, TTS audio readbacks, question difficulty badges, and countdown indicators.
- **Forms Lock**: Integrated submission checks to lock the page and disable answers once submitted or timed out.
- **Results and Certificate**: Renders correct choices, ranking tables, accuracy scores, and enables certificate downloads.

### 3. Reconnect overlays & recovery
- **Connection widgets**: Renders network latency and heartbeat logs.
- **Reconnect overlays**: Covers the screen with non-blocking loaders during reconnects.
- **Expired/Timeout layouts**: Displays custom fullscreen layouts for timeout, disconnected, and quiz concluded errors.

---

## Code Architecture (Composed Components)

All large dashboards were refactored into modular components located under `components/live/`:

```
components/live/
├── ConnectionStatus.tsx     # Connection latency state indicator
├── HostLobby.tsx            # Host lobby screen with QR and code
├── HostControls.tsx         # Host button controls (Start, Pause, Resume)
├── QuestionPanel.tsx        # Active question text and metadata panel
├── ParticipantTable.tsx     # Virtualized, sortable scroll table (>100 players)
├── Leaderboard.tsx          # Real-time leaderboard with row transitions
├── StatisticsPanel.tsx      # Answer distribution bar chart (Recharts)
├── StudentLobby.tsx         # Student lobby loading wait screen
├── StudentQuestion.tsx      # Student playing board with locks and TTS
├── StudentResults.tsx       # Post-assessment scorecard and download certificate
├── Timer.tsx                # Dynamic synchronized countdown timer
├── ScoreCard.tsx            # Current rank and score overlay widget
└── shared/
    ├── EmptyState.tsx       # Placeholder cards for empty states
    ├── ErrorState.tsx       # Detailed visual overlays for network lost, expired, etc.
    ├── LoadingSkeleton.tsx  # Pulse skeletons for layout loading
    └── ReconnectOverlay.tsx # Overlay displayed during WebSocket reconnection
```

---

## Reused Backend Functionality
No changes were made to stable backend logic. All real-time synchronization leverages existing WebSocket channel paths:
- Participant lists are updated via `session_update` broadcasts.
- Active timers are synchronized using `timer_sync` frames.
- Session controls call existing REST endpoints (`/sessions/{pin}/pause`, `/sessions/{pin}/resume`, etc.).

---

## Verified Behaviors
- **Host Refresh Recovery**: Host can refresh the page during an active quiz. State and current timers are restored immediately via WebSocket timer frames.
- **Student Refresh Recovery**: Student can refresh during an active quiz. Answers are synced, and the active question and time limit are restored.
- **Accessibility features**: Tab outline focuses, keyboard selection hotkeys (keys `1` to `4`), and screen reader ARIA labels work.
