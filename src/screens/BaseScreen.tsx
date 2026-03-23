import { useCallback, useEffect, useState } from 'react';
import CityBar from '../components/CityBar';
import CurrenciesBar from '../components/CurrenciesBar';
import {
  Building2,
  ChevronRight,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  Agent,
  SafeHouse,
  RecruitmentPool,
  RecruitmentOffer,
} from '../db/schema';
import type { DivisionId, AgentRank } from '../data/agentTypes';
import { DIVISIONS } from '../data/agentTypes';
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
import { mulberry32, randomId } from '../utils/rng';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

// ─────────────────────────────────────────────
// Types & tabs
// ─────────────────────────────────────────────

type Tab = 'recruit' | 'safehouse' | 'divisions' | 'shop' | 'blackmarket';

const TABS: { id: Tab; label: string }[] = [
  { id: 'recruit', label: 'Nábor' },
  { id: 'safehouse', label: 'Safe House' },
  { id: 'divisions', label: 'Divize' },
  { id: 'shop', label: 'Obchod' },
  { id: 'blackmarket', label: '🕵 BM' },
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
  const found = DIVISIONS.find((d) => typeId.startsWith(d.id));
  if (found) return found.id;
  const partial = DIVISIONS.find((d) => typeId.includes(d.id.slice(0, 5)));
  return partial?.id ?? 'surveillance';
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
        <Building2 size={40} style={{ color: '#2a2a2a' }} />
        <p className="text-sm" style={{ color: '#555' }}>
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
                  background: '#111',
                  color: '#888',
                  border: '1px solid #2a2a2a',
                  opacity:
                    currencies.money < RECRUITMENT_REFRESH_COST.money ? 0.5 : 1,
                }}
              >
                <RefreshCcw size={11} />{' '}
                <span style={{ color: '#4ade80' }}>$</span>
                {RECRUITMENT_REFRESH_COST.money}
              </button>
            </div>

            {pool?.offers.length ? (
              <div className="flex flex-col gap-2">
                {pool.offers.map((o) => {
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
                      style={{
                        background: '#111',
                        border: '1px solid #2a2a2a',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                        style={{ background: `${c}22`, color: c, fontSize: 13 }}
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
                        <p className="text-xs" style={{ color: '#666' }}>
                          {o.agentTypeId} · {o.rank} · avg {avg}
                        </p>
                      </div>
                      <button
                        onClick={() => hire(o, sh.id)}
                        disabled={!ok || hiring === o.id}
                        className="px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                        style={{
                          background: ok ? '#4ade8022' : '#1a1a1a',
                          color: ok ? '#4ade80' : '#444',
                          border: `1px solid ${ok ? '#4ade8044' : '#1a1a1a'}`,
                          cursor: ok ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <span style={{ color: '#4ade80' }}>$</span>
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
                style={{ background: '#0f0f0f', border: '1px dashed #2a2a2a' }}
              >
                <Users size={22} style={{ color: '#333' }} />
                <p className="text-xs" style={{ color: '#555' }}>
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
  const unlockedDivisions = useGameStore((s) => s.unlockedDivisions);
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);
  const currentRegionId = selectedRegionId ?? startCityId;

  const [houses, setHouses] = useState<SafeHouse[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [assignPicked, setAssignPicked] = useState<DivisionId | null>(null);

  const load = useCallback(async () => {
    const allShs = await db.safeHouses.toArray();
    const shs = allShs.filter((sh) => sh.id === currentRegionId);
    setHouses(shs);
    const c: Record<string, number> = {};
    for (const sh of shs)
      c[sh.id] = await db.agents.where('safeHouseId').equals(sh.id).count();
    setCounts(c);
  }, [currentRegionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(async () => {
      const done = await db.safeHouses
        .filter(
          (sh) =>
            !!sh.upgradeInProgress &&
            !!sh.upgradeCompletesAt &&
            sh.upgradeCompletesAt <= Date.now(),
        )
        .toArray();
      for (const sh of done)
        await db.safeHouses.update(sh.id, {
          level: sh.level + 1,
          upgradeInProgress: false,
          upgradeCompletesAt: undefined,
        });
      if (done.length) load();
    }, 3000);
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
    load();
  }

  async function assignDivision(sh: SafeHouse, divId: DivisionId) {
    const cost = DIVISION_ASSIGN_BASE_COST * (sh.index ?? 1);
    if (!spendCurrencies({ money: cost })) return;
    await db.safeHouses.update(sh.id, {
      assignedDivisions: [...sh.assignedDivisions, divId],
    });
    setAssigningTo(null);
    setAssignPicked(null);
    load();
  }

  if (!houses.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <Building2 size={40} style={{ color: '#2a2a2a' }} />
        <p className="text-sm" style={{ color: '#555' }}>
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
            <div
              key={sh.id}
              className="rounded-xl p-4"
              style={{ background: '#111', border: '1px solid #2a2a2a' }}
            >
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
                    <p className="text-xs" style={{ color: '#666' }}>
                      {COUNTRY_MAP.get(REGION_MAP.get(sh.id)?.countryId ?? '')
                        ?.name ?? ''}
                    </p>
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: i < sh.level ? '#4ade80' : '#2a2a2a',
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
                  style={{ background: '#0a0a0a' }}
                >
                  <p className="text-sm font-bold" style={{ color: '#e8e8e8' }}>
                    {count}/{cap}
                  </p>
                  <p className="text-xs" style={{ color: '#555' }}>
                    Agenti
                  </p>
                </div>
                <div
                  className="flex-1 rounded-lg p-2 text-center"
                  style={{ background: '#0a0a0a' }}
                >
                  <p className="text-sm font-bold" style={{ color: '#e8e8e8' }}>
                    {sh.assignedDivisions.length}
                  </p>
                  <p className="text-xs" style={{ color: '#555' }}>
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
                {sh.assignedDivisions.length <
                  (SAFE_HOUSE_DIVISION_SLOTS[sh.level] ?? 2) && (
                  <button
                    onClick={() => {
                      setAssigningTo(sh.id);
                      setAssignPicked(null);
                    }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: '#0a0a0a',
                      color: '#4ade80',
                      border: '1px dashed #4ade8033',
                    }}
                  >
                    + <span style={{ color: '#4ade80' }}>$</span>
                    {DIVISION_ASSIGN_BASE_COST * (sh.index ?? 1)}
                  </button>
                )}
              </div>

              {sh.upgradeInProgress ? (
                <div
                  className="py-2 rounded-lg text-center text-xs"
                  style={{
                    background: '#1a1a08',
                    color: '#facc15',
                    border: '1px solid #facc1533',
                  }}
                >
                  Upgrade probíhá…
                </div>
              ) : nextCost ? (
                <button
                  onClick={() => upgrade(sh)}
                  disabled={!canUpg}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{
                    background: canUpg ? '#4ade8022' : '#0f0f0f',
                    color: canUpg ? '#4ade80' : '#444',
                    border: `1px solid ${canUpg ? '#4ade8044' : '#1a1a1a'}`,
                    cursor: canUpg ? 'pointer' : 'not-allowed',
                  }}
                >
                  <TrendingUp size={12} /> Upgrade na {sh.level + 1} —{' '}
                  <span style={{ color: '#4ade80' }}>$</span>
                  {nextCost.money} <span style={{ color: '#60a5fa' }}>◈</span>
                  {nextCost.intel}
                </button>
              ) : (
                <p
                  className="text-center text-xs py-2"
                  style={{ color: '#555' }}
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
            <div
              className="fixed inset-0 z-50 flex flex-col justify-end"
              style={{ background: 'rgba(0,0,0,0.75)' }}
            >
              <div
                className="rounded-t-2xl"
                style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
              >
                <div
                  className="h-1 rounded-t-2xl"
                  style={{ background: '#4ade80' }}
                />
                <div className="flex justify-center pt-3 pb-1">
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ background: '#333' }}
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
                      style={{ color: '#555' }}
                    >
                      <XCircle size={22} />
                    </button>
                  </div>

                  <div
                    className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
                    style={{ background: '#111' }}
                  >
                    <span style={{ color: '#4ade80' }}>$</span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: canPay ? '#4ade80' : '#ef4444' }}
                    >
                      {assignCost}
                    </span>
                    <span className="text-xs" style={{ color: '#555' }}>
                      / {currencies.money}
                    </span>
                  </div>

                  {available.length === 0 ? (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: '#555' }}
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
                            style={{
                              background: sel ? `${div.color}22` : '#111',
                              border: `1px solid ${sel ? `${div.color}55` : '#2a2a2a'}`,
                            }}
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
                                style={{ color: '#555' }}
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
                      style={{
                        background: '#1a1a1a',
                        color: '#888',
                        border: '1px solid #2a2a2a',
                      }}
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
                        style={{
                          background:
                            assignPicked && canPay ? '#4ade8022' : '#1a1a1a',
                          color: assignPicked && canPay ? '#4ade80' : '#444',
                          border: `1px solid ${assignPicked && canPay ? '#4ade8044' : '#1a1a1a'}`,
                          cursor:
                            assignPicked && canPay ? 'pointer' : 'not-allowed',
                        }}
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

  function doUnlock(id: DivisionId) {
    const cost = DIVISION_UNLOCK_COSTS[id];
    if (!cost) return;
    if (
      spendCurrencies({
        money: cost.money,
        intel: cost.intel,
        shadow: cost.shadow,
      })
    )
      unlockDivision(id);
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
            style={{
              background: isOn ? `${div.color}11` : '#0f0f0f',
              border: `1px solid ${isOn ? `${div.color}33` : '#1a1a1a'}`,
              opacity: isOn || canU ? 1 : 0.6,
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: isOn ? `${div.color}22` : '#1a1a1a' }}
            >
              <ShieldCheck size={15} color={isOn ? div.color : '#444'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-sm font-medium"
                  style={{ color: isOn ? '#e8e8e8' : '#555' }}
                >
                  {div.name}
                </p>
                {isOn && (
                  <span className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: i < lv ? div.color : '#2a2a2a' }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: '#555' }}>
                {div.description}
              </p>
            </div>

            {!isOn ? (
              isFree ? (
                <span
                  className="text-xs px-2 py-1 rounded flex-shrink-0"
                  style={{ background: '#1a1a1a', color: '#555' }}
                >
                  Starter
                </span>
              ) : (
                <button
                  onClick={() => doUnlock(div.id)}
                  disabled={!canU}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0"
                  style={{
                    background: canU ? `${div.color}22` : '#1a1a1a',
                    color: canU ? div.color : '#444',
                    border: `1px solid ${canU ? `${div.color}44` : '#1a1a1a'}`,
                    cursor: canU ? 'pointer' : 'not-allowed',
                  }}
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
                style={{
                  background: canUpg ? `${div.color}22` : '#1a1a1a',
                  color: canUpg ? div.color : '#444',
                  border: `1px solid ${canUpg ? `${div.color}44` : '#1a1a1a'}`,
                  cursor: canUpg ? 'pointer' : 'not-allowed',
                }}
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
        <p className="text-xs" style={{ color: '#555' }}>
          6 položek · rotace každou hodinu
        </p>
        <p className="text-xs font-mono" style={{ color: '#444' }}>
          🕐 {formatCountdown(countdown)}
        </p>
      </div>

      {/* Tier hint */}
      {totalMissions < 10 && (
        <p className="text-xs" style={{ color: '#444' }}>
          Na rare itemy potřebuješ 10+ splněných misí · legendary 30+ misí +
          černý trh
        </p>
      )}

      {notif && (
        <div
          className="rounded-xl p-2.5 text-sm text-center"
          style={{
            background: '#1a2e1a',
            color: '#4ade80',
            border: '1px solid #4ade8033',
          }}
        >
          {notif}
        </div>
      )}

      {items.map((eq) => {
        const rc = RARITY_COLOR[eq.rarity] ?? '#888';
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
            style={{ background: '#111', border: '1px solid #2a2a2a' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background: `${rc}22` }}
            >
              🎒
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-sm font-medium" style={{ color: '#e8e8e8' }}>
                  {eq.name}
                </p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: `${rc}22`, color: rc }}
                >
                  {eq.rarity}
                </span>
              </div>
              <p
                className="text-xs line-clamp-1 mb-1"
                style={{ color: '#666' }}
              >
                {eq.description}
              </p>
              {eq.minRank && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded inline-block mb-1"
                  style={{ background: '#2e1a00', color: '#f97316' }}
                >
                  Vyžaduje {RANK_LABEL[eq.minRank]}
                </span>
              )}
              {eq.requiredDivision && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded inline-block mb-1 ml-1"
                  style={{ background: '#0a1a2e', color: '#60a5fa' }}
                >
                  {divName(eq.requiredDivision)}
                </span>
              )}
              <div
                className="flex gap-2 flex-wrap text-xs"
                style={{ color: '#555' }}
              >
                {eq.bonusStealth ? <span>+{eq.bonusStealth} Stlth</span> : null}
                {eq.bonusCombat ? <span>+{eq.bonusCombat} Cmbt</span> : null}
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
              className="px-2.5 py-2 rounded-lg text-xs font-bold flex-shrink-0 whitespace-nowrap"
              style={{
                background: canBuy ? '#4ade8022' : '#1a1a1a',
                color: canBuy ? '#4ade80' : '#444',
                border: `1px solid ${canBuy ? '#4ade8044' : '#1a1a1a'}`,
                cursor: canBuy ? 'pointer' : 'not-allowed',
              }}
            >
              {eq.costMoney > 0 && (
                <>
                  <span style={{ color: '#4ade80' }}>$</span>
                  {eq.costMoney}
                </>
              )}
              {eq.costIntel ? (
                <>
                  {' '}
                  <span style={{ color: '#60a5fa' }}>◈</span>
                  {eq.costIntel}
                </>
              ) : null}
              {eq.costShadow ? (
                <>
                  {' '}
                  <span style={{ color: '#a855f7' }}>◆</span>
                  {eq.costShadow}
                </>
              ) : null}
              {eq.costInfluence ? (
                <>
                  {' '}
                  <span style={{ color: '#f59e0b' }}>✦</span>
                  {eq.costInfluence}
                </>
              ) : null}
            </button>
          </div>
        );
      })}

      {/* Agent picker */}
      {buying && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
        >
          <div
            className="rounded-t-2xl"
            style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
          >
            <div
              className="h-1 rounded-t-2xl"
              style={{ background: '#4ade80' }}
            />
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: '#333' }}
              />
            </div>
            <div className="px-4 pt-2 pb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p
                    className="text-xs tracking-widest uppercase"
                    style={{ color: '#555' }}
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
                  style={{ color: '#555' }}
                >
                  <XCircle size={22} />
                </button>
              </div>
              {agents.length === 0 ? (
                <p
                  className="text-sm text-center py-6"
                  style={{ color: '#555' }}
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
                          background: '#111',
                          border: '1px solid #2a2a2a',
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
                          <p className="text-xs" style={{ color: '#666' }}>
                            {has ? 'Volný slot' : 'Plné vybavení'}
                          </p>
                        </div>
                        {has && (
                          <ChevronRight size={13} style={{ color: '#444' }} />
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
      setBuying(null);
      setNotif('Expanzní zkratka zatím není implementována');
      setTimeout(() => setNotif(''), 2500);
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
        <div className="text-4xl">🔒</div>
        <p className="text-base font-semibold" style={{ color: '#e8e8e8' }}>
          Černý trh uzamčen
        </p>
        <p className="text-sm" style={{ color: '#555' }}>
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
        <p className="text-sm" style={{ color: '#555' }}>
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
          <p className="text-sm font-semibold" style={{ color: '#a855f7' }}>
            Černý trh
          </p>
          <p className="text-xs" style={{ color: '#555' }}>
            Exkluzivní vybavení a agenti
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ background: '#1a0a2e', color: '#a855f7' }}
        >
          ⏱ {fmtCountdown(countdown)}
        </div>
      </div>

      {notif && (
        <div
          className="text-xs px-3 py-2 rounded-xl text-center"
          style={{
            background: '#0a1a0a',
            color: '#4ade80',
            border: '1px solid #4ade8033',
          }}
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
            style={{
              background: `${rc}0d`,
              border: `1px solid ${rc}33`,
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background: `${rc}22` }}
            >
              {isAgent ? '🕵' : isExpansion ? '🗺' : '🎒'}
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
                    {eq.rarity}
                  </span>
                )}
              </div>
              <p
                className="text-xs line-clamp-1 mb-1"
                style={{ color: '#666' }}
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
                  style={{ color: '#555' }}
                >
                  {eq.bonusStealth ? (
                    <span>+{eq.bonusStealth} Stlth</span>
                  ) : null}
                  {eq.bonusCombat ? <span>+{eq.bonusCombat} Cmbt</span> : null}
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
              className="px-2.5 py-2 rounded-lg text-xs font-bold flex-shrink-0 whitespace-nowrap"
              style={{
                background: canAfford ? '#a855f722' : '#1a1a1a',
                color: canAfford ? '#a855f7' : '#444',
                border: `1px solid ${canAfford ? '#a855f744' : '#1a1a1a'}`,
                cursor: canAfford ? 'pointer' : 'not-allowed',
              }}
            >
              {listing.costShadow > 0 && (
                <>
                  <span style={{ color: '#a855f7' }}>◆</span>
                  {listing.costShadow}
                </>
              )}
              {listing.costInfluence > 0 && (
                <>
                  {' '}
                  <span style={{ color: '#f59e0b' }}>✦</span>
                  {listing.costInfluence}
                </>
              )}
              {(listing.costMoney ?? 0) > 0 && (
                <>
                  {' '}
                  <span style={{ color: '#4ade80' }}>$</span>
                  {listing.costMoney}
                </>
              )}
            </button>
          </div>
        );
      })}

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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="rounded-t-2xl"
        style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
      >
        <div className="h-1 rounded-t-2xl" style={{ background: '#a855f7' }} />
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#333' }}
          />
        </div>
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
              Přiřadit agentovi
            </p>
            <button onClick={onClose} style={{ color: '#555' }}>
              ✕
            </button>
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#555' }}>
              Žádný dostupný agent s volným slotem
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onAssign(a, listing)}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: '#111', border: '1px solid #222' }}
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
                    <p className="text-xs" style={{ color: '#666' }}>
                      {RANK_LABEL[a.rank]} · volný slot
                    </p>
                  </div>
                  <ChevronRight size={13} style={{ color: '#444' }} />
                </button>
              ))}
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
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="rounded-t-2xl"
        style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
      >
        <div className="h-1 rounded-t-2xl" style={{ background: '#a855f7' }} />
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#333' }}
          />
        </div>
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>
              Kam umístit agenta?
            </p>
            <button onClick={onClose} style={{ color: '#555' }}>
              ✕
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: '#666' }}>
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
                    background: full ? '#0d0d0d' : '#111',
                    border: `1px solid ${full ? '#1a1a1a' : '#2a2a2a'}`,
                    opacity: full ? 0.5 : 1,
                    cursor: full ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: '#a855f722', color: '#a855f7' }}
                  >
                    {regionDisplayName(sh.id).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className="text-sm font-medium"
                      style={{ color: '#e8e8e8' }}
                    >
                      {regionDisplayName(sh.id)}
                    </p>
                    <p className="text-xs" style={{ color: '#666' }}>
                      {count}/{cap} agentů {full ? '· plno' : ''}
                    </p>
                  </div>
                  {!full && (
                    <ChevronRight size={13} style={{ color: '#444' }} />
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
  const blackMarketUnlocked = useGameStore((s) => s.blackMarketUnlocked);
  const totalMissions = useGameStore((s) => s.totalMissionsCompleted);
  const [tab, setTab] = useState<Tab>('recruit');

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: '#0a0a0a', color: '#e8e8e8' }}
    >
      {/* Header */}
      <div className="px-4 pt-10 pb-3">
        <h1 className="text-lg font-bold tracking-tight mb-3">Základna</h1>

        {/* Currencies */}
        <div className="mb-4">
          <CurrenciesBar />
        </div>

        <CityBar />

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.filter(
            (t) =>
              t.id !== 'blackmarket' ||
              blackMarketUnlocked ||
              totalMissions >= 10,
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? '#4ade8022' : '#111',
                color: tab === t.id ? '#4ade80' : '#666',
                border: `1px solid ${tab === t.id ? '#4ade8044' : '#1a1a1a'}`,
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
