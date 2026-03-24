import { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/missionStore';

/**
 * Runs a tick every second.
 * Detects completed active missions and moves them to the completedQueue.
 * Mount this once at the top level (e.g. in MissionsScreen or App).
 */
export function useMissionTimer() {
  const tickMissions = useMissionStore((s) => s.tickMissions);
  const tickRef = useRef(tickMissions);
  tickRef.current = tickMissions;

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current();
    }, 1000);

    // Catch up on missions that completed while the tab was in the background.
    const handleVisible = () => {
      if (document.visibilityState === 'visible') tickRef.current();
    };
    const handleFocus = () => tickRef.current();
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
}

/**
 * Formats seconds to "MM:SS" string.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
