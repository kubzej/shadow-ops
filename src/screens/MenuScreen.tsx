import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  FlaskConical,
  FolderOpen,
  Ghost,
  Globe,
  Map,
  Radio,
  Shield,
  Skull,
  Target,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { db } from '../db/db';
import { seedDemoDb } from '../demo/seed';
import { C, cardBase, btn } from '../styles/tokens';
import { ACHIEVEMENTS } from '../data/achievements';
import AchievementsScreen from './AchievementsScreen';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPlayTimeSecs(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─────────────────────────────────────────────
// Stat row
// ─────────────────────────────────────────────

function StatRow({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon size={15} color={iconColor ?? '#888'} />
        <span className="text-sm" style={{ color: '#888' }}>
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function MenuScreen() {
  const navigate = useNavigate();
  const agencyName = useGameStore((s) => s.agencyName);
  const bossName = useGameStore((s) => s.bossName);
  const currencies = useGameStore((s) => s.currencies);
  const getPlayTimeSecs = useGameStore((s) => s.getPlayTimeSecs);

  const totalMissionsCompleted = useGameStore((s) => s.totalMissionsCompleted);
  const totalMissionsAttempted = useGameStore((s) => s.totalMissionsAttempted);
  const totalAgentsLost = useGameStore((s) => s.totalAgentsLost);
  const totalExpansions = useGameStore((s) => s.totalExpansions);
  const resetStore = useGameStore((s) => s.reset);
  const requestSaveSelect = useUIStore((s) => s.requestSaveSelect);

  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);

  const [agentCount, setAgentCount] = useState(0);
  const [regionCount, setRegionCount] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [playTime, setPlayTime] = useState(
    formatPlayTimeSecs(getPlayTimeSecs()),
  );

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
      () => setPlayTime(formatPlayTimeSecs(getPlayTimeSecs())),
      60_000,
    );
    return () => clearInterval(id);
  }, [getPlayTimeSecs]);

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

  if (showAchievements) {
    return <AchievementsScreen onBack={() => setShowAchievements(false)} />;
  }

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: '#e8e8e8' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={cardBase}
          >
            <Shield size={24} color={C.green} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {agencyName || 'Agentura'}
            </h1>
            <p className="text-sm" style={{ color: '#999' }}>
              Dir. {bossName}
            </p>
          </div>
        </div>

        {/* Currency overview */}
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              Icon: Coins,
              color: C.green,
              val: currencies.money,
              label: 'Peníze',
            },
            {
              Icon: Eye,
              color: C.blue,
              val: currencies.intel,
              label: 'Intel',
            },
            {
              Icon: Ghost,
              color: C.bm,
              val: currencies.shadow,
              label: 'Shadow',
            },
            {
              Icon: Radio,
              color: C.divExtraction,
              val: currencies.influence,
              label: 'Vliv',
            },
          ].map(({ Icon, color: iconColor, val, label }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 flex flex-col items-center gap-0.5"
              style={cardBase}
            >
              <Icon size={18} color={iconColor} />
              <span className="text-sm font-bold">{val}</span>
              <span className="text-[10px]" style={{ color: '#888' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* Agency stats */}
        <div className="rounded-xl" style={cardBase}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <BarChart3 size={15} color={C.green} />
            <p
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: '#888' }}
            >
              Statistiky
            </p>
          </div>
          <div className="px-3 pb-3">
            <StatRow
              icon={Target}
              label="Mise splněny"
              value={totalMissionsCompleted}
            />
            <StatRow
              icon={Shield}
              label="Mise celkem"
              value={totalMissionsAttempted}
            />
            <StatRow
              icon={BarChart3}
              iconColor={C.green}
              label="Úspěšnost"
              value={successRate !== null ? `${successRate} %` : '—'}
            />
            <StatRow
              icon={Skull}
              iconColor={C.red}
              label="Agenti ztraceni"
              value={totalAgentsLost}
            />
            <StatRow icon={Globe} label="Expanze" value={totalExpansions} />
            <StatRow icon={Users} label="Aktivní agenti" value={agentCount} />
            <StatRow icon={Map} label="Ovládané regiony" value={regionCount} />
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: '#888' }} />
                <span className="text-sm" style={{ color: '#888' }}>
                  Čas hry
                </span>
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: C.textPrimary }}
              >
                {playTime}
              </span>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <button
          onClick={() => setShowAchievements(true)}
          className="w-full rounded-xl p-3 flex items-center gap-3"
          style={cardBase}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${C.yellow}18` }}
          >
            <Award size={18} color={C.yellow} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold" style={{ color: C.textPrimary }}>
              Achievements
            </p>
            <p className="text-xs" style={{ color: C.textMuted }}>
              {unlockedAchievements.length} / {ACHIEVEMENTS.length} odemčeno
            </p>
          </div>
          <ChevronRight size={16} color={C.textMuted} />
        </button>

        {/* Switch save */}
        <button
          onClick={requestSaveSelect}
          className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
          style={btn.primary()}
        >
          <FolderOpen size={15} />
          Uložené hry
        </button>

        {/* Demo mode */}
        <button
          onClick={async () => {
            if (demoLoading) return;
            setDemoLoading(true);
            try {
              sessionStorage.setItem(
                'shadow-ops-pre-demo-slot',
                localStorage.getItem('shadow-ops-active-slot') || '',
              );
              await seedDemoDb();
              useUIStore.getState().setDemoMode(true);
              navigate('/demo');
            } catch (err) {
              console.error('[MenuScreen] Demo init failed:', err);
              setDemoLoading(false);
            }
          }}
          disabled={demoLoading}
          className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
          style={{
            background: 'transparent',
            color: demoLoading ? C.textMuted : C.green,
            border: `1px solid ${demoLoading ? C.textMuted : C.green}40`,
            cursor: demoLoading ? 'not-allowed' : 'pointer',
            borderRadius: 14,
          }}
        >
          <FlaskConical size={15} />
          {demoLoading ? 'Inicializuji...' : 'Testovací prostředí'}
        </button>

        {/* Reset */}
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={btn.secondary()}
          >
            Resetovat hru
          </button>
        ) : (
          <div className="rounded-xl p-4" style={{ background: '#2e0f0f' }}>
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
                style={btn.secondary()}
              >
                Zrušit
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={btn.destructive}
              >
                Resetovat
              </button>
            </div>
          </div>
        )}

        {/* Version */}
        <p className="text-center text-xs pb-2" style={{ color: '#999' }}>
          Shadow Ops v0.1.0 · Offline PWA
        </p>
      </div>
    </div>
  );
}
