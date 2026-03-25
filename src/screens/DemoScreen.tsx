import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Map,
  RefreshCw,
  Target,
  Users,
  Building2,
  Settings,
  X,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { db, activateSlot } from '../db/db';
import { loadGame } from '../engine/initializeGame';
import { seedDemoDb } from '../demo/seed';
import { C, cardBase, DIVISION_COLOR, btn } from '../styles/tokens';
import { WORLD_EVENTS } from '../data/worldEvents';
import { generateCounterOp } from '../engine/missionGenerator';

// ─────────────────────────────────────────────
// Exit demo helper
// ─────────────────────────────────────────────

async function exitDemo(navigate: ReturnType<typeof useNavigate>) {
  const previousSlotId = sessionStorage.getItem('shadow-ops-pre-demo-slot');
  useUIStore.getState().setDemoMode(false);
  sessionStorage.removeItem('shadow-ops-pre-demo-slot');

  if (previousSlotId) {
    activateSlot(previousSlotId);
    localStorage.setItem('shadow-ops-active-slot', previousSlotId);
    await loadGame();
    navigate('/map');
  } else {
    // No previous slot — clear demo slot and go to slot picker via the
    // saveSwitchRequested mechanism so App.tsx handles the appState transition
    localStorage.removeItem('shadow-ops-active-slot');
    useUIStore.getState().requestSaveSelect();
  }
}

// ─────────────────────────────────────────────
// Nav card
// ─────────────────────────────────────────────

