import { useEffect, useState, useMemo, useCallback } from 'react';
import CityBar from '../components/CityBar';
import CurrenciesBar from '../components/CurrenciesBar';
import {
  C,
  cardBase,
  cardActive,
  btn,
  modalSheet,
  modalOverlay,
} from '../styles/tokens';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  Ghost,
  Link,
  Lock,
  Radio,
  Shield,
  Skull,
  Star,
  TriangleAlert,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMissionStore } from '../store/missionStore';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { db } from '../db/db';
import type { Agent, Mission, ActiveMission } from '../db/schema';
import { REGION_MAP } from '../data/regions';
import { COMPLICATIONS } from '../data/missionTemplates';
import {
  calculateSuccessChance,
  checkAgentEligibility,
  checkTeamEligibility,
  APPROACH_MODS,
  type AgentEligibility,
  type MissionApproach,
} from '../engine/missionResolver';
import type { MissionResult } from '../db/schema';
import type { CompletedMissionResult } from '../store/missionStore';
import { formatDuration } from '../hooks/useMissionTimer';
import { DIVISIONS } from '../data/agentTypes';
import type { AgentRank } from '../data/agentTypes';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';
import type { Equipment } from '../data/equipmentCatalog';

const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  legendary: '#f59e0b',
};

const RANK_LABEL: Record<AgentRank, string> = {
  recruit: 'Rekrut',
  operative: 'Agent',
  specialist: 'Specialista',
  veteran: 'Veterán',
};

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  surveillance: { label: 'Sledování', color: '#4ade80', icon: '👁' },
  cyber: { label: 'Kyber', color: '#60a5fa', icon: '💻' },
  extraction: { label: 'Extrakce', color: '#f97316', icon: '🚁' },
  sabotage: { label: 'Sabotáž', color: '#ef4444', icon: '💥' },
  influence: { label: 'Vliv', color: '#a78bfa', icon: '✦' },
  finance: { label: 'Finance', color: '#facc15', icon: '💰' },
  logistics: { label: 'Logistika', color: '#94a3b8', icon: '📦' },
  blackops: { label: 'Black Ops', color: '#f43f5e', icon: '🎯' },
};

const RESULT_META: Record<
  MissionResult,
  { label: string; color: string; bg: string }
> = {
  success: { label: 'Úspěch', color: '#4ade80', bg: '#0f2e1a' },
  partial: { label: 'Částečně', color: '#facc15', bg: '#2e2800' },
  failure: { label: 'Selhání', color: '#ef4444', bg: '#2e0f0f' },
  catastrophe: { label: 'Katastrofa', color: '#f43f5e', bg: '#3e0a0a' },
};

const STAT_LABELS: Record<string, string> = {
  stealth: 'Stealth',
  combat: 'Combat',
  intel: 'Intel',
  tech: 'Tech',
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function difficultyDots(n: number, color: string) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: i < n ? color : '#777777' }}
        />
      ))}
    </span>
  );
}

function chanceColor(chance: number) {
  if (chance >= 0.75) return '#4ade80';
  if (chance >= 0.5) return '#facc15';
  if (chance >= 0.3) return '#f97316';
  return '#ef4444';
}

function rewardLine(Icon: LucideIcon, iconColor: string, value: number) {
  if (!value) return null;
  const sign = value > 0 ? '+' : '';
  const valueColor = value > 0 ? C.green : C.red;
  return (
    <span className="flex items-center gap-0.5 text-xs">
      <Icon size={10} color={iconColor} />
      <span style={{ color: valueColor }}>
        {sign}
        {value}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────
// Countdown (self-ticking)
// ─────────────────────────────────────────────

function Countdown({ completesAt }: { completesAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((completesAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((completesAt - Date.now()) / 1000));
      setRemaining(r);
    }, 500);
    return () => clearInterval(id);
  }, [completesAt]);

  return <span>{formatDuration(remaining)}</span>;
}

// Flash-specific countdown: blinks red when under 60 seconds
function FlashCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isCritical = remaining <= 60;
  return (
    <span
      style={{
        color: isCritical ? C.red : C.divExtraction,
        fontWeight: 600,
        animation: isCritical
          ? 'flash-blink 0.8s ease-in-out infinite'
          : undefined,
      }}
    >
      {formatDuration(remaining)}
    </span>
  );
}

