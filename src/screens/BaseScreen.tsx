import { useCallback, useEffect, useState } from 'react';
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
  Building2,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  Ghost,
  House,
  Lock,
  Map,
  Package,
  Radio,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  Agent,
  SafeHouse,
  RecruitmentPool,
  RecruitmentOffer,
  Mission,
} from '../db/schema';
import type { DivisionId, AgentRank } from '../data/agentTypes';
import { AGENT_TYPES, DIVISIONS } from '../data/agentTypes';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';
import type { Equipment } from '../data/equipmentCatalog';
import { REGION_MAP } from '../data/regions';
import { COUNTRY_MAP } from '../data/countries';
import {
  SAFE_HOUSE_CAPACITY,
  SAFE_HOUSE_UPGRADE_COSTS,
  SAFE_HOUSE_UPGRADE_DURATION,
  SAFE_HOUSE_DIVISION_SLOTS,
  DIVISION_UNLOCK_COSTS,
  DIVISION_LEVEL_COSTS,
  DIVISION_ASSIGN_BASE_COST,
  RECRUITMENT_REFRESH_COST,
  MODULE_CATALOG,
  MODULE_MAX_PER_SAFEHOUSE,
} from '../data/costs';
import {
  generateRecruitmentPool,
  generateRecruitmentOffer,
  XP_TO_RANK,
  applyEquipmentBonuses,
} from '../engine/agentGenerator';
import {
  generateBlackMarketOffer,
  needsRefresh,
  isSpecialAgentListing,
  isExpansionSkipListing,
  parseSpecialAgentListing,
} from '../engine/blackMarket';
import { getAvailableExpansions } from '../engine/mapGenerator';
import { mulberry32, randomId } from '../utils/rng';
import { useGameStore } from '../store/gameStore';
import { useMissionStore } from '../store/missionStore';
import { useUIStore } from '../store/uiStore';
import {
  calculateSafeHouseIncome,
  calculateSafeHouseBreakdown,
} from '../engine/passiveIncome';

// ─────────────────────────────────────────────
// Types & tabs
// ─────────────────────────────────────────────

type Tab = 'recruit' | 'safehouse' | 'divisions' | 'shop' | 'blackmarket';

const TABS: { id: Tab; label: string }[] = [
  { id: 'recruit', label: 'Nábor' },
  { id: 'safehouse', label: 'Safe House' },
  { id: 'divisions', label: 'Divize' },
  { id: 'shop', label: 'Obchod' },
  { id: 'blackmarket', label: 'Černý trh' },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  legendary: '#f59e0b',
};

const RARITY_LABEL: Record<string, string> = {
  common: 'Běžný',
  uncommon: 'Neobvyklý',
  rare: 'Vzácný',
  legendary: 'Legendární',
};

const RANK_LABEL: Record<AgentRank, string> = {
  recruit: 'Rekrut',
  operative: 'Agent',
  specialist: 'Specialista',
  veteran: 'Veterán',
};

function divColor(div: string) {
  return DIVISIONS.find((d) => d.id === div)?.color ?? '#4ade80';
}
function divName(div: string) {
  return DIVISIONS.find((d) => d.id === div)?.name ?? div;
}

function regionDisplayName(shId: string): string {
  const region = REGION_MAP.get(shId);
  if (!region) return shId;
  const country = COUNTRY_MAP.get(region.countryId);
  return `${region.name}${country ? `, ${country.name}` : ''}`;
}

function inferDiv(typeId: string): DivisionId {
  return AGENT_TYPES.find((t) => t.id === typeId)?.division ?? 'surveillance';
}

// ─────────────────────────────────────────────
// Recruitment tab
// ─────────────────────────────────────────────