function NavCard({
  icon: Icon,
  label,
  to,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl w-full"
      style={{ ...cardBase, cursor: 'pointer' }}
      onClick={() => navigate(to)}
    >
      <Icon size={22} color={C.green} />
      <span className="text-xs font-medium" style={{ color: C.textSecondary }}>
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────
// Color swatch
// ─────────────────────────────────────────────

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-5 h-5 rounded flex-shrink-0"
        style={{ background: color, border: '1px solid #333' }}
      />
      <span className="text-xs" style={{ color: C.textMuted }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Status badge example
// ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  available: C.green,
  on_mission: C.blue,
  injured: C.divExtraction,
  captured: C.red,
  traveling: C.divInfluence,
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Volný',
  on_mission: 'Na misi',
  injured: 'Zraněný',
  captured: 'Zajat',
  traveling: 'Cestuje',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? C.textMuted;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─────────────────────────────────────────────
// World Event Controls
// ─────────────────────────────────────────────

function WorldEventControls() {
  const activeWorldEvent = useGameStore((s) => s.activeWorldEvent);
  const setWorldEvent = useGameStore((s) => s.setWorldEvent);
  const now = Date.now();

  function activateEvent(eventId: string) {
    const def = WORLD_EVENTS.find((e) => e.id === eventId);
    if (!def) return;
    setWorldEvent(
      { eventId: def.id, startedAt: now, expiresAt: now + def.durationMs },
      now + def.durationMs + 20 * 60 * 1000,
    );
  }

  return (
    <div>
      <p
        className="text-xs font-medium tracking-widest uppercase mb-3"
        style={{ color: C.textSecondary }}
      >
        Globální události
      </p>
      <div className="rounded-xl p-3 flex flex-col gap-2" style={cardBase}>
        {/* Active event info */}
        {activeWorldEvent ? (
          <div
            className="flex items-center justify-between px-2 py-1.5 rounded-lg"
            style={{
              background: `${C.green}14`,
            }}
          >
            <div className="flex items-center gap-2">
              <Zap size={12} color={C.green} />
              <span
                className="text-xs font-semibold"
                style={{ color: C.green }}
              >
                {WORLD_EVENTS.find((e) => e.id === activeWorldEvent.eventId)
                  ?.name ?? activeWorldEvent.eventId}
              </span>
            </div>
            <button
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: `${C.red}18`,
                color: C.red,
                cursor: 'pointer',
              }}
              onClick={() => setWorldEvent(null, Date.now())}
            >
              Ukončit
            </button>
          </div>
        ) : (
          <p className="text-xs px-2" style={{ color: C.textMuted }}>
            Žádná aktivní událost
          </p>
        )}
        {/* Event buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          {WORLD_EVENTS.map((def) => {
            const isActive = activeWorldEvent?.eventId === def.id;
            const color = def.positive ? C.green : C.red;
            return (
              <button
                key={def.id}
                disabled={isActive}
                className="text-left px-2.5 py-2 rounded-lg"
                style={{
                  background: isActive ? `${color}20` : C.bgSurface2,
                  color: isActive ? color : C.textSecondary,
                  cursor: isActive ? 'default' : 'pointer',
                  border: `1px solid ${isActive ? color : 'transparent'}30`,
                }}
                onClick={() => activateEvent(def.id)}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-xs font-semibold truncate">
                    {def.name}
                  </span>
                </div>
                <span
                  className="text-[10px] leading-tight line-clamp-2"
                  style={{ color: C.textMuted }}
                >
                  {def.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function DemoScreen() {
  const navigate = useNavigate();
  const agencyName = useGameStore((s) => s.agencyName);
  const bossName = useGameStore((s) => s.bossName);
  const currencies = useGameStore((s) => s.currencies);
  const totalMissionsCompleted = useGameStore((s) => s.totalMissionsCompleted);
  const rivalName = useGameStore((s) => s.rivalName);
  const activeRivalOperation = useGameStore((s) => s.activeRivalOperation);
  const rivalAggressionLevel = useGameStore((s) => s.rivalAggressionLevel);

  const [agentCount, setAgentCount] = useState(0);
  const [showDesign, setShowDesign] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    db.agents
      .filter((a) => a.status !== 'dead')
      .count()
      .then(setAgentCount);
  }, []);

  async function ensureCounterOpAndNavigate() {
    if (!activeRivalOperation) return;
    const region = await db.regions.get('amsterdam');
    if (!region) return;
    const existing = await db.missions
      .where('regionId')
      .equals('amsterdam')
      .filter((m) => !!m.isCounterOp)
      .toArray();
    if (existing.length === 0) {
      const counterOp = generateCounterOp(
        'amsterdam',
        1.2,
        activeRivalOperation.id,
      );
      await db.missions.add(counterOp);
      await db.regions.update('amsterdam', {
        availableMissionIds: [...region.availableMissionIds, counterOp.id],
      });
    }
    useUIStore.getState().selectRegion('amsterdam');
    navigate('/missions');
  }

  async function handleExit() {
    setExiting(true);
    try {
      await exitDemo(navigate);
    } catch (err) {
      console.error('[DemoScreen] Exit failed:', err);
      setExiting(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await seedDemoDb(true); // force re-seed
      // Pre-select Amsterdam so Missions screen shows flash mission immediately
      useUIStore.getState().selectRegion('amsterdam');
      setAgentCount(await db.agents.filter((a) => a.status !== 'dead').count());
    } catch (err) {
      console.error('[DemoScreen] Reset failed:', err);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* ── Demo banner header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: C.bgBase,
          borderBottom: `1px solid ${C.green}30`,
        }}
      >
        <FlaskConical size={22} color={C.green} />
        <div className="flex-1">
          <p
            className="text-sm font-bold tracking-widest"
            style={{ color: C.green }}
          >
            DEMO MODE
          </p>
          <p className="text-xs" style={{ color: C.textMuted }}>
            Testovací prostředí · data se neukládají do hry
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting || exiting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: 'transparent',
            color: resetting ? C.textMuted : '#888',
            border: `1px solid #88888830`,
            cursor: resetting ? 'not-allowed' : 'pointer',
          }}
          title="Resetovat demo na výchozí stav"
        >
          <RefreshCw size={12} className={resetting ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={handleExit}
          disabled={exiting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: 'transparent',
            color: exiting ? C.textMuted : C.red,
            border: `1px solid ${exiting ? C.textMuted : C.red}40`,
            cursor: exiting ? 'not-allowed' : 'pointer',
          }}
        >
          <X size={13} />
          {exiting ? 'Zavírám...' : 'Ukončit demo'}
        </button>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {/* ── Herní stav ──────────────────────────────────────────────── */}
        <div>
          <p
            className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: C.textSecondary }}
          >
            Herní stav
          </p>
          <div className="rounded-xl p-4 flex flex-col gap-3" style={cardBase}>
            {/* Agency */}
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: C.textMuted }}>
                Agentura
              </span>
              <span className="text-sm font-semibold">{agencyName || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: C.textMuted }}>
                Ředitel
              </span>
              <span className="text-sm" style={{ color: C.textSecondary }}>
                {bossName || '—'}
              </span>
            </div>
            {/* Currencies */}
            <div
              className="grid grid-cols-4 gap-2 pt-2"
              style={{ borderTop: `1px solid ${C.borderSubtle}` }}
            >
              {[
                { label: 'Peníze', value: currencies.money, color: C.green },
                { label: 'Intel', value: currencies.intel, color: C.blue },
                { label: 'Shadow', value: currencies.shadow, color: C.bm },
                {
                  label: 'Vliv',
                  value: currencies.influence,
                  color: C.divExtraction,
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-bold" style={{ color }}>
                    {value}
                  </span>
                  <span className="text-[10px]" style={{ color: C.textMuted }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            {/* Stats */}
            <div
              className="flex items-center justify-between pt-2"
              style={{ borderTop: `1px solid ${C.borderSubtle}` }}
            >
              <span className="text-xs" style={{ color: C.textMuted }}>
                Mise splněny
              </span>
              <span className="text-sm font-semibold">
                {totalMissionsCompleted}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: C.textMuted }}>
                Aktivní agenti
              </span>
              <span className="text-sm font-semibold">{agentCount}</span>
            </div>
            <div
              className="flex items-center justify-between pt-2"
              style={{ borderTop: `1px solid ${C.borderSubtle}` }}
            >
              <span className="text-xs" style={{ color: C.textMuted }}>
                Rival
              </span>
              <span className="text-sm font-semibold">{rivalName || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: C.textMuted }}>
                Rival aggro
              </span>
              <span className="text-sm font-semibold">
                {rivalAggressionLevel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: C.textMuted }}>
                Aktivní rival op
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: activeRivalOperation ? C.red : C.textMuted }}
              >
                {activeRivalOperation
                  ? activeRivalOperation.eventType
                  : 'Žádná'}
              </span>
            </div>
            {activeRivalOperation && (
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold mt-1"
                style={btn.action(C.yellow)}
                onClick={ensureCounterOpAndNavigate}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert size={13} />
                  <span>Zobrazit Counter-Op v Amsterdamu</span>
                </div>
                <span style={{ color: C.yellow }}>→</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Screeny ─────────────────────────────────────────────────── */}
        <div>
          <p
            className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: C.textSecondary }}
          >
            Screeny
          </p>
          <div className="grid grid-cols-3 gap-2">
            <NavCard icon={Map} label="Mapa" to="/map" />
            <NavCard icon={Target} label="Mise" to="/missions" />
            <NavCard icon={Users} label="Agenti" to="/agents" />
            <NavCard icon={Building2} label="Základna" to="/base" />
            <NavCard icon={Settings} label="Menu" to="/menu" />
          </div>
        </div>

        {/* ── Demo obsah ──────────────────────────────────────────────── */}
        <div>
          <p
            className="text-xs font-medium tracking-widest uppercase mb-3"
            style={{ color: C.textSecondary }}
          >
            Demo obsah
          </p>
          <div className="rounded-xl p-4 flex flex-col gap-2" style={cardBase}>
            {[
              '6 agentů v Londýně (volný, zraněný, na misi, plná výbava, veterán se serií, rank-up ready)',
              '4 agenti v Amsterdamu (specialist zraněný, agent zajat, veterán s výbavou, cestující)',
              'Berlin ve výstavbě',
              'Záchranná mise aktivní (Londýn)',
              'Mise se dokončí za ~30s — spustí modal sbírání',
              'Quick/Flash mise v Amsterdamu (časovač ~3.5 min)',
              'Counter-Op mise v Amsterdamu (rival hrozba: Dezinformace)',
              'Všechny divize odemčeny',
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: C.green }}
                />
                <span className="text-sm" style={{ color: C.textSecondary }}>
                  {line}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Globální události ────────────────────────────────────────── */}
        <WorldEventControls />

        {/* ── Design systém ────────────────────────────────────────────── */}
        <div>
          <button
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm"
            style={cardBase}
            onClick={() => setShowDesign((v) => !v)}
          >
            <span className="font-medium" style={{ color: C.textSecondary }}>
              Design tokeny
            </span>
            <span style={{ color: C.textMuted }}>{showDesign ? '▲' : '▼'}</span>
          </button>

          {showDesign && (
            <div
              className="rounded-xl p-4 mt-2 flex flex-col gap-4"
              style={cardBase}
            >
              {/* Base colors */}
              <div>
                <p className="text-xs mb-2" style={{ color: C.textMuted }}>
                  Základní barvy
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Swatch color={C.green} label={`Primary green ${C.green}`} />
                  <Swatch color={C.bgBase} label={`Background ${C.bgBase}`} />
                  <Swatch color={C.bgSurface} label={`Card ${C.bgSurface}`} />
                  <Swatch
                    color={C.borderDefault}
                    label={`Border ${C.borderDefault}`}
                  />
                  <Swatch
                    color={C.textPrimary}
                    label={`Text primary ${C.textPrimary}`}
                  />
                  <Swatch
                    color={C.textSecondary}
                    label={`Text muted ${C.textSecondary}`}
                  />
                </div>
              </div>

              {/* Division colors */}
              <div>
                <p className="text-xs mb-2" style={{ color: C.textMuted }}>
                  Divize
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(DIVISION_COLOR).map(([div, color]) => (
                    <Swatch key={div} color={color} label={`${div}`} />
                  ))}
                </div>
              </div>

              {/* Status badges */}
              <div>
                <p className="text-xs mb-2" style={{ color: C.textMuted }}>
                  Stav agenta
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(STATUS_COLORS).map((s) => (
                    <StatusBadge key={s} status={s} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
