import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import MapScreen from './screens/MapScreen';
import MissionsScreen from './screens/MissionsScreen';
import AgentsScreen from './screens/AgentsScreen';
import BaseScreen from './screens/BaseScreen';
import MenuScreen from './screens/MenuScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LandingScreen from './screens/LandingScreen';
import { loadGame } from './engine/initializeGame';
import { activateSlot } from './db/db';
import { listSaveSlots } from './db/saveSlots';
import { useGameStore } from './store/gameStore';
import { useUIStore, type Toast } from './store/uiStore';
import { usePassiveIncome } from './hooks/usePassiveIncome';
import { useMissionTimer } from './hooks/useMissionTimer';
import { useConstructionTicker } from './hooks/useConstructionTicker';

type AppState = 'loading' | 'landing' | 'onboarding' | 'game';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const loaded = useGameStore((s) => s.loaded);
  const resetStore = useGameStore((s) => s.reset);
  const saveSwitchRequested = useUIStore((s) => s.saveSwitchRequested);
  const clearSaveSwitchRequest = useUIStore((s) => s.clearSaveSwitchRequest);

  // On startup: try to auto-resume the last active slot, else show slot picker
  useEffect(() => {
    async function init() {
      const lastSlotId = localStorage.getItem('shadow-ops-active-slot');

      // Try to resume the last active slot
      if (lastSlotId) {
        try {
          activateSlot(lastSlotId);
          const found = await loadGame();
          if (found) {
            setAppState('game');
            return;
          }
        } catch (err) {
          console.warn(
            '[App] Failed to load active slot, falling back to slot picker:',
            err,
          );
          // Don't clear lastSlotId — might be a transient error (e.g. SW update)
          // Fall through to slot picker so user doesn't lose progress
        }
      }

      // Check if any saves exist at all
      try {
        const slots = await listSaveSlots();
        setAppState(slots.length > 0 ? 'landing' : 'onboarding');
      } catch (err) {
        console.warn('[App] Failed to list save slots:', err);
        // If we know a slot existed (lastSlotId), show landing rather than nuking to onboarding
        setAppState(lastSlotId ? 'landing' : 'onboarding');
      }
    }
    init();
  }, []);

  // When initializeGame() sets loaded=true after onboarding, switch to game
  useEffect(() => {
    if (loaded && appState === 'onboarding') {
      setAppState('game');
    }
  }, [loaded, appState]);

  // When MenuScreen requests save select, return to slot picker
  useEffect(() => {
    if (saveSwitchRequested && appState === 'game') {
      clearSaveSwitchRequest();
      resetStore();
      localStorage.removeItem('shadow-ops-active-slot');
      setAppState('landing');
    }
  }, [saveSwitchRequested, appState, clearSaveSwitchRequest, resetStore]);

  async function handleLoadSlot(slotId: string) {
    activateSlot(slotId);
    localStorage.setItem('shadow-ops-active-slot', slotId);
    resetStore();
    await loadGame();
    setAppState('game');
  }

  if (appState === 'loading') {
    return <LoadingScreen />;
  }

  if (appState === 'landing') {
    return (
      <BrowserRouter>
        <LandingScreen
          onLoadSlot={handleLoadSlot}
          onNewGame={() => {
            resetStore();
            setAppState('onboarding');
          }}
        />
      </BrowserRouter>
    );
  }

  if (appState === 'onboarding') {
    return (
      <BrowserRouter>
        <OnboardingScreen />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <GameShell />
    </BrowserRouter>
  );
}

function GameShell() {
  usePassiveIncome();
  useMissionTimer();
  useConstructionTicker();

  return (
    <div
      className="flex flex-col"
      style={{ height: '100%', background: '#222222' }}
    >
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: '4rem',
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapScreen />} />
          <Route path="/missions" element={<MissionsScreen />} />
          <Route path="/agents" element={<AgentsScreen />} />
          <Route path="/base" element={<BaseScreen />} />
          <Route path="/menu" element={<MenuScreen />} />
        </Routes>
      </main>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}

// ─────────────────────────────────────────────
// Global toast container
// ─────────────────────────────────────────────

const TOAST_COLORS: Record<Toast['type'], string> = {
  success: '#4ade80',
  error: '#ef4444',
  warning: '#facc15',
  info: '#60a5fa',
};

function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 flex flex-col gap-1.5 pointer-events-none"
      style={{ bottom: '4.5rem', zIndex: 100, padding: '0 12px' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-xl px-3 py-2.5 text-sm font-medium shadow-lg pointer-events-auto flex items-center gap-2"
          style={{
            background: '#262626',
            color: TOAST_COLORS[t.type],
          }}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div
      className="flex items-center justify-center h-full flex-col gap-3"
      style={{ background: '#222222', color: '#e8e8e8' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#4ade80', borderTopColor: 'transparent' }}
      />
      <p
        className="text-xs tracking-widest uppercase"
        style={{ color: '#888' }}
      >
        Inicializuji...
      </p>
    </div>
  );
}
