import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Coins,
  Eye,
  Ghost,
  House,
  Lock,
  Radio,
  ShieldCheck,
  TrendingUp,
  User,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  C,
  cardBase,
  cardActive,
  btn,
  modalSheet,
  modalOverlay,
} from '../../styles/tokens';
import { db } from '../../db/db';
import type { Agent, SafeHouse, Mission } from '../../db/schema';
import type { DivisionId } from '../../data/agentTypes';
import { DIVISIONS } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { COUNTRY_MAP } from '../../data/countries';
import {
  SAFE_HOUSE_CAPACITY,
  SAFE_HOUSE_UPGRADE_COSTS,
  SAFE_HOUSE_UPGRADE_DURATION,
  SAFE_HOUSE_DIVISION_SLOTS,
  DIVISION_ASSIGN_BASE_COST,
  MODULE_CATALOG,
  MODULE_MAX_PER_SAFEHOUSE,
} from '../../data/costs';
import { useGameStore } from '../../store/gameStore';
import { useMissionStore } from '../../store/missionStore';
import { useUIStore } from '../../store/uiStore';
import {
  calculateSafeHouseIncome,
  calculateSafeHouseBreakdown,
  getCityBonus,
} from '../../engine/passiveIncome';
import { divColor, divName } from './baseHelpers';

function CurrencyLine({
  money,
  intel,
  shadow,
  influence,
}: {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
}) {
  return (
    <span className="flex items-center gap-2 flex-wrap">
      {money !== 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <Coins size={10} color={C.green} />
          <span style={{ color: money >= 0 ? C.green : C.red }}>
            {money >= 0 ? '+' : ''}
            {money.toFixed(1)}
          </span>
        </span>
      )}
      {intel !== 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <Eye size={10} color={C.blue} />
          <span style={{ color: intel >= 0 ? C.blue : C.red }}>
            {intel >= 0 ? '+' : ''}
            {intel.toFixed(1)}
          </span>
        </span>
      )}
      {shadow !== 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <Ghost size={10} color={C.bm} />
          <span style={{ color: shadow >= 0 ? C.bm : C.red }}>
            {shadow >= 0 ? '+' : ''}
            {shadow.toFixed(1)}
          </span>
        </span>
      )}
      {influence !== 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <Radio size={10} color={C.divExtraction} />
          <span
            style={{
              color: influence >= 0 ? C.divExtraction : C.red,
            }}
          >
            {influence >= 0 ? '+' : ''}
            {influence.toFixed(1)}
          </span>
        </span>
      )}
    </span>
  );
}