function ActiveMissionCard({
  active,
  mission,
}: {
  active: ActiveMission;
  mission: Mission;
}) {
  const meta = CATEGORY_META[mission.category] ?? CATEGORY_META.surveillance;
  const total = mission.baseDuration * 1000;
  const elapsed = Date.now() - active.startedAt;
  const progress = Math.min(1, elapsed / total);
  const isComplete = Date.now() >= active.completesAt;

  const [pct, setPct] = useState(progress);
  const [agentDetails, setAgentDetails] = useState<Agent[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setPct(Math.min(1, (Date.now() - active.startedAt) / total));
    }, 500);
    return () => clearInterval(id);
  }, [active.startedAt, total]);

  useEffect(() => {
    db.agents.bulkGet(active.agentIds).then((results) => {
      setAgentDetails(results.filter(Boolean) as Agent[]);
    });
  }, [active.agentIds]);

  // Collect all unique equipment worn by the agents
  const equippedItems = useMemo(() => {
    const ids = agentDetails
      .flatMap((a) => a.equipment.map((s) => s.equipmentId))
      .filter(Boolean) as string[];
    return Array.from(new Set(ids))
      .map((id) => EQUIPMENT_CATALOG.find((e) => e.id === id))
      .filter(Boolean) as Equipment[];
  }, [agentDetails]);

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2" style={cardBase}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: `${meta.color}22` }}
          >
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: '#e8e8e8' }}
            >
              {mission.title}
            </p>
            <p className="text-xs" style={{ color: '#999' }}>
              {meta.label} · {active.agentIds.length} agentů
              {active.approach && active.approach !== 'standard' && (
                <span
                  className="ml-1.5 px-1 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    background:
                      active.approach === 'aggressive'
                        ? '#2a140044'
                        : '#001a2a44',
                    color:
                      active.approach === 'aggressive' ? '#f97316' : '#22d3ee',
                  }}
                >
                  {active.approach === 'aggressive' ? 'Agresivní' : 'Skrytá'}
                </span>
              )}
            </p>
          </div>
        </div>
        <div
          className="text-xs font-mono flex-shrink-0"
          style={{ color: isComplete ? meta.color : '#888' }}
        >
          {isComplete ? (
            'Hotovo'
          ) : (
            <Countdown completesAt={active.completesAt} />
          )}
        </div>
      </div>

      {/* Agent list */}
      {agentDetails.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agentDetails.map((a) => (
            <span
              key={a.id}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: C.bgSurface2,
                color: '#aaa',
              }}
            >
              {a.name}
            </span>
          ))}
        </div>
      )}

      {/* Equipped items */}
      {equippedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {equippedItems.map((eq) => (
            <span
              key={eq.id}
              className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
              style={{
                background: `${RARITY_COLOR[eq.rarity] ?? '#888'}22`,
                color: RARITY_COLOR[eq.rarity] ?? '#888',
              }}
            >
              {eq.name}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: '#777777' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct * 100}%`,
            background: isComplete ? meta.color : '#4a4a4a',
          }}
        />
      </div>

      {/* Success chance */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#888' }}>
          Šance na úspěch
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: chanceColor(active.successChance) }}
        >
          {Math.round(active.successChance * 100)} %
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Available mission card
// ─────────────────────────────────────────────

function MissionCard({
  mission,
  onStart,
  regionAgents,
}: {
  mission: Mission;
  onStart: (m: Mission) => void;
  regionAgents: Agent[];
}) {
  const meta = CATEGORY_META[mission.category] ?? CATEGORY_META.surveillance;
  const isLocked = !!mission.lockedByDivision;
  const eligibleCount = regionAgents.filter(
    (a) =>
      a.status === 'available' && checkAgentEligibility(a, mission).eligible,
  ).length;
  const freeCount = regionAgents.filter((a) => a.status === 'available').length;
  const canStart = !isLocked && eligibleCount > 0;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{ ...cardBase, opacity: isLocked ? 0.6 : 1 }}
    >
      {/* Top row */}
      <div className="flex items-start gap-2">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-0.5"
          style={{ background: `${meta.color}22` }}
        >
          {meta.icon}
        </span>
        <div className="flex-1 min-w-0">
          {/* Rescue badge */}
          {mission.isRescue && (
            <div
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1"
              style={{
                background: '#ef444422',
                color: '#ef4444',
              }}
            >
              🚨 ZÁCHRANNÁ MISE
            </div>
          )}
          <p
            className="text-sm font-medium leading-tight"
            style={{ color: '#e8e8e8' }}
          >
            {mission.title}
          </p>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#999' }}>
            {mission.flavor}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </span>
        {difficultyDots(mission.difficulty, meta.color)}
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: '#888' }}
        >
          <Clock size={11} />
          {formatDuration(mission.baseDuration)}
        </span>
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: '#888' }}
        >
          <Users size={11} />
          {mission.minAgents}–{mission.maxAgents}
        </span>
        {mission.intelCost && mission.intelCost > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5"
            style={{
              background: '#1e3a5f',
              color: '#60a5fa',
            }}
          >
            <Eye size={10} />
            {mission.intelCost}
          </span>
        )}
        {(mission.chainStep || mission.chainNextTargetId) && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-1"
            style={{
              background: '#2a200a',
              color: '#facc15',
            }}
          >
            <Link size={10} />
            {mission.chainStep && mission.chainTotal
              ? `Část ${mission.chainStep}/${mission.chainTotal}`
              : 'pokračování'}
          </span>
        )}
      </div>

      {/* Rewards */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {rewardLine(Coins, C.green, mission.rewards.money)}
        {rewardLine(Eye, C.blue, mission.rewards.intel)}
        {rewardLine(Ghost, C.bm, mission.rewards.shadow)}
        {rewardLine(Radio, C.divExtraction, mission.rewards.influence)}
        {rewardLine(Star, C.yellow, mission.rewards.xp)}
      </div>

      {/* Requirements */}
      {(mission.requiredDivisions?.length || mission.minStats) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {mission.requiredDivisions?.map((div) => {
            const divInfo = DIVISIONS.find((d) => d.id === div);
            return (
              <span
                key={div}
                className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{
                  background: `${divInfo?.color ?? '#4ade80'}18`,
                  color: divInfo?.color ?? '#4ade80',
                }}
              >
                🏢 {divInfo?.name ?? div}
              </span>
            );
          })}
          {mission.minStats &&
            Object.entries(mission.minStats).map(([stat, val]) => (
              <span
                key={stat}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: C.bgSurface2,
                  color: C.textMuted,
                }}
              >
                {STAT_LABELS[stat] ?? stat} ≥ {val}
              </span>
            ))}
          <span
            className="text-xs ml-auto"
            style={{ color: canStart ? '#4ade80' : '#888' }}
          >
            {eligibleCount}/{freeCount} kompetentních
          </span>
        </div>
      )}

      {/* Complication warning */}
      {mission.complicationId &&
        (() => {
          const comp = COMPLICATIONS.find(
            (c) => c.id === mission.complicationId,
          );
          return comp ? (
            <div
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
              style={{
                background: '#2a1a00',
                color: '#f97316',
              }}
            >
              <TriangleAlert size={11} />
              <span className="font-medium">Komplikace:</span>{' '}
              {comp.description}
            </div>
          ) : null;
        })()}

      {/* Flash expiry — replaces normal expiry row for flash missions */}
      {mission.isFlash && mission.expiresAt && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: C.yellow }}
        >
          <Zap size={11} />
          Okno zavírá za <FlashCountdown expiresAt={mission.expiresAt} />
        </div>
      )}

      {/* Normal expiry warning (non-flash) */}
      {!mission.isFlash && mission.expiresAt && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: '#f97316' }}
        >
          <AlertTriangle size={11} />
          Vyprší za <Countdown completesAt={mission.expiresAt} />
        </div>
      )}

      {/* Start button */}
      {isLocked ? (
        <div
          className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
          style={{ background: C.bgSurface2, color: '#888' }}
        >
          <Lock size={12} />
          Vyžaduje divizi{' '}
          <span style={{ color: '#aaa', fontWeight: 600 }}>
            {DIVISIONS.find((d) => d.id === mission.lockedByDivision)?.name ??
              mission.lockedByDivision}
          </span>
        </div>
      ) : (
        <button
          onClick={() => onStart(mission)}
          disabled={!canStart}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: canStart ? meta.color : C.bgSurface2,
            color: canStart ? '#141414' : C.textDisabled,
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          {canStart ? (
            <>
              Zahájit <ChevronRight size={14} />
            </>
          ) : freeCount > 0 ? (
            'Žádní kompetentní agenti'
          ) : (
            'Žádní volní agenti'
          )}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Agent row in selector
// ─────────────────────────────────────────────

function AgentRow({
  agent,
  selected,
  disabled,
  onToggle,
  eligibility,
}: {
  agent: Agent;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  eligibility: AgentEligibility;
}) {
  const divInfo = DIVISIONS.find((d) => d.id === agent.division);
  const eligColor = eligibility.eligible
    ? '#4ade80'
    : eligibility.missingDivision && eligibility.missingStats.length === 0
      ? '#f97316'
      : '#ef4444';

  return (
    <button
      onClick={onToggle}
      disabled={disabled && !selected}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left"
      style={{
        ...(selected ? cardActive : cardBase),
        opacity: disabled && !selected ? 0.4 : 1,
      }}
    >
      {/* Eligibility indicator */}
      <div
        className="w-1.5 self-stretch rounded-full flex-shrink-0"
        style={{ background: eligColor }}
      />

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: selected ? `${C.green}20` : C.bgSurface2,
          color: selected ? C.green : C.textMuted,
        }}
      >
        {agent.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: selected ? '#4ade80' : '#e8e8e8' }}
        >
          {agent.name}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-xs px-1 py-0.5 rounded"
            style={{
              background: `${divInfo?.color ?? '#4ade80'}18`,
              color: divInfo?.color ?? '#4ade80',
            }}
          >
            {divInfo?.name ?? agent.division}
          </span>
          {!eligibility.eligible && (
            <span className="text-xs" style={{ color: eligColor }}>
              {eligibility.missingDivision ? '✗ divize' : ''}
              {eligibility.missingStats
                .map(
                  (s) =>
                    `✗ ${STAT_LABELS[s.stat] ?? s.stat} ${s.actual}/${s.required}`,
                )
                .join(' ')}
            </span>
          )}
        </div>
      </div>
      <div
        className="grid grid-cols-4 gap-1 text-xs flex-shrink-0"
        style={{ color: '#999' }}
      >
        {(['stealth', 'combat', 'intel', 'tech'] as const).map((s) => (
          <div key={s} className="flex flex-col items-center">
            <span className="text-xs font-semibold" style={{ color: '#aaa' }}>
              {agent.stats[s]}
            </span>
            <span className="text-[9px] uppercase tracking-wide">
              {s.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// Agent selector modal
// ─────────────────────────────────────────────

function AgentSelectorModal({
  mission,
  onConfirm,
  onClose,
}: {
  mission: Mission;
  onConfirm: (agents: Agent[], approach: MissionApproach) => void;
  onClose: () => void;
}) {
  const [regionAgents, setRegionAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [regionAlertLevel, setRegionAlertLevel] = useState(0);
  const [approach, setApproach] = useState<MissionApproach>('standard');
  const currencies = useGameStore((s) => s.currencies);

  useEffect(() => {
    db.regions.get(mission.regionId).then((r) => {
      setRegionAlertLevel(r?.alertLevel ?? 0);
    });
  }, [mission.regionId]);

  useEffect(() => {
    // Load only agents stationed in this mission's city
    db.agents
      .where('status')
      .equals('available')
      .filter((a) => a.safeHouseId === mission.regionId)
      .toArray()
      .then((agents) => {
        // Sort: eligible agents first
        const sorted = [...agents].sort((a, b) => {
          const ea = checkAgentEligibility(a, mission).eligible ? 0 : 1;
          const eb = checkAgentEligibility(b, mission).eligible ? 0 : 1;
          return ea - eb;
        });
        setRegionAgents(sorted);
      });
  }, [mission]);

  const selectedAgents = useMemo(
    () => regionAgents.filter((a) => selected.has(a.id)),
    [regionAgents, selected],
  );

  const successChance = useMemo(() => {
    if (selectedAgents.length === 0) return null;
    return calculateSuccessChance(
      selectedAgents,
      mission,
      regionAlertLevel,
      approach,
    );
  }, [selectedAgents, mission, regionAlertLevel, approach]);

  const teamEligible = useMemo(
    () => checkTeamEligibility(selectedAgents, mission),
    [selectedAgents, mission],
  );

  const hasEnoughIntel = currencies.intel >= (mission.intelCost ?? 0);

  const canDispatch =
    selectedAgents.length >= mission.minAgents &&
    selectedAgents.length <= mission.maxAgents &&
    teamEligible &&
    hasEnoughIntel;

  const toggleAgent = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else if (next.size < mission.maxAgents) {
          next.add(id);
        }
        return next;
      });
    },
    [mission.maxAgents],
  );

  const meta = CATEGORY_META[mission.category] ?? CATEGORY_META.surveillance;
  const cityName = REGION_MAP.get(mission.regionId)?.name ?? mission.regionId;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={modalOverlay}
    >
      <div
        className="rounded-t-2xl flex flex-col max-h-[85vh]"
        style={modalSheet}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#999' }}
          />
        </div>

        {/* Header */}
        <div className="px-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span style={{ color: '#666666' }}>·</span>
                <span className="text-xs" style={{ color: '#999' }}>
                  {cityName}
                </span>
              </div>
              <h3
                className="text-base font-bold leading-tight"
                style={{ color: '#e8e8e8' }}
              >
                {mission.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg flex-shrink-0"
              style={{ color: '#888' }}
            >
              <XCircle size={18} />
            </button>
          </div>

          {/* Requirements row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {mission.requiredDivisions?.map((div) => {
              const divInfo = DIVISIONS.find((d) => d.id === div);
              return (
                <span
                  key={div}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: `${divInfo?.color ?? '#4ade80'}18`,
                    color: divInfo?.color ?? '#4ade80',
                  }}
                >
                  {divInfo?.name ?? div}
                </span>
              );
            })}
            {mission.minStats &&
              Object.entries(mission.minStats).map(([stat, val]) => (
                <span
                  key={stat}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: '#1e2a1e',
                    color: '#a3c4a3',
                  }}
                >
                  {STAT_LABELS[stat] ?? stat} ≥ {val}
                </span>
              ))}
            <div className="ml-auto flex items-center gap-1.5">
              <Users
                size={11}
                style={{
                  color:
                    selected.size >= mission.minAgents ? '#4ade80' : '#888',
                }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color:
                    selected.size >= mission.minAgents ? '#4ade80' : '#888',
                }}
              >
                {selected.size}/{mission.minAgents}–{mission.maxAgents}
              </span>
            </div>
          </div>

          {/* Team eligibility warning */}
          {!teamEligible && selected.size > 0 && (
            <div
              className="flex items-center gap-1 mt-2"
              style={{ color: '#f97316' }}
            >
              <AlertTriangle size={11} />
              <span className="text-xs">
                Potřeba specialista z požadované divize
              </span>
            </div>
          )}
        </div>

        {/* Approach selector */}
        <div className="px-4 py-3">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: '#888' }}
          >
            Taktika
          </p>
          <div className="flex gap-2">
            {(['standard', 'aggressive', 'covert'] as MissionApproach[]).map(
              (ap) => {
                const mods = APPROACH_MODS[ap];
                const isSelected = approach === ap;
                const label =
                  ap === 'standard'
                    ? 'Standardní'
                    : ap === 'aggressive'
                      ? 'Agresivní'
                      : 'Skrytá';
                const activeColor =
                  ap === 'standard'
                    ? '#999'
                    : ap === 'aggressive'
                      ? '#f97316'
                      : '#22d3ee';
                const bgColor =
                  ap === 'standard'
                    ? '#2a2a2a'
                    : ap === 'aggressive'
                      ? '#2a1400'
                      : '#001a2a';
                const successPct = Math.round((mods.successMult - 1) * 100);
                const durationPct = Math.round((mods.durationMult - 1) * 100);
                const alertPct = Math.round((mods.alertMult - 1) * 100);
                const fmt = (n: number) =>
                  n === 0 ? '±0' : n > 0 ? `+${n}` : `${n}`;
                const statColor = (n: number, lowerBetter = false) => {
                  if (n === 0) return '#888';
                  return (lowerBetter ? n < 0 : n > 0) ? '#4ade80' : '#ef4444';
                };
                return (
                  <button
                    key={ap}
                    onClick={() => setApproach(ap)}
                    className="flex-1 flex flex-col gap-2 px-2.5 py-2.5 rounded-xl transition-all"
                    style={{ background: isSelected ? bgColor : C.bgBase }}
                  >
                    <span
                      className="font-semibold text-xs"
                      style={{ color: isSelected ? activeColor : C.textMuted }}
                    >
                      {label}
                    </span>
                    <div className="flex flex-col gap-0.5 w-full">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[9px] uppercase tracking-wide"
                          style={{ color: '#888' }}
                        >
                          Úspěch
                        </span>
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: statColor(successPct) }}
                        >
                          {fmt(successPct)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[9px] uppercase tracking-wide"
                          style={{ color: '#888' }}
                        >
                          Čas
                        </span>
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: statColor(durationPct, true) }}
                        >
                          {fmt(durationPct)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[9px] uppercase tracking-wide"
                          style={{ color: '#888' }}
                        >
                          Alert
                        </span>
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: statColor(alertPct, true) }}
                        >
                          {fmt(alertPct)}%
                        </span>
                      </div>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {regionAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Users size={32} style={{ color: '#999' }} />
              <p className="text-sm" style={{ color: '#888' }}>
                Žádní volní agenti v {cityName}
              </p>
            </div>
          ) : (
            regionAgents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                selected={selected.has(agent.id)}
                disabled={selected.size >= mission.maxAgents}
                onToggle={() => toggleAgent(agent.id)}
                eligibility={checkAgentEligibility(agent, mission)}
              />
            ))
          )}
        </div>

        {/* Bottom action */}
        <div className="px-4 pb-6 pt-3">
          {successChance !== null && (
            <div
              className="rounded-xl p-2.5 mb-3 flex items-center justify-between"
              style={{ background: C.bgSurface2 }}
            >
              <span className="text-xs" style={{ color: '#888' }}>
                Odhadovaný výsledek
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-24 rounded-full overflow-hidden"
                  style={{ background: '#777777' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${successChance * 100}%`,
                      background: chanceColor(successChance),
                    }}
                  />
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: chanceColor(successChance) }}
                >
                  {Math.round(successChance * 100)} %
                </span>
              </div>
            </div>
          )}

          <button
            onClick={() => canDispatch && onConfirm(selectedAgents, approach)}
            disabled={!canDispatch}
            className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: canDispatch ? meta.color : C.bgSurface2,
              color: canDispatch ? '#141414' : C.textDisabled,
              cursor: canDispatch ? 'pointer' : 'not-allowed',
            }}
          >
            <Zap size={16} />
            Zahájit operaci
          </button>
          {mission.intelCost && mission.intelCost > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Eye
                size={12}
                style={{ color: hasEnoughIntel ? '#60a5fa' : '#ef4444' }}
              />
              <span
                className="text-xs"
                style={{ color: hasEnoughIntel ? '#60a5fa' : '#ef4444' }}
              >
                {hasEnoughIntel
                  ? `Vyžaduje ${mission.intelCost} intel`
                  : `Nedostatek intelu — potřeba ${mission.intelCost}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Result modal
// ─────────────────────────────────────────────

function ResultModal({
  result,
  onDismiss,
}: {
  result: CompletedMissionResult;
  onDismiss: () => void;
}) {
  const rm = RESULT_META[result.result];
  const meta =
    CATEGORY_META[result.mission.category] ?? CATEGORY_META.surveillance;

  const ResultIcon = () => {
    switch (result.result) {
      case 'success':
        return <CheckCircle size={40} color={rm.color} />;
      case 'partial':
        return <AlertTriangle size={40} color={rm.color} />;
      case 'failure':
        return <XCircle size={40} color={rm.color} />;
      case 'catastrophe':
        return <Skull size={40} color={rm.color} />;
    }
  };

  const hasPositive =
    result.rewards.money > 0 ||
    result.rewards.intel > 0 ||
    result.rewards.shadow > 0 ||
    result.rewards.influence > 0;
  const hasNegative =
    result.rewards.money < 0 ||
    result.rewards.intel < 0 ||
    result.rewards.shadow < 0 ||
    result.rewards.influence < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={modalOverlay}
    >
      <div
        className="w-full rounded-t-2xl flex flex-col max-h-[80vh] overflow-y-auto"
        style={modalSheet}
      >
        <div className="p-5 flex flex-col gap-4">
          {/* Result hero */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: rm.bg }}
            >
              <ResultIcon />
            </div>
            <h2
              className="text-xl font-bold tracking-tight"
              style={{ color: rm.color }}
            >
              {rm.label}
            </h2>
            <p className="text-sm text-center" style={{ color: '#999' }}>
              {result.mission.title}
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {meta.label}
              </span>
              {difficultyDots(result.mission.difficulty, meta.color)}
            </div>
            {result.mission.flavor && (
              <p
                className="text-xs text-center italic px-2"
                style={{ color: '#666' }}
              >
                {result.mission.flavor}
              </p>
            )}
          </div>

          {/* Rewards */}
          {(hasPositive || hasNegative) && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: C.bgSurface2 }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Výsledek operace
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    Icon: Coins,
                    color: C.green,
                    key: 'money' as const,
                    label: 'Peníze',
                  },
                  {
                    Icon: Eye,
                    color: C.blue,
                    key: 'intel' as const,
                    label: 'Intel',
                  },
                  {
                    Icon: Ghost,
                    color: C.bm,
                    key: 'shadow' as const,
                    label: 'Shadow',
                  },
                  {
                    Icon: Radio,
                    color: C.divExtraction,
                    key: 'influence' as const,
                    label: 'Vliv',
                  },
                  {
                    Icon: Star,
                    color: C.yellow,
                    key: 'xp' as const,
                    label: 'XP',
                  },
                ].map(({ Icon, color: iconColor, key, label }) => {
                  const val = result.rewards[key];
                  if (!val) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon size={13} color={iconColor} />
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>
                          {label}
                        </p>
                        <p
                          className="text-sm font-bold"
                          style={{ color: val > 0 ? '#4ade80' : '#ef4444' }}
                        >
                          {val > 0 ? '+' : ''}
                          {val}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alert penalty */}
          {result.alertGain > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: C.bgSurface2 }}
            >
              <Zap size={14} color="#f97316" />
              <span className="text-xs" style={{ color: '#888' }}>
                Alert Level +{result.alertGain.toFixed(1)} v regionu
              </span>
            </div>
          )}

          {/* Rank-up notifications */}
          {result.rankedUpAgents?.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#1a1500' }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: '#facc15' }}
              >
                ⭐ Postup v hodnosti
              </p>
              {result.rankedUpAgents.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: '#e8e8e8' }}
                  >
                    {a.name}
                  </span>
                  <span className="text-xs" style={{ color: '#facc15' }}>
                    →{' '}
                    {RANK_LABEL[a.newRank as keyof typeof RANK_LABEL] ??
                      a.newRank}
                  </span>
                  {a.nickname && (
                    <span className="text-xs italic" style={{ color: '#aaa' }}>
                      {a.nickname}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Affected agents — per-agent injury breakdown */}
          {result.affectedAgentIds.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#2e0f0f' }}
            >
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
                {result.result === 'catastrophe'
                  ? '⚠ Agent zajat'
                  : '⚠ Agenti zranění'}
              </p>
              {result.injuredAgents.length > 0 ? (
                result.injuredAgents.map((ia) => {
                  const severityColor =
                    ia.severity === 'critical'
                      ? '#ef4444'
                      : ia.severity === 'serious'
                        ? '#f97316'
                        : '#facc15';
                  const severityLabel =
                    ia.severity === 'critical'
                      ? 'Kritické'
                      : ia.severity === 'serious'
                        ? 'Vážné'
                        : 'Lehké';
                  const healsIn = Math.ceil((ia.healsAt - Date.now()) / 60000);
                  return (
                    <div key={ia.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: '#e8e8e8' }}>
                          {ia.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: severityColor }}
                          >
                            {severityLabel}
                          </span>
                          <span className="text-xs" style={{ color: '#888' }}>
                            ~{healsIn} min
                          </span>
                        </div>
                      </div>
                      {ia.description && (
                        <p className="text-xs italic" style={{ color: '#888' }}>
                          {ia.description}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs" style={{ color: '#888' }}>
                  {result.affectedAgentIds.length} agent(ů) zajat(o).
                </p>
              )}
            </div>
          )}

          {/* Killed agent */}
          {result.killedAgent && (
            <div
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: '#1a0a0a' }}
            >
              <Skull size={16} color="#ef4444" />
              <div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: '#ef4444' }}
                >
                  Agent zabit
                </p>
                <p className="text-sm" style={{ color: '#e8e8e8' }}>
                  {result.killedAgent.name}
                </p>
              </div>
            </div>
          )}

          {/* Lost equipment (partial rescue) */}
          {result.lostEquipment && result.lostEquipment.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#1a1208' }}
            >
              <p className="text-xs font-medium" style={{ color: '#f97316' }}>
                Ztracené vybavení
              </p>
              {result.lostEquipment.map((eq) => (
                <div key={eq.id} className="flex items-center gap-2">
                  <span
                    className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: '#f97316' }}
                  />
                  <span className="text-sm" style={{ color: '#e8e8e8' }}>
                    {eq.name}
                  </span>
                </div>
              ))}
              <p className="text-xs" style={{ color: '#888' }}>
                Prodáno za 30 % hodnoty.
              </p>
            </div>
          )}

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full py-3.5 rounded-xl font-bold text-sm"
            style={{ background: rm.color, color: '#141414' }}
          >
            Potvrdit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function MissionsScreen() {
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);

  // Current region = uiStore selection or start city
  const [, setOwnedRegions] = useState<Array<{ id: string; name: string }>>([]);
  const currentRegionId = selectedRegionId ?? startCityId;

  const availableMissions = useMissionStore((s) => s.availableMissions);
  const activeMissions = useMissionStore((s) => s.activeMissions);
  const completedQueue = useMissionStore((s) => s.completedQueue);
  const loading = useMissionStore((s) => s.loading);
  const loadMissions = useMissionStore((s) => s.loadMissions);
  const loadActiveMissions = useMissionStore((s) => s.loadActiveMissions);
  const tickMissions = useMissionStore((s) => s.tickMissions);
  const checkExpirations = useMissionStore((s) => s.checkExpirations);
  const dispatch = useMissionStore((s) => s.dispatch);
  const dismissResult = useMissionStore((s) => s.dismissResult);

  const [activeMissionData, setActiveMissionData] = useState<
    Map<string, Mission>
  >(new Map());
  const [regionAgents, setRegionAgents] = useState<Agent[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [dispatching, setDispatching] = useState(false);

  // Timer is now mounted globally in GameShell (App.tsx)

  // Load owned regions for the picker
  useEffect(() => {
    db.regions
      .where('owned')
      .equals(1)
      .toArray()
      .then((rs) => {
        setOwnedRegions(
          rs.map((r) => ({
            id: r.id,
            name: REGION_MAP.get(r.id)?.name ?? r.id,
          })),
        );
      });
  }, [activeMissions, completedQueue]);

  // Load missions on mount / when region changes
  useEffect(() => {
    if (!currentRegionId) return;
    // Load active missions then immediately tick so any mission that completed
    // while the app was closed gets collected without waiting for the 1-s timer.
    loadActiveMissions().then(() => tickMissions());
    loadMissions(currentRegionId);
    checkExpirations(currentRegionId);

    const refresh = setInterval(
      () => checkExpirations(currentRegionId),
      60_000,
    );
    return () => clearInterval(refresh);
  }, [
    currentRegionId,
    loadMissions,
    loadActiveMissions,
    tickMissions,
    checkExpirations,
  ]);

  // Load mission data for active missions
  useEffect(() => {
    if (activeMissions.length === 0) return;
    const ids = activeMissions.map((a) => a.missionId);
    db.missions.bulkGet(ids).then((ms) => {
      const map = new Map<string, Mission>();
      ms.forEach((m) => {
        if (m) map.set(m.id, m);
      });
      setActiveMissionData(map);
    });
  }, [activeMissions]);

  // Count free agents in the current region
  useEffect(() => {
    if (!currentRegionId) return;
    db.agents
      .where('status')
      .equals('available')
      .filter((a) => a.safeHouseId === currentRegionId)
      .toArray()
      .then(setRegionAgents);
  }, [currentRegionId, activeMissions, completedQueue]);

  // Handle dispatch
  async function handleDispatch(
    agents: Agent[],
    approach: MissionApproach = 'standard',
  ) {
    if (!selectedMission || dispatching) return;
    setDispatching(true);
    setSelectedMission(null);
    try {
      const equippedIds = agents.flatMap((a) =>
        a.equipment.map((s) => s.equipmentId).filter(Boolean),
      ) as string[];
      await dispatch(selectedMission, agents, equippedIds, approach);
      // Refresh region agent list
      if (currentRegionId) {
        db.agents
          .where('status')
          .equals('available')
          .filter((a) => a.safeHouseId === currentRegionId)
          .toArray()
          .then(setRegionAgents);
      }
    } finally {
      setDispatching(false);
    }
  }

  // First pending result
  const pendingResult = completedQueue[0] ?? null;

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <h1 className="text-lg font-bold tracking-tight mb-3">Operace</h1>

        {/* Currencies */}
        <div className="mb-3">
          <CurrenciesBar />
        </div>

        <CityBar />
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5">
        {/* ── Active missions ─────────────── */}
        {activeMissions.some((am) => {
          const m = activeMissionData.get(am.missionId);
          return m?.regionId === currentRegionId;
        }) && (
          <section>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-2"
              style={{ color: '#888' }}
            >
              Probíhající (
              {
                activeMissions.filter(
                  (am) =>
                    activeMissionData.get(am.missionId)?.regionId ===
                    currentRegionId,
                ).length
              }
              )
            </p>
            <div className="flex flex-col gap-2">
              {activeMissions.map((am) => {
                const m = activeMissionData.get(am.missionId);
                if (!m || m.regionId !== currentRegionId) return null;
                return (
                  <ActiveMissionCard key={am.id} active={am} mission={m} />
                );
              })}
            </div>
          </section>
        )}

        {/* ── Available missions ──────────── */}
        <section>
          <p
            className="text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: '#888' }}
          >
            Dostupné mise
          </p>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl h-36 animate-pulse"
                  style={{ background: C.bgSurface }}
                />
              ))}
            </div>
          ) : availableMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Shield size={40} style={{ color: '#777777' }} />
              <p className="text-sm" style={{ color: '#888' }}>
                Momentálně žádné mise
              </p>
              <p className="text-xs text-center" style={{ color: '#777' }}>
                Mise se obnoví automaticky.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {availableMissions.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  onStart={setSelectedMission}
                  regionAgents={regionAgents}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Agent selector modal ─────────── */}
      {selectedMission && (
        <AgentSelectorModal
          mission={selectedMission}
          onConfirm={handleDispatch}
          onClose={() => setSelectedMission(null)}
        />
      )}

      {/* ── Mission result modal ─────────── */}
      {pendingResult && (
        <ResultModal
          result={pendingResult}
          onDismiss={() => {
            dismissResult(pendingResult.activeMission.id);
            // Refresh after collecting
            if (currentRegionId) {
              loadMissions(currentRegionId);
              checkExpirations(currentRegionId);
              db.agents
                .where('status')
                .equals('available')
                .filter((a) => a.safeHouseId === currentRegionId)
                .toArray()
                .then(setRegionAgents);
            }
          }}
        />
      )}
    </div>
  );
}
