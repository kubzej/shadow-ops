import { useEffect, useState, useMemo, useCallback } from 'react';
import CityBar from '../components/CityBar';
import CurrenciesBar from '../components/CurrenciesBar';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Shield,
  Skull,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { useMissionStore } from '../store/missionStore';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { db } from '../db/db';
import type { Agent, Mission, ActiveMission } from '../db/schema';
import { REGION_MAP } from '../data/regions';
import {
  calculateSuccessChance,
  checkAgentEligibility,
  checkTeamEligibility,
  type AgentEligibility,
} from '../engine/missionResolver';
import type { MissionResult } from '../engine/missionResolver';
import type { CompletedMissionResult } from '../store/missionStore';
import { formatDuration } from '../hooks/useMissionTimer';
import { DIVISIONS } from '../data/agentTypes';
import type { AgentRank } from '../data/agentTypes';

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
          style={{ background: i < n ? color : '#2a2a2a' }}
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

function rewardLine(icon: string, iconColor: string, value: number) {
  if (!value) return null;
  const sign = value > 0 ? '+' : '';
  const valueColor = value > 0 ? '#4ade80' : '#ef4444';
  return (
    <span key={icon} className="flex items-center gap-0.5 text-xs">
      <span style={{ color: iconColor }}>{icon}</span>
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

// ─────────────────────────────────────────────
// Active mission card
// ─────────────────────────────────────────────

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
  useEffect(() => {
    const id = setInterval(() => {
      setPct(Math.min(1, (Date.now() - active.startedAt) / total));
    }, 500);
    return () => clearInterval(id);
  }, [active.startedAt, total]);

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: '#111', border: `1px solid ${meta.color}33` }}
    >
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
            <p className="text-xs" style={{ color: '#666' }}>
              {meta.label} · {active.agentIds.length} agentů
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

      {/* Progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: '#2a2a2a' }}
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
        <span className="text-xs" style={{ color: '#555' }}>
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
  const eligibleCount = regionAgents.filter(
    (a) =>
      a.status === 'available' && checkAgentEligibility(a, mission).eligible,
  ).length;
  const freeCount = regionAgents.filter((a) => a.status === 'available').length;
  const canStart = eligibleCount > 0;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{ background: '#111', border: '1px solid #2a2a2a' }}
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
          <p
            className="text-sm font-medium leading-tight"
            style={{ color: '#e8e8e8' }}
          >
            {mission.title}
          </p>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#666' }}>
            {mission.flavor}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3">
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </span>
        {difficultyDots(mission.difficulty, meta.color)}
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: '#555' }}
        >
          <Clock size={11} />
          {formatDuration(mission.baseDuration)}
        </span>
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: '#555' }}
        >
          <Users size={11} />
          {mission.minAgents}–{mission.maxAgents}
        </span>
      </div>

      {/* Rewards */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {rewardLine('$', '#4ade80', mission.rewards.money)}
        {rewardLine('◈', '#60a5fa', mission.rewards.intel)}
        {rewardLine('◆', '#a78bfa', mission.rewards.shadow)}
        {rewardLine('✦', '#f97316', mission.rewards.influence)}
        {rewardLine('⭐', '#facc15', mission.rewards.xp)}
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
                  border: `1px solid ${divInfo?.color ?? '#4ade80'}44`,
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
                  background: '#1a1a1a',
                  color: '#888',
                  border: '1px solid #2a2a2a',
                }}
              >
                {STAT_LABELS[stat] ?? stat} ≥ {val}
              </span>
            ))}
          <span
            className="text-xs ml-auto"
            style={{ color: canStart ? '#4ade80' : '#555' }}
          >
            {eligibleCount}/{freeCount} kompetentních
          </span>
        </div>
      )}

      {/* Expiry warning */}
      {mission.expiresAt && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: '#f97316' }}
        >
          <AlertTriangle size={11} />
          Vyprší za <Countdown completesAt={mission.expiresAt} />
        </div>
      )}

      {/* Start button */}
      <button
        onClick={() => onStart(mission)}
        disabled={!canStart}
        className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
        style={{
          background: canStart ? meta.color : '#1a1a1a',
          color: canStart ? '#0a0a0a' : '#444',
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
        background: selected ? '#1a2e1a' : '#111',
        border: `1px solid ${selected ? '#4ade80' : '#2a2a2a'}`,
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
          background: selected ? '#4ade8033' : '#1a1a1a',
          color: selected ? '#4ade80' : '#888',
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
        style={{ color: '#666' }}
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
  onConfirm: (agents: Agent[]) => void;
  onClose: () => void;
}) {
  const [regionAgents, setRegionAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [regionAlertLevel, setRegionAlertLevel] = useState(0);

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
      [],
      regionAlertLevel,
    );
  }, [selectedAgents, mission, regionAlertLevel]);

  const teamEligible = useMemo(
    () => checkTeamEligibility(selectedAgents, mission),
    [selectedAgents, mission],
  );

  const canDispatch =
    selectedAgents.length >= mission.minAgents &&
    selectedAgents.length <= mission.maxAgents &&
    teamEligible;

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
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="rounded-t-2xl flex flex-col max-h-[85vh]"
        style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#333' }}
          />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b" style={{ borderColor: '#1a1a1a' }}>
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-xs font-medium tracking-widest uppercase mb-0.5"
                style={{ color: meta.color }}
              >
                {meta.label} · 📍 {cityName}
              </p>
              <h3 className="text-base font-bold" style={{ color: '#e8e8e8' }}>
                {mission.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg"
              style={{ color: '#555' }}
            >
              <XCircle size={20} />
            </button>
          </div>

          {/* Requirements row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {mission.requiredDivisions?.map((div) => {
              const divInfo = DIVISIONS.find((d) => d.id === div);
              return (
                <span
                  key={div}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: `${divInfo?.color ?? '#4ade80'}18`,
                    color: divInfo?.color ?? '#4ade80',
                    border: `1px solid ${divInfo?.color ?? '#4ade80'}44`,
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
                    background: '#1a1a1a',
                    color: '#888',
                    border: '1px solid #2a2a2a',
                  }}
                >
                  {STAT_LABELS[stat] ?? stat} ≥ {val}
                </span>
              ))}
            <span className="text-xs ml-auto" style={{ color: '#666' }}>
              Agentů:{' '}
              <span
                style={{
                  color:
                    selected.size >= mission.minAgents ? '#4ade80' : '#aaa',
                }}
              >
                {selected.size}
              </span>
              /{mission.minAgents}–{mission.maxAgents}
            </span>
          </div>

          {/* Success chance preview */}
          {successChance !== null && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs" style={{ color: '#666' }}>
                Šance:
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: chanceColor(successChance) }}
              >
                {Math.round(successChance * 100)} %
              </span>
              {!teamEligible && selected.size > 0 && (
                <span
                  className="text-xs flex items-center gap-1 ml-2"
                  style={{ color: '#f97316' }}
                >
                  <AlertTriangle size={11} />
                  Potřeba specialista z požadované divize
                </span>
              )}
            </div>
          )}
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {regionAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Users size={32} style={{ color: '#333' }} />
              <p className="text-sm" style={{ color: '#555' }}>
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
        <div
          className="px-4 pb-6 pt-3"
          style={{ borderTop: '1px solid #1a1a1a' }}
        >
          {successChance !== null && (
            <div
              className="rounded-xl p-2.5 mb-3 flex items-center justify-between"
              style={{ background: '#1a1a1a' }}
            >
              <span className="text-xs" style={{ color: '#555' }}>
                Odhadovaný výsledek
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-24 rounded-full overflow-hidden"
                  style={{ background: '#2a2a2a' }}
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
            onClick={() => canDispatch && onConfirm(selectedAgents)}
            disabled={!canDispatch}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            style={{
              background: canDispatch ? meta.color : '#1a1a1a',
              color: canDispatch ? '#0a0a0a' : '#444',
              cursor: canDispatch ? 'pointer' : 'not-allowed',
            }}
          >
            <Shield size={16} />
            Nasadit agenty
          </button>
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
      style={{ background: 'rgba(0,0,0,0.80)' }}
    >
      <div
        className="w-full rounded-t-2xl flex flex-col max-h-[80vh] overflow-y-auto"
        style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
      >
        {/* Color band */}
        <div className="h-1.5 rounded-t-2xl" style={{ background: rm.color }} />

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
            <p className="text-sm text-center" style={{ color: '#666' }}>
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
          </div>

          {/* Rewards */}
          {(hasPositive || hasNegative) && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#1a1a1a' }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: '#555' }}
              >
                Výsledek operace
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    icon: '$',
                    color: '#4ade80',
                    key: 'money' as const,
                    label: 'Peníze',
                  },
                  {
                    icon: '◈',
                    color: '#60a5fa',
                    key: 'intel' as const,
                    label: 'Intel',
                  },
                  {
                    icon: '◆',
                    color: '#a78bfa',
                    key: 'shadow' as const,
                    label: 'Shadow',
                  },
                  {
                    icon: '✦',
                    color: '#f97316',
                    key: 'influence' as const,
                    label: 'Vliv',
                  },
                  {
                    icon: '⭐',
                    color: '#facc15',
                    key: 'xp' as const,
                    label: 'XP',
                  },
                ].map(({ icon, color: iconColor, key, label }) => {
                  const val = result.rewards[key];
                  if (!val) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span style={{ color: iconColor }}>{icon}</span>
                      <div>
                        <p className="text-xs" style={{ color: '#555' }}>
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
              style={{ background: '#1a1a1a' }}
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
              style={{ background: '#1a1500', border: '1px solid #facc1544' }}
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
                </div>
              ))}
            </div>
          )}

          {/* Affected agents */}
          {result.affectedAgentIds.length > 0 && (
            <div
              className="rounded-xl p-3"
              style={{ background: '#2e0f0f', border: '1px solid #ef444433' }}
            >
              <p
                className="text-xs font-medium mb-1"
                style={{ color: '#ef4444' }}
              >
                {result.result === 'catastrophe'
                  ? '⚠ Agent zajat'
                  : '⚠ Agenti zranění'}
              </p>
              <p className="text-xs" style={{ color: '#888' }}>
                {result.affectedAgentIds.length} agent(ů) vyžaduje ošetření.
              </p>
            </div>
          )}

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full py-3.5 rounded-xl font-bold text-sm"
            style={{ background: rm.color, color: '#0a0a0a' }}
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
    loadActiveMissions();
    loadMissions(currentRegionId);
    checkExpirations(currentRegionId);

    const refresh = setInterval(
      () => checkExpirations(currentRegionId),
      60_000,
    );
    return () => clearInterval(refresh);
  }, [currentRegionId, loadMissions, loadActiveMissions, checkExpirations]);

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
  async function handleDispatch(agents: Agent[]) {
    if (!selectedMission || dispatching) return;
    setDispatching(true);
    setSelectedMission(null);
    try {
      await dispatch(selectedMission, agents);
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
      style={{ background: '#0a0a0a', color: '#e8e8e8' }}
    >
      {/* Header */}
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-lg font-bold tracking-tight mb-3">Operace</h1>

        {/* Currencies */}
        <div className="mb-3">
          <CurrenciesBar />
        </div>

        <CityBar />
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5">
        {/* ── Active missions ─────────────── */}
        {activeMissions.length > 0 && (
          <section>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-2"
              style={{ color: '#555' }}
            >
              Probíhající ({activeMissions.length})
            </p>
            <div className="flex flex-col gap-2">
              {activeMissions.map((am) => {
                const m = activeMissionData.get(am.missionId);
                if (!m) return null;
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
            style={{ color: '#555' }}
          >
            Dostupné mise
          </p>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl h-36 animate-pulse"
                  style={{ background: '#111' }}
                />
              ))}
            </div>
          ) : availableMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Shield size={40} style={{ color: '#2a2a2a' }} />
              <p className="text-sm" style={{ color: '#555' }}>
                Momentálně žádné mise
              </p>
              <p className="text-xs text-center" style={{ color: '#444' }}>
                Nové operace brzy přibydou.
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
