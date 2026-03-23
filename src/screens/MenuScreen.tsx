import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Clock,
  FolderOpen,
  Shield,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { db } from '../db/db';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPlayTime(createdAt: number): string {
  const sec = Math.floor((Date.now() - createdAt) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─────────────────────────────────────────────
// Stat row
// ─────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid #1a1a1a' }}
    >
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm" style={{ color: '#888' }}>
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function MenuScreen() {
  const agencyName = useGameStore((s) => s.agencyName);
  const bossName = useGameStore((s) => s.bossName);
  const currencies = useGameStore((s) => s.currencies);
  const createdAt = useGameStore((s) => s.createdAt);

  const totalMissionsCompleted = useGameStore((s) => s.totalMissionsCompleted);
  const totalMissionsAttempted = useGameStore((s) => s.totalMissionsAttempted);
  const totalAgentsLost = useGameStore((s) => s.totalAgentsLost);
  const totalExpansions = useGameStore((s) => s.totalExpansions);
  const resetStore = useGameStore((s) => s.reset);
  const requestSaveSelect = useUIStore((s) => s.requestSaveSelect);

  const [agentCount, setAgentCount] = useState(0);
  const [regionCount, setRegionCount] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const [playTime, setPlayTime] = useState(formatPlayTime(createdAt));

  useEffect(() => {
    db.agents
      .filter((a) => a.status !== 'dead')
      .count()
      .then(setAgentCount);
    db.regions
      .filter((r) => r.owned)
      .count()
      .then(setRegionCount);
  }, []);

  // Update play time every minute
  useEffect(() => {
    const id = setInterval(
      () => setPlayTime(formatPlayTime(createdAt)),
      60_000,
    );
    return () => clearInterval(id);
  }, [createdAt]);

  const successRate =
    totalMissionsAttempted > 0
      ? Math.round((totalMissionsCompleted / totalMissionsAttempted) * 100)
      : null;

  async function handleReset() {
    await Promise.all([
      db.gameState.clear(),
      db.safeHouses.clear(),
      db.agents.clear(),
      db.regions.clear(),
      db.missions.clear(),
      db.activeMissions.clear(),
      db.recruitmentPools.clear(),
      db.blackMarket.clear(),
      db.missionLog.clear(),
    ]);
    resetStore();
    window.location.reload();
  }

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: '#0a0a0a', color: '#e8e8e8' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: '#111', border: '1px solid #2a2a2a' }}
          >
            <Shield size={24} color="#4ade80" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {agencyName || 'Agentura'}
            </h1>
            <p className="text-sm" style={{ color: '#666' }}>
              Dir. {bossName}
            </p>
          </div>
        </div>

        {/* Currency overview */}
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              icon: '$',
              color: '#4ade80',
              val: currencies.money,
              label: 'Peníze',
            },
            {
              icon: '◈',
              color: '#60a5fa',
              val: currencies.intel,
              label: 'Intel',
            },
            {
              icon: '◆',
              color: '#a78bfa',
              val: currencies.shadow,
              label: 'Shadow',
            },
            {
              icon: '✦',
              color: '#f97316',
              val: currencies.influence,
              label: 'Vliv',
            },
          ].map(({ icon, color: iconColor, val, label }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 flex flex-col items-center gap-0.5"
              style={{ background: '#111', border: '1px solid #1a1a1a' }}
            >
              <span className="text-base" style={{ color: iconColor }}>
                {icon}
              </span>
              <span className="text-sm font-bold">{val}</span>
              <span className="text-[10px]" style={{ color: '#555' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* Agency stats */}
        <div
          className="rounded-xl"
          style={{ background: '#111', border: '1px solid #2a2a2a' }}
        >
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <BarChart3 size={15} color="#4ade80" />
            <p
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: '#555' }}
            >
              Statistiky
            </p>
          </div>
          <div className="px-3 pb-3">
            <StatRow
              icon="🎯"
              label="Mise splněny"
              value={totalMissionsCompleted}
            />
            <StatRow
              icon="📊"
              label="Úspěšnost"
              value={successRate !== null ? `${successRate} %` : '—'}
            />
            <StatRow
              icon="💀"
              label="Agenti ztraceni"
              value={totalAgentsLost}
            />
            <StatRow icon="🌍" label="Expanze" value={totalExpansions} />
            <StatRow icon="👥" label="Aktivní agenti" value={agentCount} />
            <StatRow icon="🏢" label="Ovládané regiony" value={regionCount} />
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: '#555' }} />
                <span className="text-sm" style={{ color: '#888' }}>
                  Čas hry
                </span>
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: '#e8e8e8' }}
              >
                {playTime}
              </span>
            </div>
          </div>
        </div>

        {/* Switch save */}
        <button
          onClick={requestSaveSelect}
          className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
          style={{
            background: '#0f1a0f',
            color: '#4ade80',
            border: '1px solid #1f3d1f',
          }}
        >
          <FolderOpen size={15} />
          Uložené hry
        </button>

        {/* Reset */}
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{
              background: '#0f0f0f',
              color: '#555',
              border: '1px solid #1a1a1a',
            }}
          >
            Resetovat hru
          </button>
        ) : (
          <div
            className="rounded-xl p-4"
            style={{ background: '#2e0f0f', border: '1px solid #ef444433' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} color="#ef4444" />
              <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                Opravdu resetovat?
              </p>
            </div>
            <p className="text-xs mb-4" style={{ color: '#888' }}>
              Tato akce je nevratná. Veškerý postup bude ztracen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReset(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: '#1a1a1a',
                  color: '#888',
                  border: '1px solid #2a2a2a',
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                Resetovat
              </button>
            </div>
          </div>
        )}

        {/* Version */}
        <p className="text-center text-xs pb-2" style={{ color: '#333' }}>
          Shadow Ops v0.1.0 · Offline PWA
        </p>
      </div>
    </div>
  );
}
