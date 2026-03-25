import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ChevronRight,
  Coins,
  Heart,
  Shield,
  Skull,
  Target,
  TrendingUp,
  Truck,
  UserX,
  XCircle,
  Zap,
} from 'lucide-react';
import { C, cardBase, btn, modalSheet } from '../../styles/tokens';
import { db } from '../../db/db';
import type { Agent, SafeHouse } from '../../db/schema';
import { AGENT_TYPES } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { EQUIPMENT_CATALOG } from '../../data/equipmentCatalog';
import { canRankUp, rankUp, applyEquipmentBonuses } from '../../engine/agentGenerator';
import { useGameStore } from '../../store/gameStore';
import {
  RARITY_COLOR,
  RARITY_LABEL,
  RANK_LABEL,
  RANK_STARS,
  RANK_NUM,
  STATUS_META,
} from '../shared/constants';
import {
  divisionColor,
  divisionName,
  SELL_REFUND,
  INSTANT_HEAL_COST_PER_SEC,
} from './agentHelpers';
import { travelCost, travelDuration } from './travelHelpers';
import { StatBar } from './StatBar';
import { HealingCountdown, TravelCountdown } from './CountdownTimers';
import { SAFE_HOUSE_CAPACITY } from '../../data/costs';

export function AgentDetailModal({
  agent,
  onClose,
  onAgentUpdated,
}: {
  agent: Agent;
  onClose: () => void;
  onAgentUpdated: () => void;
}) {
  const color = divisionColor(agent.division);
  const status = STATUS_META[agent.status];
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const addCurrencies = useGameStore((s) => s.addCurrencies);
  const directorAgentId = useGameStore((s) => s.directorAgentId);
  const setDirectorAgent = useGameStore((s) => s.setDirectorAgent);
  const totalMissionsCompleted = useGameStore((s) => s.totalMissionsCompleted);
  const agencyRank = Math.floor(totalMissionsCompleted / 10);

  const [showDemote, setShowDemote] = useState(false);
  const [transferSlotIdx, setTransferSlotIdx] = useState<number | null>(null);
  const [transferCandidates, setTransferCandidates] = useState<Agent[]>([]);
  const [confirmSellSlot, setConfirmSellSlot] = useState<number | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);
  const [showRelocate, setShowRelocate] = useState(false);
  const [otherSafeHouses, setOtherSafeHouses] = useState<SafeHouse[]>([]);
  const [shCounts, setShCounts] = useState<Record<string, number>>({});

  async function handleSell(slotIdx: number) {
    const eq = EQUIPMENT_CATALOG.find(
      (e) => e.id === agent.equipment[slotIdx].equipmentId,
    );
    const slots = agent.equipment.map((s, i) =>
      i === slotIdx ? { equipmentId: null } : s,
    );
    const newStats = applyEquipmentBonuses(agent.baseStats, slots, agent.rank);
    await db.agents.update(agent.id, { equipment: slots, stats: newStats });
    if (eq) addCurrencies({ money: Math.ceil(eq.costMoney * SELL_REFUND) });
    setConfirmSellSlot(null);
    onAgentUpdated();
  }

  async function handleDismiss() {
    let refundTotal = 0;
    for (const slot of agent.equipment) {
      if (!slot.equipmentId) continue;
      const eq = EQUIPMENT_CATALOG.find((e) => e.id === slot.equipmentId);
      if (eq) refundTotal += Math.ceil(eq.costMoney * SELL_REFUND);
    }
    if (refundTotal > 0) addCurrencies({ money: refundTotal });
    if (directorAgentId === agent.id) setDirectorAgent(null);
    await db.agents.delete(agent.id);
    onAgentUpdated();
    onClose();
  }

  async function handleDemote() {
    await db.agents.update(agent.id, {
      rank: 'veteran',
      xp: 0,
      xpToNextRank: 4000,
    });
    await db.gameState.update(1, { directorAgentId: undefined });
    setDirectorAgent(null);
    setShowDemote(false);
    onAgentUpdated();
    onClose();
  }

  async function handlePromoteToDirector() {
    const promoted = rankUp(agent, 0);
    await db.agents.put(promoted);
    await db.gameState.update(1, { directorAgentId: agent.id });
    setDirectorAgent(agent.id);
    onAgentUpdated();
    onClose();
  }

  async function openRelocate() {
    const all = await db.safeHouses.toArray();
    const others = all.filter((sh) => sh.id !== agent.safeHouseId);
    const counts: Record<string, number> = {};
    for (const sh of others)
      counts[sh.id] = await db.agents
        .where('safeHouseId')
        .equals(sh.id)
        .count();
    setOtherSafeHouses(others);
    setShCounts(counts);
    setShowRelocate(true);
  }

  async function handleRelocate(targetShId: string) {
    const cost = travelCost(agent.safeHouseId, targetShId);
    const ok = spendCurrencies({ money: cost });
    if (!ok) return;
    const duration = travelDuration(agent.safeHouseId, targetShId);
    const now = Date.now();
    await db.agents.update(agent.id, {
      status: 'traveling',
      travelDestinationId: targetShId,
      arrivesAt: now + duration,
    });
    setShowRelocate(false);
    onAgentUpdated();
    onClose();
  }

  async function openTransfer(slotIdx: number) {
    const eqId = agent.equipment[slotIdx].equipmentId;
    const eq = eqId ? EQUIPMENT_CATALOG.find((e) => e.id === eqId) : null;
    const candidates = await db.agents
      .where('safeHouseId')
      .equals(agent.safeHouseId)
      .toArray();
    const eligible = candidates.filter(
      (a) =>
        a.id !== agent.id &&
        a.status === 'available' &&
        a.equipment.some((s) => !s.equipmentId) &&
        (!eq?.requiredDivision || a.division === eq.requiredDivision),
    );
    setTransferCandidates(eligible);
    setTransferSlotIdx(slotIdx);
  }

  async function doTransfer(target: Agent) {
    if (transferSlotIdx === null) return;
    const eqId = agent.equipment[transferSlotIdx].equipmentId;
    if (!eqId) return;
    const srcSlots = agent.equipment.map((s, i) =>
      i === transferSlotIdx ? { equipmentId: null } : s,
    );
    const dstSlots = [...target.equipment];
    const freeIdx = dstSlots.findIndex((s) => !s.equipmentId);
    if (freeIdx === -1) return;
    dstSlots[freeIdx] = { equipmentId: eqId };
    const srcStats = applyEquipmentBonuses(
      agent.baseStats,
      srcSlots,
      agent.rank,
    );
    const dstStats = applyEquipmentBonuses(
      target.baseStats,
      dstSlots,
      target.rank,
    );
    await db.agents.update(agent.id, { equipment: srcSlots, stats: srcStats });
    await db.agents.update(target.id, { equipment: dstSlots, stats: dstStats });
    setTransferSlotIdx(null);
    onAgentUpdated();
  }

  const isInjured = agent.status === 'injured';
  const isCaptured = agent.status === 'captured';

  const [healRemaining] = useState(() =>
    agent.healsAt
      ? Math.max(0, Math.ceil((agent.healsAt - Date.now()) / 1000))
      : 0,
  );

  const instantHealCost = Math.ceil(healRemaining * INSTANT_HEAL_COST_PER_SEC);
  const canAffordHeal = currencies.money >= instantHealCost;

  async function handleInstantHeal() {
    if (!canAffordHeal || !isInjured) return;
    const ok = spendCurrencies({ money: instantHealCost });
    if (!ok) return;
    await db.agents.update(agent.id, {
      status: 'available',
      healsAt: undefined,
      injuredAt: undefined,
      injuryDescription: undefined,
    });
    onAgentUpdated();
    onClose();
  }

  const xpPct =
    agent.xpToNextRank === Infinity
      ? 100
      : Math.min(100, Math.round((agent.xp / agent.xpToNextRank) * 100));

  const successRate =
    agent.missionsAttempted > 0
      ? Math.round((agent.missionsCompleted / agent.missionsAttempted) * 100)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="rounded-t-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        style={modalSheet}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#999' }}
          />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: `${color}22`, color }}
              >
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className="text-lg font-bold"
                    style={{ color: '#e8e8e8' }}
                  >
                    {agent.name}
                  </h3>
                  {agent.nickname && (
                    <span className="text-sm italic" style={{ color: '#777' }}>
                      {agent.nickname}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: `${color}22`, color }}
                  >
                    {divisionName(agent.division)}
                  </span>
                  {agent.rank === 'director' ? (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{ background: `${C.yellow}22`, color: C.yellow }}
                    >
                      ★ {RANK_LABEL[agent.rank]}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: '#999' }}>
                      {RANK_LABEL[agent.rank]}
                    </span>
                  )}
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background:
                            i < (RANK_STARS[agent.rank] ?? 1)
                              ? agent.rank === 'director'
                                ? C.yellow
                                : color
                              : C.textMuted,
                        }}
                      />
                    ))}
                  </span>
                </div>
                {(() => {
                  const agentTypeName = AGENT_TYPES.find(
                    (t) => t.id === agent.typeId,
                  )?.name;
                  return agentTypeName ? (
                    <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                      {agentTypeName}
                    </p>
                  ) : null;
                })()}
                <p className="text-xs mt-1" style={{ color: '#888' }}>
                  📍{' '}
                  {REGION_MAP.get(agent.safeHouseId)?.name ?? agent.safeHouseId}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ color: '#888' }}>
              <XCircle size={22} />
            </button>
          </div>

          {/* Status */}
          <div
            className="mt-3 px-3 py-2 rounded-xl flex items-center justify-between"
            style={{
              background: `${status.color}14`,
            }}
          >
            <div className="flex items-center gap-2">
              {agent.status === 'available' && (
                <Shield size={14} color={status.color} />
              )}
              {agent.status === 'on_mission' && (
                <Target size={14} color={status.color} />
              )}
              {agent.status === 'injured' && (
                <Heart size={14} color={status.color} />
              )}
              {agent.status === 'captured' && (
                <Skull size={14} color={status.color} />
              )}
              <span
                className="text-sm font-semibold"
                style={{ color: status.color }}
              >
                {status.label}
              </span>
              {isInjured && agent.healsAt && (
                <span className="text-xs" style={{ color: '#888' }}>
                  — léčí se <HealingCountdown healsAt={agent.healsAt} />
                </span>
              )}
            </div>
            {isInjured && agent.injuryDescription && (
              <p className="text-xs mt-1 italic" style={{ color: '#aaa' }}>
                {agent.injuryDescription}
              </p>
            )}

            {/* Instant heal button */}
            {isInjured && healRemaining > 0 && (
              <button
                onClick={handleInstantHeal}
                disabled={!canAffordHeal}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
                style={btn.action(C.green, !canAffordHeal)}
              >
                <Zap size={11} />
                <Coins size={11} color={C.green} /> {instantHealCost}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-6 flex flex-col gap-4">
          {/* Stats */}
          <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: C.bgSurface }}
          >
            <p
              className="text-xs font-medium tracking-widest uppercase mb-1"
              style={{ color: C.textMuted }}
            >
              Statistiky
            </p>
            <StatBar
              label="Stealth"
              value={agent.stats.stealth}
              color={color}
              bonus={agent.stats.stealth - agent.baseStats.stealth}
            />
            <StatBar
              label="Combat"
              value={agent.stats.combat}
              color={color}
              bonus={agent.stats.combat - agent.baseStats.combat}
            />
            <StatBar
              label="Intel"
              value={agent.stats.intel}
              color={color}
              bonus={agent.stats.intel - agent.baseStats.intel}
            />
            <StatBar
              label="Tech"
              value={agent.stats.tech}
              color={color}
              bonus={agent.stats.tech - agent.baseStats.tech}
            />
          </div>

          {/* XP / Rank */}
          <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: C.bgSurface }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: C.textMuted }}
              >
                Zkušenosti
              </p>
              {agent.rank === 'director' ? (
                <span className="text-xs font-semibold" style={{ color: C.yellow }}>
                  ŘEDITEL
                </span>
              ) : (
                <span className="text-xs" style={{ color: '#999' }}>
                  {agent.xp} / {agent.xpToNextRank} XP
                </span>
              )}
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: '#666666' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${xpPct}%`,
                  background: canRankUp(agent, directorAgentId ? 1 : 0) ? C.yellow : color,
                }}
              />
            </div>
            {/* Auto rank-up hint — only for non-veteran ranks */}
            {canRankUp(agent, directorAgentId ? 1 : 0) && agent.rank !== 'veteran' && (
              <div
                className="flex items-center gap-1 text-xs"
                style={{ color: C.yellow }}
              >
                <TrendingUp size={12} />
                Připraven k postupu — nastane automaticky při dokončení mise
              </div>
            )}
            {/* Manual Director promotion */}
            {agent.rank === 'veteran' && agent.xp >= agent.xpToNextRank && (
              directorAgentId !== null && directorAgentId !== agent.id ? (
                <div className="flex items-center gap-1 text-xs" style={{ color: C.textMuted }}>
                  <TrendingUp size={12} />
                  Postup na Ředitele blokován — slot obsazen jiným agentem
                </div>
              ) : agencyRank < 10 ? (
                <div className="flex items-center gap-1 text-xs" style={{ color: C.textMuted }}>
                  <TrendingUp size={12} />
                  Rank Ředitele vyžaduje Agency Rank 10 ({totalMissionsCompleted}/100 misí)
                </div>
              ) : (
                <button
                  onClick={handlePromoteToDirector}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg mt-1"
                  style={{ background: '#eab30822', color: '#eab308', border: '1px solid #eab30844' }}
                >
                  <TrendingUp size={12} />
                  Povýšit na Ředitele
                </button>
              )
            )}
          </div>

          {/* Mission stats */}
          <div className="rounded-xl p-3" style={{ background: C.bgSurface }}>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-3"
              style={{ color: C.textMuted }}
            >
              Statistiky misí
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className="text-lg font-bold"
                  style={{ color: '#e8e8e8' }}
                >
                  {agent.missionsAttempted}
                </span>
                <span className="text-xs text-center" style={{ color: '#888' }}>
                  Celkem
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className="text-lg font-bold"
                  style={{ color: '#4ade80' }}
                >
                  {agent.missionsCompleted}
                </span>
                <span className="text-xs text-center" style={{ color: '#888' }}>
                  Úspěšných
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className="text-lg font-bold"
                  style={{
                    color:
                      successRate !== null && successRate >= 70
                        ? '#4ade80'
                        : '#f97316',
                  }}
                >
                  {successRate !== null ? `${successRate} %` : '—'}
                </span>
                <span className="text-xs text-center" style={{ color: '#888' }}>
                  Úspěšnost
                </span>
              </div>
            </div>
          </div>

          {/* Equipment slots */}
          <div className="rounded-xl p-3" style={{ background: C.bgSurface }}>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-3"
              style={{ color: C.textMuted }}
            >
              Vybavení
            </p>
            <div className="flex flex-col gap-2">
              {agent.equipment.map((slot, i) => {
                const eq = slot.equipmentId
                  ? (EQUIPMENT_CATALOG.find((e) => e.id === slot.equipmentId) ??
                    null)
                  : null;
                if (!eq) {
                  return (
                    <div
                      key={i}
                      className="h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: C.bgBase,
                      }}
                    >
                      <span className="text-[11px]" style={{ color: '#999' }}>
                        Prázdný slot
                      </span>
                    </div>
                  );
                }
                const rc = RARITY_COLOR[eq.rarity] ?? '#888';
                const refund = Math.ceil(eq.costMoney * SELL_REFUND);
                const rankLocked =
                  eq.minRank != null &&
                  RANK_NUM[agent.rank] < RANK_NUM[eq.minRank];
                const bonuses: { label: string; positive: boolean }[] = [];
                if (eq.bonusStealth)
                  bonuses.push({
                    label: `${eq.bonusStealth > 0 ? '+' : ''}${eq.bonusStealth} Stealth`,
                    positive: eq.bonusStealth > 0,
                  });
                if (eq.bonusCombat)
                  bonuses.push({
                    label: `${eq.bonusCombat > 0 ? '+' : ''}${eq.bonusCombat} Combat`,
                    positive: eq.bonusCombat > 0,
                  });
                if (eq.bonusIntel)
                  bonuses.push({
                    label: `${eq.bonusIntel > 0 ? '+' : ''}${eq.bonusIntel} Intel`,
                    positive: eq.bonusIntel > 0,
                  });
                if (eq.bonusTech)
                  bonuses.push({
                    label: `${eq.bonusTech > 0 ? '+' : ''}${eq.bonusTech} Tech`,
                    positive: eq.bonusTech > 0,
                  });
                if (eq.successBonus)
                  bonuses.push({
                    label: `+${eq.successBonus}% šance`,
                    positive: true,
                  });
                return (
                  <div
                    key={i}
                    className="rounded-xl p-2.5"
                    style={{
                      background: `${rc}0d`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: rc }}
                      />
                      <span
                        className="text-sm font-medium flex-1 truncate"
                        style={{ color: '#e8e8e8' }}
                      >
                        {eq.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: `${rc}22`, color: rc }}
                      >
                        {RARITY_LABEL[eq.rarity] ?? eq.rarity}
                      </span>
                    </div>
                    {rankLocked && (
                      <div
                        className="text-[10px] px-1.5 py-0.5 rounded mb-1.5 inline-block"
                        style={{ background: '#2e1a00', color: '#f97316' }}
                      >
                        ⚠ Vyžaduje {RANK_LABEL[eq.minRank!]}
                      </div>
                    )}
                    {bonuses.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {bonuses.map((b) => (
                          <span
                            key={b.label}
                            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                            style={{
                              background: '#666666',
                              color: rankLocked
                                ? '#888'
                                : b.positive
                                  ? '#4ade80'
                                  : '#f97316',
                            }}
                          >
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      {confirmSellSlot === i ? (
                        <>
                          <button
                            onClick={() => handleSell(i)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                            style={btn.action(C.divExtraction, false)}
                          >
                            Potvrdit +${refund}
                          </button>
                          <button
                            onClick={() => setConfirmSellSlot(null)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                            style={btn.secondary()}
                          >
                            Zrušit
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setConfirmSellSlot(i)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                            style={btn.action(C.divExtraction, false)}
                          >
                            Prodat +${refund}
                          </button>
                          <button
                            onClick={() => openTransfer(i)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                            style={btn.action(C.blue, false)}
                          >
                            Přendat →
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transfer picker */}
          {transferSlotIdx !== null && (
            <div
              className="fixed inset-0 z-[60] flex flex-col justify-end"
              style={{ background: 'rgba(0,0,0,0.82)' }}
            >
              <div
                className="rounded-t-2xl flex flex-col max-h-[65vh]"
                style={modalSheet}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ background: '#999' }}
                  />
                </div>
                <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: '#e8e8e8' }}
                  >
                    Přendat na agenta
                  </p>
                  <button
                    onClick={() => setTransferSlotIdx(null)}
                    style={{ color: '#888' }}
                  >
                    <XCircle size={20} />
                  </button>
                </div>
                <div className="px-4 pb-6 overflow-y-auto flex flex-col gap-2 mt-2">
                  {transferCandidates.length === 0 ? (
                    <p
                      className="text-sm text-center py-6"
                      style={{ color: '#888' }}
                    >
                      Žádný agent ve stejné základně nemá volný slot
                    </p>
                  ) : (
                    transferCandidates.map((ta) => (
                      <button
                        key={ta.id}
                        onClick={() => doTransfer(ta)}
                        className="text-left rounded-xl p-3 flex items-center gap-3"
                        style={cardBase}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{
                            background: `${divisionColor(ta.division)}22`,
                            color: divisionColor(ta.division),
                          }}
                        >
                          {ta.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p
                            className="text-sm font-medium"
                            style={{ color: '#e8e8e8' }}
                          >
                            {ta.name}
                          </p>
                          <p className="text-xs" style={{ color: '#888' }}>
                            {divisionName(ta.division)} · {RANK_LABEL[ta.rank]}
                          </p>
                        </div>
                        <ChevronRight size={16} style={{ color: '#999' }} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Traveling status */}
          {agent.status === 'traveling' && agent.arrivesAt && (
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: '#1a0a2e' }}
            >
              <Truck
                size={16}
                color="#a78bfa"
                className="flex-shrink-0 mt-0.5"
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: '#a78bfa' }}
                >
                  Agent cestuje
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  Dorazí do{' '}
                  {REGION_MAP.get(agent.travelDestinationId ?? '')?.name ?? '?'}{' '}
                  za <TravelCountdown arrivesAt={agent.arrivesAt} />
                </p>
              </div>
            </div>
          )}

          {/* Captured warning */}
          {isCaptured && (
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: '#2e0f0f' }}
            >
              <AlertTriangle
                size={16}
                color="#ef4444"
                className="flex-shrink-0 mt-0.5"
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: '#ef4444' }}
                >
                  Agent byl zajat
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  Dokončit záchrannou misi pro osvobození agenta.
                </p>
              </div>
            </div>
          )}

          {/* Agent actions */}
          {agent.status === 'available' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={openRelocate}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                style={btn.action(C.blue, false)}
              >
                <Truck size={12} />
                Přesunout
              </button>
              {agent.rank === 'director' ? (
                <button
                  onClick={() => setShowDemote(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                  style={btn.destructive}
                >
                  <ArrowDownCircle size={12} />
                  Degradovat
                </button>
              ) : (
                <button
                  onClick={() => setShowDismiss(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                  style={btn.destructive}
                >
                  <UserX size={12} />
                  Propustit
                </button>
              )}
            </div>
          )}

          {/* Dismiss confirmation modal */}
          {showDismiss && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center px-6"
              style={{ background: 'rgba(0,0,0,0.85)' }}
            >
              <div className="rounded-2xl p-5 w-full max-w-xs" style={cardBase}>
                <p
                  className="text-base font-bold mb-1"
                  style={{ color: '#e8e8e8' }}
                >
                  Propustit {agent.name}?
                </p>
                <p className="text-xs mb-4" style={{ color: '#999' }}>
                  Agent bude trvale odstraněn. Vybavení bude prodáno za
                  30&nbsp;% ceny. Ztratíte všechny nasbírané XP.
                </p>
                {agent.equipment.some((s) => s.equipmentId) && (
                  <p
                    className="text-xs mb-4 font-semibold"
                    style={{ color: '#f97316' }}
                  >
                    Refund: $
                    {agent.equipment.reduce((sum, s) => {
                      const eq = s.equipmentId
                        ? EQUIPMENT_CATALOG.find((e) => e.id === s.equipmentId)
                        : null;
                      return eq
                        ? sum + Math.ceil(eq.costMoney * SELL_REFUND)
                        : sum;
                    }, 0)}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDismiss(false)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium"
                    style={btn.secondary()}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-2 rounded-xl text-sm font-medium"
                    style={btn.destructive}
                  >
                    Propustit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Demote confirmation modal */}
          {showDemote && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center px-6"
              style={{ background: 'rgba(0,0,0,0.85)' }}
            >
              <div className="rounded-2xl p-5 w-full max-w-xs" style={cardBase}>
                <p
                  className="text-base font-bold mb-1"
                  style={{ color: '#e8e8e8' }}
                >
                  Degradovat {agent.name}?
                </p>
                <p className="text-xs mb-4" style={{ color: '#999' }}>
                  Agent ztratí hodnost Ředitele a vrátí se na Veterána. Slot
                  Ředitele se uvolní pro jiného agenta. XP bude resetováno.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDemote(false)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium"
                    style={btn.secondary()}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleDemote}
                    className="flex-1 py-2 rounded-xl text-sm font-medium"
                    style={btn.destructive}
                  >
                    Degradovat
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Relocate picker modal */}
          {showRelocate && (
            <div
              className="fixed inset-0 z-[70] flex flex-col justify-end"
              style={{ background: 'rgba(0,0,0,0.82)' }}
            >
              <div className="rounded-t-2xl" style={modalSheet}>
                <div className="flex justify-center pt-3 pb-1">
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ background: '#999' }}
                  />
                </div>
                <div className="px-4 pt-2 pb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: '#e8e8e8' }}
                    >
                      Přesunout {agent.name}
                    </p>
                    <button
                      onClick={() => setShowRelocate(false)}
                      style={{ color: '#888' }}
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                  {otherSafeHouses.length === 0 ? (
                    <p
                      className="text-sm text-center py-6"
                      style={{ color: '#888' }}
                    >
                      Nemáte jinou základnu
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {otherSafeHouses.map((sh) => {
                        const cap = SAFE_HOUSE_CAPACITY[sh.level] ?? 3;
                        const count = shCounts[sh.id] ?? 0;
                        const full = count >= cap;
                        const cost = travelCost(agent.safeHouseId, sh.id);
                        const mins = Math.round(
                          travelDuration(agent.safeHouseId, sh.id) / 60000,
                        );
                        const canAfford = currencies.money >= cost;
                        return (
                          <button
                            key={sh.id}
                            disabled={full || !canAfford}
                            onClick={() =>
                              !full && canAfford && handleRelocate(sh.id)
                            }
                            className="flex items-center gap-3 p-3 rounded-xl"
                            style={{
                              ...cardBase,
                              opacity: full || !canAfford ? 0.4 : 1,
                              cursor:
                                full || !canAfford ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{
                                background: '#60a5fa22',
                                color: '#60a5fa',
                              }}
                            >
                              {(REGION_MAP.get(sh.id)?.name ?? sh.id)
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="flex-1 text-left">
                              <p
                                className="text-sm font-medium"
                                style={{ color: '#e8e8e8' }}
                              >
                                {REGION_MAP.get(sh.id)?.name ?? sh.id}
                              </p>
                              <p className="text-xs" style={{ color: '#999' }}>
                                {count}/{cap} agentů · {mins} min
                                {full ? ' · plno' : ''}
                              </p>
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{
                                color: canAfford ? '#4ade80' : '#ef4444',
                              }}
                            >
                              ${cost}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
