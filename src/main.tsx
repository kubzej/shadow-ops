import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// ── iOS PWA viewport fix ──────────────────────────────────
// Sets --app-height CSS var to real window.innerHeight.
// Needed because iOS standalone mode doesn't reliably update
// CSS viewport units (vh/dvh) after suspend/resume.
function setAppHeight() {
  document.documentElement.style.setProperty(
    '--app-height',
    `${window.innerHeight}px`,
  );
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () =>
  setTimeout(setAppHeight, 150),
);
// On resume from background, poll briefly because iOS doesn't
// always fire resize events when restoring a PWA.
let pollCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPoll() {
  pollCount = 0;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    setAppHeight();
    if (++pollCount >= 10) {
      clearInterval(pollTimer!);
      pollTimer = null;
    }
  }, 300);
}
startPoll(); // initial load
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    setAppHeight();
    startPoll();
  }
});
window.addEventListener('pageshow', () => {
  setAppHeight();
  startPoll();
});
// ──────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