function RecruitmentTab() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const unlockedDivisions = useGameStore((s) => s.unlockedDivisions);
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);
  const currentRegionId = selectedRegionId ?? startCityId;

  const [safeHouses, setSafeHouses] = useState<SafeHouse[]>([]);
  const [pools, setPools] = useState<RecruitmentPool[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hiring, setHiring] = useState<string | null>(null);

  const load = useCallback(async () => {
    const allShs = await db.safeHouses.toArray();
    const shs = allShs.filter((sh) => sh.id === currentRegionId);
    const ps = await db.recruitmentPools.toArray();
    setSafeHouses(shs);
    setPools(ps);
    // Auto-refresh expired recruitment pools for current SH
    const now = Date.now();
    for (const pool of ps.filter((p) =>
      shs.some((sh) => sh.id === p.safeHouseId),
    )) {
      if (pool.refreshesAt < now) {
        const sh = shs.find((s) => s.id === pool.safeHouseId);
        if (sh) {
          const newPool = generateRecruitmentPool(
            sh.id,
            unlockedDivisions as DivisionId[],
            sh.level,
            3,
          );
          await db.recruitmentPools.put(newPool);
        }
      }
    }
    const c: Record<string, number> = {};
    for (const sh of shs)
      c[sh.id] = await db.agents.where('safeHouseId').equals(sh.id).count();
    setCounts(c);
  }, [unlockedDivisions, currentRegionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh: check every 30s if any pool has expired and reload
  useEffect(() => {
    const id = setInterval(() => {
      const expired = pools.some((p) => p.refreshesAt <= Date.now());
      if (expired) load();
    }, 30_000);
    return () => clearInterval(id);
  }, [pools, load]);

  async function hire(offer: RecruitmentOffer, shId: string) {
    if (hiring) return;
    const sh = safeHouses.find((s) => s.id === shId);
    if (!sh) return;
    if ((counts[shId] ?? 0) >= (SAFE_HOUSE_CAPACITY[sh.level] ?? 3)) return;
    if (!spendCurrencies({ money: offer.cost })) return;
    setHiring(offer.id);

    await db.agents.add({
      id: offer.id,
      name: offer.name,
      typeId: offer.agentTypeId,
      division: inferDiv(offer.agentTypeId),
      rank: offer.rank,
      stats: offer.stats,
      baseStats: offer.stats,
      xp: 0,
      xpToNextRank: XP_TO_RANK[offer.rank],
      status: 'available',
      safeHouseId: shId,
      equipment: [
        { equipmentId: null },
        { equipmentId: null },
        { equipmentId: null },
      ],
      missionsCompleted: 0,
      missionsAttempted: 0,
      recruitedAt: Date.now(),
    });

    const pool = pools.find((p) => p.safeHouseId === shId);
    if (pool)
      await db.recruitmentPools.update(shId, {
        offers: pool.offers.filter((o) => o.id !== offer.id),
      });

    setHiring(null);
    load();
  }

  async function refresh(shId: string) {
    if (!spendCurrencies({ money: RECRUITMENT_REFRESH_COST.money })) return;
    const sh = safeHouses.find((s) => s.id === shId);
    if (!sh) return;
    const p = generateRecruitmentPool(
      shId,
      unlockedDivisions as DivisionId[],
      sh.level,
      3,
    );
    await db.recruitmentPools.put(p);
    load();
  }

  if (!safeHouses.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <Building2 size={40} style={{ color: '#777777' }} />
        <p className="text-sm" style={{ color: '#888' }}>
          Žádné safe housy
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      {safeHouses.map((sh) => {
        const pool = pools.find((p) => p.safeHouseId === sh.id);
        const count = counts[sh.id] ?? 0;
        const cap = SAFE_HOUSE_CAPACITY[sh.level] ?? 3;
        const full = count >= cap;

        return (
          <div key={sh.id}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
                {regionDisplayName(sh.id)} ·{' '}
                <span style={{ color: full ? '#ef4444' : '#4ade80' }}>
                  {count}/{cap}
                </span>
              </p>
              <button
                onClick={() => refresh(sh.id)}
                disabled={currencies.money < RECRUITMENT_REFRESH_COST.money}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  ...btn.secondary(),
                  opacity:
                    currencies.money < RECRUITMENT_REFRESH_COST.money ? 0.5 : 1,
                }}
              >
                <RefreshCcw size={11} /> <Coins size={11} color={C.green} />
                {RECRUITMENT_REFRESH_COST.money}
              </button>
            </div>

            {pool?.offers.filter((o) => o.expiresAt > Date.now()).length ? (
              <div className="flex flex-col gap-2">
                {pool.offers
                  .filter((o) => o.expiresAt > Date.now())
                  .map((o) => {
                    const c = divColor(inferDiv(o.agentTypeId));
                    const avg = Math.round(
                      (o.stats.stealth +
                        o.stats.combat +
                        o.stats.intel +
                        o.stats.tech) /
                        4,
                    );
                    const ok = currencies.money >= o.cost && !full;

                    return (
                      <div
                        key={o.id}
                        className="rounded-xl p-3 flex items-center gap-3"
                        style={cardBase}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                          style={{
                            background: `${c}22`,
                            color: c,
                            fontSize: 13,
                          }}
                        >
                          {o.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: '#e8e8e8' }}
                          >
                            {o.name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: `${c}22`, color: c }}
                            >
                              {divName(inferDiv(o.agentTypeId))}
                            </span>
                            <span className="text-xs" style={{ color: '#999' }}>
                              {AGENT_TYPES.find((t) => t.id === o.agentTypeId)
                                ?.name ?? o.agentTypeId}
                            </span>
                            <span className="text-xs" style={{ color: '#777' }}>
                              ·
                            </span>
                            <span className="text-xs" style={{ color: '#888' }}>
                              {RANK_LABEL[o.rank]} · avg {avg}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => hire(o, sh.id)}
                          disabled={!ok || hiring === o.id}
                          className="px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                          style={btn.action(C.green, !ok)}
                        >
                          <Coins size={11} color={C.green} />
                          {o.cost}
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <button
                onClick={() => refresh(sh.id)}
                className="w-full py-5 rounded-xl flex flex-col items-center gap-1.5"
                style={{
                  background: C.bgSurface,
                }}
              >
                <Users size={22} style={{ color: C.textDisabled }} />
                <p className="text-xs" style={{ color: '#888' }}>
                  Klepni pro obnovení
                </p>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Safe House tab
// ─────────────────────────────────────────────

function SafeHouseTab() {
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
    await db.safeHouses.update(sh.id, {
      upgradeInProgress: true,
      upgradeCompletesAt: Date.now() + dur * 1000,
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
    // Unlock any chain missions waiting for this division
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
    // Regenerate mission pool immediately with the new division biases
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
                    // Find the next level that unlocks a new slot
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

              {/* ── Passive income breakdown ── */}
              {(() => {
                const shAgents = agentsMap[sh.id] ?? [];
                const divLevels = divisionLevels as Record<
                  import('../data/agentTypes').DivisionId,
                  number
                >;
                const bd = calculateSafeHouseBreakdown(sh, divLevels, shAgents);
                const net = calculateSafeHouseIncome(sh, divLevels, shAgents);

                const CurrencyLine = ({
                  money,
                  intel,
                  shadow,
                  influence,
                }: {
                  money: number;
                  intel: number;
                  shadow: number;
                  influence: number;
                }) => (
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

                const hasAny =
                  bd.divisions.length > 0 ||
                  bd.modules.length > 0 ||
                  bd.salaries.length > 0;
                if (!hasAny) return null;

                return (
                  <div
                    className="mb-3 rounded-lg overflow-hidden"
                    style={{
                      background: C.bgBase,
                    }}
                  >
                    {/* Header */}
                    <div className="px-3 pt-2.5 pb-1.5">
                      <p
                        className="text-[10px] uppercase tracking-widest font-semibold"
                        style={{ color: '#666666' }}
                      >
                        Příjmy a výdaje / tick
                      </p>
                    </div>

                    <div className="px-3 py-2 flex flex-col gap-1.5">
                      {/* Division income */}
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

                      {/* Module bonuses */}
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

                      {/* Salaries */}
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

                      {/* Upkeep */}
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

                      {/* Net */}
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
                        <CurrencyLine {...net} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Modules ── */}
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
                              style={{
                                color: '#888',
                              }}
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
                              className="text-[10px] truncate"
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
                  style={{
                    background: '#1a1a08',
                    color: '#facc15',
                  }}
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
                                style={{ color: sel ? div.color : '#e8e8e8' }}
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

// ─────────────────────────────────────────────
// Divisions tab
// ─────────────────────────────────────────────

function DivisionsTab() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const unlocked = useGameStore((s) => s.unlockedDivisions);
  const levels = useGameStore((s) => s.divisionLevels);
  const unlockDivision = useGameStore((s) => s.unlockDivision);
  const upgradeDivision = useGameStore((s) => s.upgradeDivision);
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);
  const showToast = useUIStore((s) => s.showToast);
  const invalidateRegionMissions = useMissionStore(
    (s) => s.invalidateRegionMissions,
  );

  async function doUnlock(id: DivisionId) {
    const cost = DIVISION_UNLOCK_COSTS[id];
    if (!cost) return;
    if (
      !spendCurrencies({
        money: cost.money,
        intel: cost.intel,
        shadow: cost.shadow,
      })
    )
      return;
    unlockDivision(id);

    // Auto-assign to the current safe house if it has a free slot,
    // so players with a single city don't need a separate paid step.
    const currentRegionId = selectedRegionId ?? startCityId;
    const sh = await db.safeHouses.get(currentRegionId);
    if (
      sh &&
      !sh.constructionInProgress &&
      !sh.assignedDivisions.includes(id) &&
      sh.assignedDivisions.length < (SAFE_HOUSE_DIVISION_SLOTS[sh.level] ?? 2)
    ) {
      await db.safeHouses.update(sh.id, {
        assignedDivisions: [...sh.assignedDivisions, id],
      });
      // Unlock any chain missions waiting for this division
      const region = await db.regions.get(sh.id);
      const missionIds = region?.availableMissionIds ?? [];
      if (missionIds.length) {
        const allMissions = (await db.missions.bulkGet(missionIds)).filter(
          Boolean,
        ) as Mission[];
        const toUnlock = allMissions.filter((m) => m.lockedByDivision === id);
        for (const m of toUnlock) {
          await db.missions.update(m.id, { lockedByDivision: undefined });
        }
      }
      invalidateRegionMissions(sh.id);
      const divName = DIVISIONS.find((d) => d.id === id)?.name ?? id;
      showToast(
        'success',
        `${divName} přiřazena do ${sh.id === startCityId ? 'domovské základny' : sh.id}`,
      );
    }
  }

  function doUpgrade(id: DivisionId) {
    const lv = levels[id] ?? 1;
    if (lv >= 3) return;
    const cost = DIVISION_LEVEL_COSTS[lv + 1];
    if (!cost) return;
    if (
      spendCurrencies({
        money: cost.money,
        intel: cost.intel,
        influence: cost.influence,
      })
    )
      upgradeDivision(id);
  }

  return (
    <div className="flex flex-col gap-2">
      {DIVISIONS.map((div) => {
        const isOn = unlocked.includes(div.id);
        const lv = levels[div.id] ?? 0;
        const uc = DIVISION_UNLOCK_COSTS[div.id];
        const isFree = uc?.money === 0 && uc?.intel === 0 && uc?.shadow === 0;
        const upgC = isOn && lv < 3 ? DIVISION_LEVEL_COSTS[lv + 1] : null;
        const canU =
          !isOn &&
          !isFree &&
          uc &&
          currencies.money >= uc.money &&
          currencies.intel >= uc.intel &&
          currencies.shadow >= (uc.shadow ?? 0);
        const canUpg =
          isOn &&
          upgC &&
          currencies.money >= upgC.money &&
          currencies.intel >= upgC.intel &&
          currencies.influence >= (upgC.influence ?? 0);

        return (
          <div
            key={div.id}
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ ...cardBase, opacity: isOn || canU ? 1 : 0.6 }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: isOn ? `${div.color}22` : '#666666' }}
            >
              <ShieldCheck size={15} color={isOn ? div.color : '#777'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-sm font-medium"
                  style={{ color: isOn ? '#e8e8e8' : '#888' }}
                >
                  {div.name}
                </p>
                {isOn && (
                  <span className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: i < lv ? div.color : '#777777' }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: '#888' }}>
                {div.description}
              </p>
            </div>

            {!isOn ? (
              isFree ? (
                <span
                  className="text-xs px-2 py-1 rounded flex-shrink-0"
                  style={{ background: '#666666', color: '#888' }}
                >
                  Starter
                </span>
              ) : (
                <button
                  onClick={() => doUnlock(div.id)}
                  disabled={!canU}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0"
                  style={btn.action(div.color as string, !canU)}
                >
                  <span style={{ color: '#4ade80' }}>$</span>
                  {uc?.money}
                </button>
              )
            ) : lv < 3 && upgC ? (
              <button
                onClick={() => doUpgrade(div.id)}
                disabled={!canUpg}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0"
                style={btn.action(div.color as string, !canUpg)}
              >
                ↑ Lv{lv + 1}
              </button>
            ) : (
              <span
                className="text-xs flex-shrink-0"
                style={{ color: div.color }}
              >
                {lv >= 3 ? 'MAX' : 'Aktivní'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Shop helpers
// ─────────────────────────────────────────────

const SHOP_ROTATION_MS = 60 * 60 * 1000; // 1 hour

function currentShopSeed() {
  return Math.floor(Date.now() / SHOP_ROTATION_MS);
}

function msToNextRotation() {
  return SHOP_ROTATION_MS - (Date.now() % SHOP_ROTATION_MS);
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Generate 6 shop items deterministically from an hourly seed.
 * Rarity tiers unlock with totalMissionsCompleted:
 *   0–9:  common + uncommon
 *  10–29: +rare (25% chance per slot)
 *  30+:  +legendary via black market (8% per slot, only if bm unlocked)
 */
function generateShopItems(
  seed: number,
  totalMissions: number,
  blackMarketUnlocked: boolean,
): Equipment[] {
  const rng = mulberry32(seed);
  const pools = {
    common: EQUIPMENT_CATALOG.filter(
      (e) => e.rarity === 'common' && !e.isBlackMarket,
    ),
    uncommon: EQUIPMENT_CATALOG.filter(
      (e) => e.rarity === 'uncommon' && !e.isBlackMarket,
    ),
    rare: EQUIPMENT_CATALOG.filter(
      (e) => e.rarity === 'rare' && !e.isBlackMarket,
    ),
    legendary: EQUIPMENT_CATALOG.filter((e) => e.rarity === 'legendary'),
  };
  const used = new Set<string>();
  const result: Equipment[] = [];

  for (let i = 0; i < 6; i++) {
    const r = rng();
    let pool: Equipment[];

    if (blackMarketUnlocked && totalMissions >= 30 && r < 0.08) {
      pool = pools.legendary.filter((e) => !used.has(e.id));
    } else if (totalMissions >= 10 && r < 0.25) {
      pool = pools.rare.filter((e) => !used.has(e.id));
    } else if (r < 0.55) {
      pool = pools.uncommon.filter((e) => !used.has(e.id));
    } else {
      pool = pools.common.filter((e) => !used.has(e.id));
    }

    if (pool.length === 0)
      pool = [...pools.common, ...pools.uncommon].filter(
        (e) => !used.has(e.id),
      );

    if (pool.length > 0) {
      const item = pool[Math.floor(rng() * pool.length)];
      result.push(item);
      used.add(item.id);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Shop tab
// ─────────────────────────────────────────────

function ShopTab() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const totalMissions = useGameStore((s) => s.totalMissionsCompleted);
  const blackMarketUnlocked = useGameStore((s) => s.blackMarketUnlocked);

  const [shopSeed, setShopSeed] = useState(currentShopSeed);
  const [countdown, setCountdown] = useState(msToNextRotation);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [buying, setBuying] = useState<Equipment | null>(null);
  const [notif, setNotif] = useState('');

  // Tick every second — update countdown and detect hour roll-over
  useEffect(() => {
    const id = setInterval(() => {
      const newSeed = currentShopSeed();
      if (newSeed !== shopSeed) setShopSeed(newSeed);
      setCountdown(msToNextRotation());
    }, 1000);
    return () => clearInterval(id);
  }, [shopSeed]);

  useEffect(() => {
    db.agents.where('status').equals('available').toArray().then(setAgents);
  }, [buying]);

  const items = generateShopItems(shopSeed, totalMissions, blackMarketUnlocked);

  async function buyAssign(eq: Equipment, agent: Agent) {
    if (
      !spendCurrencies({
        money: eq.costMoney,
        intel: eq.costIntel,
        shadow: eq.costShadow,
        influence: eq.costInfluence,
      })
    )
      return;
    const slots = [...agent.equipment];
    const idx = slots.findIndex((s) => !s.equipmentId);
    if (idx === -1) {
      setNotif('Agent nemá volný slot');
      setBuying(null);
      return;
    }
    slots[idx] = { equipmentId: eq.id };
    const newStats = applyEquipmentBonuses(agent.baseStats, slots, agent.rank);
    await db.agents.update(agent.id, { equipment: slots, stats: newStats });
    setNotif(`${eq.name} → ${agent.name}`);
    setBuying(null);
    setTimeout(() => setNotif(''), 2500);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Rotation header */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: C.textSecondary }}>
          6 položek · rotace každou hodinu
        </p>
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ background: C.bgSurface2, color: C.textSecondary }}
        >
          <Clock size={11} />
          {formatCountdown(countdown)}
        </div>
      </div>

      {/* Tier hint */}
      {totalMissions < 10 && (
        <p className="text-xs" style={{ color: C.textMuted }}>
          Na rare itemy potřebuješ 10+ splněných misí · legendary 30+ misí +
          černý trh
        </p>
      )}

      {notif && (
        <div
          className="rounded-xl p-2.5 text-sm text-center"
          style={{ background: C.bgSurface2, color: C.green }}
        >
          {notif}
        </div>
      )}

      {items.map((eq) => {
        const rc = RARITY_COLOR[eq.rarity] ?? C.textSecondary;
        const canBuy =
          currencies.money >= eq.costMoney &&
          (!eq.costIntel || currencies.intel >= (eq.costIntel ?? 0)) &&
          (!eq.costShadow || currencies.shadow >= (eq.costShadow ?? 0)) &&
          (!eq.costInfluence ||
            currencies.influence >= (eq.costInfluence ?? 0));

        return (
          <div
            key={eq.id}
            className="rounded-xl p-3 flex items-start gap-3"
            style={cardBase}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${rc}22` }}
            >
              <Package size={18} style={{ color: rc }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p
                  className="text-sm font-medium"
                  style={{ color: C.textPrimary }}
                >
                  {eq.name}
                </p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: `${rc}22`, color: rc }}
                >
                  {RARITY_LABEL[eq.rarity] ?? eq.rarity}
                </span>
              </div>
              <p
                className="text-xs line-clamp-1 mb-1"
                style={{ color: C.textSecondary }}
              >
                {eq.description}
              </p>
              {eq.minRank && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded inline-block mb-1"
                  style={{
                    background: `${C.divExtraction}18`,
                    color: C.divExtraction,
                  }}
                >
                  Vyžaduje {RANK_LABEL[eq.minRank]}
                </span>
              )}
              {eq.requiredDivision && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded inline-block mb-1 ml-1"
                  style={{ background: `${C.blue}18`, color: C.blue }}
                >
                  {divName(eq.requiredDivision)}
                </span>
              )}
              <div
                className="flex gap-2 flex-wrap text-xs"
                style={{ color: C.textSecondary }}
              >
                {eq.bonusStealth ? (
                  <span>+{eq.bonusStealth} Stealth</span>
                ) : null}
                {eq.bonusCombat ? <span>+{eq.bonusCombat} Combat</span> : null}
                {eq.bonusIntel ? <span>+{eq.bonusIntel} Intel</span> : null}
                {eq.bonusTech ? <span>+{eq.bonusTech} Tech</span> : null}
                {eq.successBonus ? (
                  <span>+{eq.successBonus}% šance</span>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => canBuy && setBuying(eq)}
              disabled={!canBuy}
              className="px-2 py-2 rounded-lg text-xs font-semibold flex-shrink-0 flex items-center gap-1.5"
              style={btn.action(C.green, !canBuy)}
            >
              {eq.costMoney > 0 && (
                <span className="flex items-center gap-0.5">
                  <Coins
                    size={10}
                    style={{ color: canBuy ? C.green : 'inherit' }}
                  />
                  {eq.costMoney}
                </span>
              )}
              {eq.costIntel ? (
                <span className="flex items-center gap-0.5">
                  <Eye
                    size={10}
                    style={{ color: canBuy ? C.blue : 'inherit' }}
                  />
                  {eq.costIntel}
                </span>
              ) : null}
              {eq.costShadow ? (
                <span className="flex items-center gap-0.5">
                  <Ghost
                    size={10}
                    style={{ color: canBuy ? C.bm : 'inherit' }}
                  />
                  {eq.costShadow}
                </span>
              ) : null}
              {eq.costInfluence ? (
                <span className="flex items-center gap-0.5">
                  <Radio
                    size={10}
                    style={{ color: canBuy ? C.divExtraction : 'inherit' }}
                  />
                  {eq.costInfluence}
                </span>
              ) : null}
            </button>
          </div>
        );
      })}

      {/* Agent picker */}
      {buying && (
        <div style={modalOverlay}>
          <div style={modalSheet}>
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: '#999' }}
              />
            </div>
            <div className="px-4 pt-2 pb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p
                    className="text-xs tracking-widest uppercase"
                    style={{ color: '#888' }}
                  >
                    Přiřadit
                  </p>
                  <h3
                    className="text-base font-bold"
                    style={{ color: '#e8e8e8' }}
                  >
                    {buying.name}
                  </h3>
                </div>
                <button
                  onClick={() => setBuying(null)}
                  style={{ color: '#888' }}
                >
                  <XCircle size={22} />
                </button>
              </div>
              {agents.length === 0 ? (
                <p
                  className="text-sm text-center py-6"
                  style={{ color: '#888' }}
                >
                  Žádní volní agenti
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {agents.map((a) => {
                    const has = a.equipment.some((s) => !s.equipmentId);
                    return (
                      <button
                        key={a.id}
                        onClick={() => has && buyAssign(buying, a)}
                        disabled={!has}
                        className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{
                          ...cardBase,
                          opacity: has ? 1 : 0.4,
                          cursor: has ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{
                            background: `${divColor(a.division)}22`,
                            color: divColor(a.division),
                          }}
                        >
                          {a.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <p
                            className="text-sm font-medium"
                            style={{ color: '#e8e8e8' }}
                          >
                            {a.name}
                          </p>
                          <p className="text-xs" style={{ color: '#999' }}>
                            {has ? 'Volný slot' : 'Plné vybavení'}
                          </p>
                        </div>
                        {has && (
                          <ChevronRight size={13} style={{ color: '#777' }} />
                        )}
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
  );
}

// ─────────────────────────────────────────────
// Black Market Tab
// ─────────────────────────────────────────────

function BlackMarketTab() {
  const blackMarketUnlocked = useGameStore((s) => s.blackMarketUnlocked);
  const totalMissions = useGameStore((s) => s.totalMissionsCompleted);
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);

  const [offer, setOffer] = useState<import('../db/schema').BlackMarket | null>(
    null,
  );
  const [countdown, setCountdown] = useState(0);
  const [buying, setBuying] = useState<
    import('../db/schema').BlackMarketListing | null
  >(null);
  const [pendingAgentListing, setPendingAgentListing] = useState<{
    listing: import('../db/schema').BlackMarketListing;
    division: string;
    rank: 'specialist' | 'veteran';
    agentName: string;
    agentStats: import('../db/schema').AgentStats;
    agentTypeId: string;
  } | null>(null);
  const [safeHouses, setSafeHouses] = useState<SafeHouse[]>([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [notif, setNotif] = useState('');
  const [pendingExpansionSkip, setPendingExpansionSkip] = useState<
    import('../db/schema').BlackMarketListing | null
  >(null);
  const [availableExpansions, setAvailableExpansions] = useState<
    import('../db/schema').RegionState[]
  >([]);
  const unlockedDivisions = useGameStore((s) => s.unlockedDivisions);

  // Load or generate BM offer
  const loadOffer = useCallback(async () => {
    let bm = await db.blackMarket.get(1);
    if (!bm || needsRefresh(bm)) {
      bm = generateBlackMarketOffer();
      await db.blackMarket.put(bm);
    }
    setOffer(bm);
    const shs = await db.safeHouses.toArray();
    setSafeHouses(shs);
    const counts: Record<string, number> = {};
    for (const sh of shs)
      counts[sh.id] = await db.agents
        .where('safeHouseId')
        .equals(sh.id)
        .count();
    setAgentCounts(counts);
  }, []);

  useEffect(() => {
    if (blackMarketUnlocked) loadOffer();
  }, [blackMarketUnlocked, loadOffer]);

  // Countdown timer
  useEffect(() => {
    if (!offer) return;
    const tick = () =>
      setCountdown(Math.max(0, offer.refreshesAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offer]);

  const fmtCountdown = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  async function buyListing(
    listing: import('../db/schema').BlackMarketListing,
  ) {
    if (isExpansionSkipListing(listing.equipmentId)) {
      // Load available expansion targets and show picker
      const allRegions = await db.regions.toArray();
      const ownedIds = allRegions.filter((r) => r.owned).map((r) => r.id);
      const expansionIds = getAvailableExpansions(ownedIds, allRegions);
      const expansionRegions = allRegions.filter((r) =>
        expansionIds.includes(r.id),
      );
      if (expansionRegions.length === 0) {
        setNotif('Žádné dostupné regiony k expanzi');
        setTimeout(() => setNotif(''), 2500);
        return;
      }
      setAvailableExpansions(expansionRegions);
      setPendingExpansionSkip(listing);
      return;
    }

    if (isSpecialAgentListing(listing.equipmentId)) {
      const parsed = parseSpecialAgentListing(listing.equipmentId);
      if (!parsed || safeHouses.length === 0) return;
      // Don't charge yet — charge when the player picks a safe house
      const offer2 = generateRecruitmentOffer(parsed.division, 5);
      setPendingAgentListing({
        listing,
        division: parsed.division,
        rank: parsed.rank,
        agentName: offer2.name,
        agentStats: offer2.stats,
        agentTypeId: offer2.agentTypeId,
      });
      return;
    }

    // Equipment listing — pick an agent
    setBuying(listing);
  }

  async function doExpansionSkip(regionId: string) {
    const listing = pendingExpansionSkip!;
    setPendingExpansionSkip(null);
    if (
      !spendCurrencies({
        shadow: listing.costShadow,
        influence: listing.costInfluence,
        money: listing.costMoney ?? 0,
      })
    ) {
      setNotif('Nedostatek zdrojů');
      setTimeout(() => setNotif(''), 2000);
      return;
    }
    const allRegions = await db.regions.toArray();
    const ownedCount = allRegions.filter((r) => r.owned).length;
    const pickedDiv = (unlockedDivisions[0] ??
      'surveillance') as import('../data/agentTypes').DivisionId;
    const now = Date.now();
    const existing = await db.safeHouses.get(regionId);
    if (existing) {
      await db.safeHouses.update(regionId, {
        constructionInProgress: true,
        constructionCompletesAt: now - 1,
      });
    } else {
      await db.safeHouses.add({
        id: regionId,
        regionId,
        level: 1,
        index: ownedCount + 1,
        assignedDivisions: [pickedDiv],
        modules: [],
        constructionInProgress: true,
        constructionCompletesAt: now - 1,
        createdAt: now,
      });
    }
    await db.regions.update(regionId, {
      constructionInProgress: true,
      constructionCompletesAt: now - 1,
    });
    setNotif('Expanze zahájena — dokončí se za moment');
    setTimeout(() => setNotif(''), 3500);
  }

  async function assignToAgent(
    agent: Agent,
    listing: import('../db/schema').BlackMarketListing,
  ) {
    const eq = EQUIPMENT_CATALOG.find((e) => e.id === listing.equipmentId);
    if (!eq) return;
    const slots = [...agent.equipment];
    const idx = slots.findIndex((s) => !s.equipmentId);
    if (idx === -1) return;
    if (
      !spendCurrencies({
        shadow: listing.costShadow,
        influence: listing.costInfluence,
        money: listing.costMoney ?? 0,
      })
    ) {
      setNotif('Nedostatek zdrojů');
      setTimeout(() => setNotif(''), 2000);
      setBuying(null);
      return;
    }
    slots[idx] = { equipmentId: eq.id };
    const newStats = applyEquipmentBonuses(agent.baseStats, slots, agent.rank);
    await db.agents.update(agent.id, { equipment: slots, stats: newStats });
    setBuying(null);
    setNotif(`${eq.name} → ${agent.name}`);
    setTimeout(() => setNotif(''), 2500);
  }

  if (!blackMarketUnlocked) {
    const remaining = Math.max(0, 15 - totalMissions);
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-16 text-center px-6">
        <Lock size={40} style={{ color: C.textMuted }} />
        <p className="text-base font-semibold" style={{ color: C.textPrimary }}>
          Černý trh uzamčen
        </p>
        <p className="text-sm" style={{ color: '#888' }}>
          {remaining > 0
            ? `Dokončete ještě ${remaining} misi${remaining === 1 ? '' : remaining < 5 ? 'e' : 'í'} k odemčení.`
            : 'Dokončete další misi k odemčení.'}
        </p>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex items-center justify-center pt-16">
        <p className="text-sm" style={{ color: '#888' }}>
          Načítám...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-sm font-semibold" style={{ color: C.bm }}>
            Černý trh
          </p>
          <p className="text-xs" style={{ color: C.textSecondary }}>
            Exkluzivní vybavení a agenti
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ background: C.bgSurface2, color: C.bm }}
        >
          <Clock size={11} />
          {fmtCountdown(countdown)}
        </div>
      </div>

      {notif && (
        <div
          className="text-xs px-3 py-2 rounded-xl text-center"
          style={{ background: C.bgSurface2, color: C.green }}
        >
          {notif}
        </div>
      )}

      {offer.listings.map((listing, i) => {
        const isAgent = isSpecialAgentListing(listing.equipmentId);
        const isExpansion = isExpansionSkipListing(listing.equipmentId);
        const eq =
          isAgent || isExpansion
            ? null
            : EQUIPMENT_CATALOG.find((e) => e.id === listing.equipmentId);
        const rc = eq ? (RARITY_COLOR[eq.rarity] ?? '#888') : '#a855f7';

        const canAfford =
          currencies.shadow >= listing.costShadow &&
          currencies.influence >= listing.costInfluence &&
          currencies.money >= (listing.costMoney ?? 0);

        let title = '?';
        let subtitle = '';
        let rankBadge: string | null = null;
        if (isAgent) {
          const parsed = parseSpecialAgentListing(listing.equipmentId);
          title = parsed
            ? `Agent — ${DIVISIONS.find((d) => d.id === parsed.division)?.name ?? parsed.division}`
            : 'Speciální agent';
          subtitle = parsed ? `Hodnost: ${RANK_LABEL[parsed.rank]}` : '';
        } else if (isExpansion) {
          title = 'Expanzní zkratka';
          subtitle = 'Okamžité vystavení nového regionu';
        } else if (eq) {
          title = eq.name;
          subtitle = eq.description;
          if (eq.minRank) rankBadge = RANK_LABEL[eq.minRank];
        }

        return (
          <div
            key={i}
            className="rounded-xl p-3 flex gap-3 items-start"
            style={cardBase}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${rc}22` }}
            >
              {isAgent ? (
                <UserPlus size={18} style={{ color: rc }} />
              ) : isExpansion ? (
                <Map size={18} style={{ color: rc }} />
              ) : (
                <Package size={18} style={{ color: rc }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-sm font-medium" style={{ color: '#e8e8e8' }}>
                  {title}
                </p>
                {eq && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: `${rc}22`, color: rc }}
                  >
                    {RARITY_LABEL[eq.rarity] ?? eq.rarity}
                  </span>
                )}
              </div>
              <p
                className="text-xs line-clamp-1 mb-1"
                style={{ color: '#999' }}
              >
                {subtitle}
              </p>
              {rankBadge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded inline-block mb-1"
                  style={{ background: '#2e1a00', color: '#f97316' }}
                >
                  Vyžaduje {rankBadge}
                </span>
              )}
              {eq && (
                <div
                  className="flex gap-2 flex-wrap text-xs"
                  style={{ color: C.textSecondary }}
                >
                  {eq.bonusStealth ? (
                    <span>+{eq.bonusStealth} Stealth</span>
                  ) : null}
                  {eq.bonusCombat ? (
                    <span>+{eq.bonusCombat} Combat</span>
                  ) : null}
                  {eq.bonusIntel ? <span>+{eq.bonusIntel} Intel</span> : null}
                  {eq.bonusTech ? <span>+{eq.bonusTech} Tech</span> : null}
                  {eq.successBonus ? (
                    <span>+{eq.successBonus}% šance</span>
                  ) : null}
                </div>
              )}
            </div>
            <button
              onClick={() => canAfford && buyListing(listing)}
              disabled={!canAfford}
              className="px-2 py-2 rounded-lg text-xs font-semibold flex-shrink-0 flex items-center gap-1.5"
              style={btn.action(C.bm, !canAfford)}
            >
              {listing.costShadow > 0 && (
                <span className="flex items-center gap-0.5">
                  <Ghost
                    size={10}
                    style={{ color: canAfford ? C.bm : 'inherit' }}
                  />
                  {listing.costShadow}
                </span>
              )}
              {listing.costInfluence > 0 && (
                <span className="flex items-center gap-0.5">
                  <Radio
                    size={10}
                    style={{ color: canAfford ? C.divExtraction : 'inherit' }}
                  />
                  {listing.costInfluence}
                </span>
              )}
              {(listing.costMoney ?? 0) > 0 && (
                <span className="flex items-center gap-0.5">
                  <Coins
                    size={10}
                    style={{ color: canAfford ? C.green : 'inherit' }}
                  />
                  {listing.costMoney}
                </span>
              )}
            </button>
          </div>
        );
      })}

      {/* Expansion skip picker */}
      {pendingExpansionSkip && (
        <ExpansionSkipPickerModal
          regions={availableExpansions}
          onClose={() => setPendingExpansionSkip(null)}
          onConfirm={doExpansionSkip}
        />
      )}

      {/* Agent picker modal */}
      {buying &&
        !isSpecialAgentListing(buying.equipmentId) &&
        !isExpansionSkipListing(buying.equipmentId) && (
          <AgentPickerModal
            listing={buying}
            onClose={() => setBuying(null)}
            onAssign={assignToAgent}
          />
        )}

      {/* Safe house picker for special agent listings */}
      {pendingAgentListing && (
        <SafeHousePickerModal
          pending={pendingAgentListing}
          safeHouses={safeHouses}
          agentCounts={agentCounts}
          onClose={() => setPendingAgentListing(null)}
          onConfirm={async (shId) => {
            const p = pendingAgentListing;
            setPendingAgentListing(null);
            if (
              !spendCurrencies({
                shadow: p.listing.costShadow,
                influence: p.listing.costInfluence,
                money: p.listing.costMoney ?? 0,
              })
            ) {
              setNotif('Nedostatek zdrojů');
              setTimeout(() => setNotif(''), 2000);
              return;
            }
            await db.agents.add({
              id: randomId(),
              name: p.agentName,
              typeId: p.agentTypeId,
              division: p.division as import('../data/agentTypes').DivisionId,
              rank: p.rank,
              stats: p.agentStats,
              baseStats: p.agentStats,
              xp: 0,
              xpToNextRank: XP_TO_RANK[p.rank],
              status: 'available',
              safeHouseId: shId,
              equipment: [
                { equipmentId: null },
                { equipmentId: null },
                { equipmentId: null },
              ],
              missionsCompleted: 0,
              missionsAttempted: 0,
              recruitedAt: Date.now(),
            });
            setNotif(`Agent ${p.agentName} přijat`);
            setTimeout(() => setNotif(''), 2500);
            loadOffer(); // refresh counts
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Expansion skip — region picker modal
// ─────────────────────────────────────────────

function ExpansionSkipPickerModal({
  regions,
  onClose,
  onConfirm,
}: {
  regions: import('../db/schema').RegionState[];
  onClose: () => void;
  onConfirm: (regionId: string) => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modalSheet}>
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: C.borderStrong }}
          />
        </div>
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-1">
            <p
              className="text-sm font-semibold"
              style={{ color: C.textPrimary }}
            >
              Kam expandovat?
            </p>
            <button onClick={onClose} style={{ color: C.textSecondary }}>
              <XCircle size={20} />
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: C.textSecondary }}>
            Region bude okamžitě připraven k provozu.
          </p>
          <div className="flex flex-col gap-2">
            {regions.map((r) => (
              <button
                key={r.id}
                onClick={() => onConfirm(r.id)}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={cardBase}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: `${C.bm}22`, color: C.bm }}
                >
                  {regionDisplayName(r.id).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p
                    className="text-sm font-medium"
                    style={{ color: C.textPrimary }}
                  >
                    {regionDisplayName(r.id)}
                  </p>
                  <p className="text-xs" style={{ color: C.textSecondary }}>
                    Vzdálenost {r.distanceFromStart}
                  </p>
                </div>
                <ChevronRight size={13} style={{ color: C.textMuted }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const RANK_NUM: Record<AgentRank, number> = {
  recruit: 0,
  operative: 1,
  specialist: 2,
  veteran: 3,
};

function AgentPickerModal({
  listing,
  onClose,
  onAssign,
}: {
  listing: import('../db/schema').BlackMarketListing;
  onClose: () => void;
  onAssign: (
    agent: Agent,
    listing: import('../db/schema').BlackMarketListing,
  ) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    db.agents
      .toArray()
      .then((all) =>
        setAgents(
          all.filter(
            (a) =>
              a.status === 'available' &&
              a.equipment.some((s) => !s.equipmentId),
          ),
        ),
      );
  }, []);

  const eq = EQUIPMENT_CATALOG.find((e) => e.id === listing.equipmentId);
  const minRank = eq?.minRank;

  const isEligible = (a: Agent) =>
    !minRank || RANK_NUM[a.rank] >= RANK_NUM[minRank];

  const sorted = [...agents].sort((a, b) => {
    const ea = isEligible(a) ? 0 : 1;
    const eb = isEligible(b) ? 0 : 1;
    return ea - eb;
  });

  return (
    <div style={modalOverlay}>
      <div style={modalSheet}>
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: C.borderStrong }}
          />
        </div>
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-sm font-semibold"
              style={{ color: C.textPrimary }}
            >
              Přiřadit agentovi
            </p>
            <button onClick={onClose} style={{ color: C.textSecondary }}>
              <XCircle size={20} />
            </button>
          </div>
          {sorted.length === 0 ? (
            <p
              className="text-sm text-center py-4"
              style={{ color: C.textSecondary }}
            >
              Žádný dostupný agent s volným slotem
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((a) => {
                const eligible = isEligible(a);
                return (
                  <button
                    key={a.id}
                    onClick={eligible ? () => onAssign(a, listing) : undefined}
                    disabled={!eligible}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ ...cardBase, opacity: eligible ? 1 : 0.4 }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{
                        background: `${divColor(a.division)}22`,
                        color: divColor(a.division),
                      }}
                    >
                      {a.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className="text-sm font-medium"
                        style={{ color: C.textPrimary }}
                      >
                        {a.name}
                      </p>
                      <p className="text-xs" style={{ color: C.textSecondary }}>
                        {RANK_LABEL[a.rank]} · volný slot
                      </p>
                    </div>
                    {eligible ? (
                      <ChevronRight size={13} style={{ color: C.textMuted }} />
                    ) : (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: '#f9731622', color: '#f97316' }}
                      >
                        {RANK_LABEL[minRank!]}+
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Safe house picker for BM special agent listings
// ─────────────────────────────────────────────

function SafeHousePickerModal({
  pending,
  safeHouses,
  agentCounts,
  onClose,
  onConfirm,
}: {
  pending: {
    agentName: string;
    rank: 'specialist' | 'veteran';
    division: string;
  };
  safeHouses: SafeHouse[];
  agentCounts: Record<string, number>;
  onClose: () => void;
  onConfirm: (shId: string) => void;
}) {
  return (
    <div style={modalOverlay}>
      <div style={modalSheet}>
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: C.borderStrong }}
          />
        </div>
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-1">
            <p
              className="text-sm font-semibold"
              style={{ color: C.textPrimary }}
            >
              Kam umístit agenta?
            </p>
            <button onClick={onClose} style={{ color: C.textSecondary }}>
              <XCircle size={20} />
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: C.textSecondary }}>
            {pending.agentName} · {RANK_LABEL[pending.rank]} ·{' '}
            {DIVISIONS.find((d) => d.id === pending.division)?.name ??
              pending.division}
          </p>
          <div className="flex flex-col gap-2">
            {safeHouses.map((sh) => {
              const count = agentCounts[sh.id] ?? 0;
              const cap = SAFE_HOUSE_CAPACITY[sh.level] ?? 3;
              const full = count >= cap;
              return (
                <button
                  key={sh.id}
                  disabled={full}
                  onClick={() => !full && onConfirm(sh.id)}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    ...cardBase,
                    opacity: full ? 0.5 : 1,
                    cursor: full ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: `${C.bm}22`, color: C.bm }}
                  >
                    {regionDisplayName(sh.id).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className="text-sm font-medium"
                      style={{ color: C.textPrimary }}
                    >
                      {regionDisplayName(sh.id)}
                    </p>
                    <p className="text-xs" style={{ color: C.textSecondary }}>
                      {count}/{cap} agentů {full ? '· plno' : ''}
                    </p>
                  </div>
                  {!full && (
                    <ChevronRight size={13} style={{ color: C.textMuted }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function BaseScreen() {
  const [tab, setTab] = useState<Tab>('recruit');

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-lg font-bold tracking-tight mb-3">Základna</h1>

        {/* Currencies */}
        <div className="mb-4">
          <CurrenciesBar />
        </div>

        <CityBar />

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? C.bgSurface2 : 'transparent',
                color: tab === t.id ? C.green : C.textMuted,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-4">
        {tab === 'recruit' && <RecruitmentTab />}
        {tab === 'safehouse' && <SafeHouseTab />}
        {tab === 'divisions' && <DivisionsTab />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'blackmarket' && <BlackMarketTab />}
      </div>
    </div>
  );
}
