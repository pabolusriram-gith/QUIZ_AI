# QuizVerse AI Phase 5 - Core Live Quiz Experience Release Notes

These release notes detail the changes, features, compatibility, and performance/accessibility metrics introduced in Phase 5 Core Live Quiz Experience.

## Features Added

- **State Recovery (Host & Student)**: Both presenter and student rooms can survive page refreshes or short-lived network failures. The page connects to the active WebSocket channel and restores state using cached REST data and sync timestamps.
- **Component Architecture**: Decoupled large pages into 14 reusable components under `components/live/` and `components/live/shared/`.
- **Integrated Recharts Charting**: Integrated clean, responsive Recharts bar charts showing real-time answer selection counts.
- **Resilience Overlays**: Included custom Error, Empty, and Reconnection states for networks lost, expired sessions, and maximum participant caps.

---

## Backend Compatibility
- **Zero New Endpoints**: All features reuse existing FastAPI REST paths and WebSocket frames.
- **Backward-Compatible WS Parsing**: Client listeners handle standard `session_update`, `timer_sync`, and control events securely.

---

## Performance Improvements

- **Component Memoization**: Leveraged `React.memo` for static widgets (headers, indicators) and state blocks to avoid unnecessary updates.
- **Table Virtualization**: Implemented custom viewport windowing inside `ParticipantTable.tsx` to handle lists with >100 rows at 60 FPS without DOM overhead.
- **Debounced Filters**: Bound search inputs to debounced state handlers to prevent search updates on every keystroke.

---

## Accessibility (A11y) Improvements

- **Keyboard Mappings**: Enabled keys `1`, `2`, `3`, and `4` as shortcuts for option selection on student questions.
- **Focus Rings**: Added visible outlines (`focus-visible:outline-2`) to all buttons and interactive choices.
- **Screen Reader Support**: Wrapped countdown times, results, and accuracy indicators in ARIA live regions (`aria-live="polite"`).
- **Reduced Motion Support**: Integrated CSS motion media queries (`prefers-reduced-motion`) to scale down spring transitions for players with motion sensitivities.

---

## Known Limitations
- Synthesized game sounds, emoji reactions, and confetti animations are omitted in this core phase (planned for later gamification phases).
- Certificate PDF generation requires active configuration of certificate templates on the host side.
