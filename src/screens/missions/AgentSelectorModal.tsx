import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Users, XCircle, Zap } from 'lucide-react';
import { C, modalSheet, modalOverlay } from '../../styles/tokens';
import type { Agent, Mission } from '../../db/schema';
import { DIVISIONS } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { db } from '../../db/db';
import {
  calculateSuccessChance,
  checkAgentEligibility,
  checkTeamEligibility,
  APPROACH_MODS,
  type MissionApproach,
} from '../../engine/missionResolver';
import { useGameStore } from '../../store/gameStore';
import { CATEGORY_META, STAT_LABELS } from './missionConstants';
import { AgentRow } from './AgentRow';
import { chanceColor } from './missionHelpers';
import {
  getEventDef,
  getEventSuccessChancePenalty,
} from '../../engine/worldEvents';

export function AgentSelectorModal({
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
  const activeWorldEvent = useGameStore((s) => s.activeWorldEvent);
  const eventDef = getEventDef(activeWorldEvent);
  const scPenalty = getEventSuccessChancePenalty(activeWorldEvent);

  useEffect(() => {
    db.regions.get(mission.regionId).then((r) => {
      setRegionAlertLevel(r?.alertLevel ?? 0);
    });
  }, [mission.regionId]);

  useEffect(() => {
    db.agents
      .where('status')
      .equals('available')
      .filter((a) => a.safeHouseId === mission.regionId)
      .toArray()
      .then((agents) => {
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
    const raw = calculateSuccessChance(
      selectedAgents,
      mission,
      regionAlertLevel,
      approach,
    );
    return Math.max(0.05, raw - scPenalty);
  }, [selectedAgents, mission, regionAlertLevel, approach, scPenalty]);

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
