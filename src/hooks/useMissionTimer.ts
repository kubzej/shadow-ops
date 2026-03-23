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
    return () => clearInterval(id);
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