export function SafeHouseTab() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const addCurrencies = useGameStore((s) => s.addCurrencies);
  const divisionLevels = useGameStore((s) => s.divisionLevels);
  const unlockedDivisions = useGameStore((s) => s.unlockedDivisions);
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);
  const currentRegionId = selectedRegionId ?? startCityId;

  const [houses, setHouses] = useState<SafeHouse[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [agentsMap, setAgentsMap] = useState<Record<string, Agent[]>>({});
  const [activeSafeHouseCount, setActiveSafeHouseCount] = useState(1);
  const invalidateRegionMissions = useMissionStore(
    (s) => s.invalidateRegionMissions,
  );
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [assignPicked, setAssignPicked] = useState<DivisionId | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState<string | null>(null);
  const [confirmDemolish, setConfirmDemolish] = useState<{
    shId: string;
    moduleId: string;
  } | null>(null);
  const [confirmBuyModule, setConfirmBuyModule] = useState<{
    shId: string;
    moduleId: string;
  } | null>(null);

  const load = useCallback(async () => {
    const allShs = await db.safeHouses.toArray();
    const shs = allShs.filter((sh) => sh.id === currentRegionId);
    setHouses(shs);
    setActiveSafeHouseCount(
      allShs.filter((sh) => !sh.constructionInProgress).length,
    );
    const c: Record<string, number> = {};
    const am: Record<string, Agent[]> = {};
    for (const sh of shs) {
      const shAgents = await db.agents
        .where('safeHouseId')
        .equals(sh.id)
        .toArray();
      c[sh.id] = shAgents.length;
      am[sh.id] = shAgents;
    }
    setCounts(c);
    setAgentsMap(am);
  }, [currentRegionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  async function upgrade(sh: SafeHouse) {
    if (sh.level >= 5 || sh.upgradeInProgress) return;
    const cost = SAFE_HOUSE_UPGRADE_COSTS[sh.level + 1];
    if (!cost || !spendCurrencies({ money: cost.money, intel: cost.intel }))
      return;
    const dur = SAFE_HOUSE_UPGRADE_DURATION[sh.level + 1] ?? 60;
    const now = Date.now();
    await db.safeHouses.update(sh.id, {
      upgradeInProgress: true,
      upgradeCompletesAt: now + dur * 1000,
    });
    setConfirmUpgrade(null);
    load();
  }

  async function demolishModule(sh: SafeHouse, moduleId: string) {
    const mod = MODULE_CATALOG.find((m) => m.id === moduleId);
    if (!mod) return;
    await db.safeHouses.update(sh.id, {
      modules: sh.modules.filter((id) => id !== moduleId),
    });
    addCurrencies({
      money: Math.floor(mod.cost.money * 0.3),
      intel: Math.floor((mod.cost.intel ?? 0) * 0.3),
      shadow: Math.floor((mod.cost.shadow ?? 0) * 0.3),
      influence: Math.floor((mod.cost.influence ?? 0) * 0.3),
    });
    setConfirmDemolish(null);
    load();
  }

  async function buyModule(sh: SafeHouse, moduleId: string) {
    if (sh.modules.includes(moduleId)) return;
    if (sh.modules.length >= MODULE_MAX_PER_SAFEHOUSE) return;
    const mod = MODULE_CATALOG.find((m) => m.id === moduleId);
    if (!mod) return;
    const ok = spendCurrencies({
      money: mod.cost.money,
      intel: mod.cost.intel ?? 0,
      shadow: mod.cost.shadow ?? 0,
      influence: mod.cost.influence ?? 0,
    });
    if (!ok) return;
    await db.safeHouses.update(sh.id, {
      modules: [...sh.modules, moduleId],
    });
    load();
  }

  async function assignDivision(sh: SafeHouse, divId: DivisionId) {
    const cost = DIVISION_ASSIGN_BASE_COST * (sh.index ?? 1);
    if (!spendCurrencies({ money: cost })) return;
    await db.safeHouses.update(sh.id, {
      assignedDivisions: [...sh.assignedDivisions, divId],
    });
    const region = await db.regions.get(sh.id);
    const missionIds = region?.availableMissionIds ?? [];
    if (missionIds.length) {
      const allMissions = (await db.missions.bulkGet(missionIds)).filter(
        Boolean,
      ) as Mission[];
      const toUnlock = allMissions.filter((m) => m.lockedByDivision === divId);
      for (const m of toUnlock) {
        await db.missions.update(m.id, { lockedByDivision: undefined });
      }
    }
    setAssigningTo(null);
    setAssignPicked(null);
    load();
    invalidateRegionMissions(sh.id);
  }

  if (!houses.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <Building2 size={40} style={{ color: '#777777' }} />
        <p className="text-sm" style={{ color: '#888' }}>
          Žádné safe housy
        </p>
      </div>
    );

  return (
    <>
      <div className="flex flex-col gap-3">
        {houses.map((sh) => {
          const count = counts[sh.id] ?? 0;
          const cap = SAFE_HOUSE_CAPACITY[sh.level] ?? 3;
          const nextCost =
            sh.level < 5 ? SAFE_HOUSE_UPGRADE_COSTS[sh.level + 1] : null;
          const canUpg =
            !sh.upgradeInProgress &&
            nextCost &&
            currencies.money >= nextCost.money &&
            currencies.intel >= nextCost.intel;

          return (
            <div key={sh.id} className="rounded-xl p-4" style={cardBase}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-start gap-2">
                  <Building2 size={17} color="#4ade80" />
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: '#e8e8e8' }}
                    >
                      {REGION_MAP.get(sh.id)?.name ?? sh.id}
                    </p>
                    <p className="text-xs" style={{ color: '#999' }}>
                      {COUNTRY_MAP.get(REGION_MAP.get(sh.id)?.countryId ?? '')
                        ?.name ?? ''}
                    </p>
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: i < sh.level ? '#4ade80' : '#777777',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{ background: '#4ade8022', color: '#4ade80' }}
                >
                  Level {sh.level}
                </span>
              </div>

              <div className="flex gap-3 mb-3">
                <div
                  className="flex-1 rounded-lg p-2 text-center"
                  style={{ background: C.bgBase }}
                >
                  <p className="text-sm font-bold" style={{ color: '#e8e8e8' }}>
                    {count}/{cap}
                  </p>
                  <p className="text-xs" style={{ color: '#888' }}>
                    Agenti
                  </p>
                </div>
                <div
                  className="flex-1 rounded-lg p-2 text-center"
                  style={{ background: C.bgBase }}
                >
                  <p className="text-sm font-bold" style={{ color: '#e8e8e8' }}>
                    {sh.assignedDivisions.length}
                  </p>
                  <p className="text-xs" style={{ color: '#888' }}>
                    Divize
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3 items-center">
                {sh.assignedDivisions.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: `${divColor(d)}22`,
                      color: divColor(d),
                    }}
                  >
                    {divName(d)}
                  </span>
                ))}
                {(() => {
                  const maxSlots = SAFE_HOUSE_DIVISION_SLOTS[sh.level] ?? 2;
                  const hasSlot = sh.assignedDivisions.length < maxSlots;
                  const hasUnassigned = (
                    unlockedDivisions as DivisionId[]
                  ).some((d) => !sh.assignedDivisions.includes(d));

                  if (hasSlot && hasUnassigned) {
                    return (
                      <button
                        onClick={() => {
                          setAssigningTo(sh.id);
                          setAssignPicked(null);
                        }}
                        className="text-xs px-2 py-0.5 rounded flex items-center gap-0.5"
                        style={{
                          background: C.bgBase,
                          color: C.green,
                        }}
                      >
                        + <Coins size={10} color={C.green} />
                        {DIVISION_ASSIGN_BASE_COST * (sh.index ?? 1)}
                      </button>
                    );
                  }

                  if (!hasSlot && sh.level < 5) {
                    const nextLevel = ([2, 3, 4, 5] as const).find(
                      (lv) =>
                        lv > sh.level &&
                        (SAFE_HOUSE_DIVISION_SLOTS[lv] ?? 0) > maxSlots,
                    );
                    return (
                      <span
                        className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                        style={{
                          background: C.bgSurface2,
                          color: '#888',
                        }}
                      >
                        <Lock size={9} />
                        {nextLevel ? `+slot na Lv${nextLevel}` : 'Plný slot'}
                      </span>
                    );
                  }

                  return null;
                })()}
              </div>

              {/* Passive income breakdown */}
              {(() => {
                const shAgents = agentsMap[sh.id] ?? [];
                const divLevels = divisionLevels as Record<
                  import('../../data/agentTypes').DivisionId,
                  number
                >;
                const bd = calculateSafeHouseBreakdown(sh, divLevels, shAgents);
                const baseNet = calculateSafeHouseIncome(
                  sh,
                  divLevels,
                  shAgents,
                );
                const cityBonus = getCityBonus(activeSafeHouseCount);
                const net = {
                  money: baseNet.money * cityBonus,
                  intel: baseNet.intel * cityBonus,
                  shadow: baseNet.shadow * cityBonus,
                  influence: baseNet.influence * cityBonus,
                };

                const hasAny =
                  bd.divisions.length > 0 ||
                  bd.modules.length > 0 ||
                  bd.salaries.length > 0;
                if (!hasAny) return null;

                return (
                  <div
                    className="mb-3 rounded-lg overflow-hidden"
                    style={{ background: C.bgBase }}
                  >
                    <div className="px-3 pt-2.5 pb-1.5">
                      <p
                        className="text-[10px] uppercase tracking-widest font-semibold"
                        style={{ color: '#666666' }}
                      >
                        Příjmy a výdaje / tick
                      </p>
                    </div>

                    <div className="px-3 py-2 flex flex-col gap-1.5">
                      {bd.divisions.map((d) => (
                        <div
                          key={d.label}
                          className="flex items-center justify-between gap-2"
                        >
                          <span
                            className="text-[11px] truncate"
                            style={{ color: '#888' }}
                          >
                            {d.label}
                          </span>
                          <CurrencyLine {...d} />
                        </div>
                      ))}

                      {bd.modules.map((m) => (
                        <div
                          key={m.label}
                          className="flex items-center justify-between gap-2"
                        >
                          <span
                            className="flex items-center gap-1 text-[11px] truncate"
                            style={{ color: '#888' }}
                          >
                            <Wrench size={9} style={{ flexShrink: 0 }} />
                            {m.label}
                          </span>
                          <CurrencyLine {...m} />
                        </div>
                      ))}

                      {bd.salaries.length > 0 && (
                        <>
                          <div className="my-0.5" />
                          {bd.salaries.map((s) => (
                            <div
                              key={s.label}
                              className="flex items-center justify-between gap-2"
                            >
                              <span
                                className="flex items-center gap-1 text-[11px] truncate"
                                style={{ color: '#888' }}
                              >
                                <User size={9} style={{ flexShrink: 0 }} />
                                {s.label}
                              </span>
                              <CurrencyLine {...s} />
                            </div>
                          ))}
                        </>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="flex items-center gap-1 text-[11px] truncate"
                          style={{ color: '#888' }}
                        >
                          <House size={9} style={{ flexShrink: 0 }} />
                          {bd.upkeep.label}
                        </span>
                        <CurrencyLine {...bd.upkeep} />
                      </div>

                      {cityBonus > 1.0 && (
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-[11px] truncate"
                            style={{ color: C.textMuted }}
                          >
                            Network bonus
                          </span>
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: `${C.green}18`,
                              color: C.green,
                            }}
                          >
                            ×{cityBonus.toFixed(1)}
                          </span>
                        </div>
                      )}

                      <div
                        className="pt-2 mt-1 flex items-center justify-between gap-2"
                        style={{ borderTop: `1px solid ${C.bgSurface2}` }}
                      >
                        <span
                          className="text-xs font-semibold"
                          style={{ color: '#e8e8e8' }}
                        >
                          Čistý tick
                        </span>
                        <CurrencyLine
                          money={Math.round(net.money * 10) / 10}
                          intel={Math.round(net.intel * 10) / 10}
                          shadow={Math.round(net.shadow * 10) / 10}
                          influence={Math.round(net.influence * 10) / 10}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modules */}
              <div className="mb-3">
                <p
                  className="text-[10px] uppercase tracking-widest mb-1.5"
                  style={{ color: '#666666' }}
                >
                  Moduly ({sh.modules.length}/{MODULE_MAX_PER_SAFEHOUSE})
                </p>
                {sh.modules.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {sh.modules.map((mId) => {
                      const mod = MODULE_CATALOG.find((m) => m.id === mId);
                      const isConfirming =
                        confirmDemolish?.shId === sh.id &&
                        confirmDemolish?.moduleId === mId;
                      const refund = mod
                        ? {
                            money: Math.floor(mod.cost.money * 0.3),
                            intel: Math.floor((mod.cost.intel ?? 0) * 0.3),
                            shadow: Math.floor((mod.cost.shadow ?? 0) * 0.3),
                            influence: Math.floor(
                              (mod.cost.influence ?? 0) * 0.3,
                            ),
                          }
                        : null;
                      return (
                        <div
                          key={mId}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5"
                          style={{
                            background: isConfirming ? '#2a1a1a' : '#1a2e1a',
                          }}
                        >
                          <div className="min-w-0">
                            <span
                              className="text-xs font-medium block"
                              style={{
                                color: isConfirming ? '#ef4444' : '#4ade80',
                              }}
                            >
                              {mod?.name ?? mId}
                            </span>
                            {mod?.description && (
                              <span
                                className="text-[10px] block"
                                style={{ color: '#888' }}
                              >
                                {mod.description}
                              </span>
                            )}
                          </div>
                          {isConfirming ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="flex items-center gap-1 text-[10px]"
                                style={{ color: '#888' }}
                              >
                                Refund
                                {refund?.money ? (
                                  <>
                                    <Coins size={9} color={C.green} />
                                    <span style={{ color: C.green }}>
                                      {refund.money}
                                    </span>
                                  </>
                                ) : null}
                                {refund?.intel ? (
                                  <>
                                    <Eye size={9} color={C.blue} />
                                    <span style={{ color: C.blue }}>
                                      {refund.intel}
                                    </span>
                                  </>
                                ) : null}
                                {refund?.shadow ? (
                                  <>
                                    <Ghost size={9} color={C.bm} />
                                    <span style={{ color: C.bm }}>
                                      {refund.shadow}
                                    </span>
                                  </>
                                ) : null}
                                {refund?.influence ? (
                                  <>
                                    <Radio size={9} color={C.divExtraction} />
                                    <span style={{ color: C.divExtraction }}>
                                      {refund.influence}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                              <button
                                onClick={() => demolishModule(sh, mId)}
                                className="text-[10px] px-2 py-0.5 rounded font-semibold"
                                style={{
                                  background: '#ef444422',
                                  color: '#ef4444',
                                }}
                              >
                                Potvrdit
                              </button>
                              <button
                                onClick={() => setConfirmDemolish(null)}
                                className="text-[10px] px-2 py-0.5 rounded"
                                style={{ color: '#888' }}
                              >
                                Zrušit
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setConfirmDemolish({
                                  shId: sh.id,
                                  moduleId: mId,
                                })
                              }
                              className="text-[10px] px-2 py-0.5 rounded"
                              style={{ color: '#888' }}
                            >
                              Demolovat
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {sh.modules.length < MODULE_MAX_PER_SAFEHOUSE && (
                  <div className="flex flex-col gap-1">
                    {MODULE_CATALOG.filter(
                      (m) => !sh.modules.includes(m.id),
                    ).map((mod) => {
                      const canAfford =
                        currencies.money >= mod.cost.money &&
                        (currencies.intel ?? 0) >= (mod.cost.intel ?? 0) &&
                        (currencies.shadow ?? 0) >= (mod.cost.shadow ?? 0) &&
                        (currencies.influence ?? 0) >=
                          (mod.cost.influence ?? 0);
                      const isConfirming =
                        confirmBuyModule?.shId === sh.id &&
                        confirmBuyModule?.moduleId === mod.id;
                      return (
                        <div
                          key={mod.id}
                          className="w-full flex items-center justify-between rounded-lg px-3 py-2"
                          style={{
                            ...btn.action(C.green, !canAfford && !isConfirming),
                            opacity: canAfford || isConfirming ? 1 : 0.6,
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-semibold truncate"
                              style={{ color: canAfford ? '#e8e8e8' : '#888' }}
                            >
                              {mod.name}
                            </p>
                            <p
                              className="text-[10px]"
                              style={{ color: '#888' }}
                            >
                              {mod.description}
                            </p>
                          </div>
                          {isConfirming ? (
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <button
                                onClick={() => {
                                  buyModule(sh, mod.id);
                                  setConfirmBuyModule(null);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded font-semibold"
                                style={{
                                  background: '#4ade8022',
                                  color: '#4ade80',
                                }}
                              >
                                Potvrdit
                              </button>
                              <button
                                onClick={() => setConfirmBuyModule(null)}
                                className="text-[10px] px-2 py-0.5 rounded"
                                style={{ color: '#888' }}
                              >
                                Zrušit
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <div className="flex items-center gap-1.5">
                                {mod.cost.money > 0 && (
                                  <span
                                    className="flex items-center gap-0.5 text-[10px]"
                                    style={{ color: C.green }}
                                  >
                                    <Coins size={10} color={C.green} />
                                    {mod.cost.money}
                                  </span>
                                )}
                                {(mod.cost.intel ?? 0) > 0 && (
                                  <span
                                    className="flex items-center gap-0.5 text-[10px]"
                                    style={{ color: C.blue }}
                                  >
                                    <Eye size={10} color={C.blue} />
                                    {mod.cost.intel}
                                  </span>
                                )}
                                {(mod.cost.shadow ?? 0) > 0 && (
                                  <span
                                    className="flex items-center gap-0.5 text-[10px]"
                                    style={{ color: C.bm }}
                                  >
                                    <Ghost size={10} color={C.bm} />
                                    {mod.cost.shadow}
                                  </span>
                                )}
                                {(mod.cost.influence ?? 0) > 0 && (
                                  <span
                                    className="flex items-center gap-0.5 text-[10px]"
                                    style={{ color: C.divExtraction }}
                                  >
                                    <Radio size={10} color={C.divExtraction} />
                                    {mod.cost.influence}
                                  </span>
                                )}
                              </div>
                              <button
                                disabled={!canAfford}
                                onClick={() =>
                                  setConfirmBuyModule({
                                    shId: sh.id,
                                    moduleId: mod.id,
                                  })
                                }
                                className="text-[10px] px-2 py-0.5 rounded font-semibold"
                                style={{
                                  background: canAfford
                                    ? '#4ade8022'
                                    : '#ffffff11',
                                  color: canAfford ? '#4ade80' : '#666',
                                }}
                              >
                                Instalovat
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {sh.upgradeInProgress ? (
                <div
                  className="py-2 rounded-lg text-center text-xs"
                  style={{ background: '#1a1a08', color: '#facc15' }}
                >
                  Upgrade probíhá…
                </div>
              ) : nextCost ? (
                confirmUpgrade === sh.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmUpgrade(null)}
                      className="flex-1 py-2.5 rounded-lg text-xs font-semibold"
                      style={btn.secondary()}
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={() => upgrade(sh)}
                      disabled={!canUpg}
                      className="flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={btn.action(C.green, !canUpg)}
                    >
                      Potvrdit upgrade
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmUpgrade(sh.id)}
                    disabled={!canUpg}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    style={btn.action(C.green, !canUpg)}
                  >
                    <TrendingUp size={12} /> Upgrade na {sh.level + 1}
                    <span className="flex items-center gap-0.5 ml-1">
                      <Coins size={11} color={C.green} />
                      {nextCost.money}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Eye size={11} color={C.blue} />
                      {nextCost.intel}
                    </span>
                  </button>
                )
              ) : (
                <p
                  className="text-center text-xs py-2"
                  style={{ color: '#888' }}
                >
                  Max level
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Division assignment modal */}
      {assigningTo &&
        (() => {
          const sh = houses.find((h) => h.id === assigningTo);
          if (!sh) return null;
          const assignCost = DIVISION_ASSIGN_BASE_COST * (sh.index ?? 1);
          const canPay = currencies.money >= assignCost;
          const available = (unlockedDivisions as DivisionId[]).filter(
            (d) => !sh.assignedDivisions.includes(d),
          );
          return (
            <div style={modalOverlay}>
              <div style={modalSheet}>
                <div className="flex justify-center pt-3 pb-1">
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ background: '#999' }}
                  />
                </div>
                <div className="px-4 pt-2 pb-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p
                        className="text-xs font-medium tracking-widest uppercase mb-0.5"
                        style={{ color: '#4ade80' }}
                      >
                        Přidat divizi
                      </p>
                      <h3
                        className="text-lg font-bold"
                        style={{ color: '#e8e8e8' }}
                      >
                        {REGION_MAP.get(sh.id)?.name ?? sh.id}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setAssigningTo(null);
                        setAssignPicked(null);
                      }}
                      style={{ color: '#888' }}
                    >
                      <XCircle size={22} />
                    </button>
                  </div>

                  <div
                    className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
                    style={{ background: C.bgSurface2 }}
                  >
                    <Coins size={14} color={canPay ? C.green : C.red} />
                    <span
                      className="text-sm font-bold"
                      style={{ color: canPay ? C.green : C.red }}
                    >
                      {assignCost}
                    </span>
                    <span className="text-xs" style={{ color: '#888' }}>
                      / {currencies.money}
                    </span>
                  </div>

                  {available.length === 0 ? (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: '#888' }}
                    >
                      Všechny odemčené divize jsou přiřazeny.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 mb-4">
                      {available.map((divId) => {
                        const div = DIVISIONS.find((d) => d.id === divId);
                        if (!div) return null;
                        const sel = assignPicked === divId;
                        return (
                          <button
                            key={divId}
                            onClick={() => setAssignPicked(divId)}
                            className="flex items-center gap-3 p-3 rounded-xl text-left w-full"
                            style={sel ? { ...cardActive } : { ...cardBase }}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${div.color}22` }}
                            >
                              <ShieldCheck size={14} color={div.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium"
                                style={{
                                  color: sel ? div.color : '#e8e8e8',
                                }}
                              >
                                {div.name}
                              </p>
                              <p
                                className="text-xs truncate"
                                style={{ color: '#888' }}
                              >
                                {div.description}
                              </p>
                            </div>
                            {sel && <span style={{ color: div.color }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setAssigningTo(null);
                        setAssignPicked(null);
                      }}
                      className="flex-1 py-3 rounded-xl text-sm font-medium"
                      style={btn.secondary()}
                    >
                      Zrušit
                    </button>
                    {available.length > 0 && (
                      <button
                        onClick={() =>
                          assignPicked && assignDivision(sh, assignPicked)
                        }
                        disabled={!assignPicked || !canPay}
                        className="flex-1 py-3 rounded-xl font-bold text-sm"
                        style={btn.action(C.green, !(assignPicked && canPay))}
                      >
                        Přiřadit divizi
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
