import { useCallback, useEffect, useState } from 'react';
import { Building2, Coins, RefreshCcw, Users } from 'lucide-react';
import { C, cardBase, btn } from '../../styles/tokens';
import { db } from '../../db/db';
import type {
  SafeHouse,
  RecruitmentPool,
  RecruitmentOffer,
} from '../../db/schema';
import type { DivisionId } from '../../data/agentTypes';
import { AGENT_TYPES } from '../../data/agentTypes';
import {
  SAFE_HOUSE_CAPACITY,
  RECRUITMENT_REFRESH_COST,
} from '../../data/costs';
import {
  generateRecruitmentPool,
  XP_TO_RANK,
} from '../../engine/agentGenerator';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { RANK_LABEL } from '../shared/constants';
import { regionDisplayName, divColor, divName, inferDiv } from './baseHelpers';

export function RecruitmentTab() {
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
          const region = await db.regions.get(sh.id);
          const burnedContractsActive =
            !!region?.burnedContractsUntil && region.burnedContractsUntil > now;
          const newPool = generateRecruitmentPool(
            sh.id,
            unlockedDivisions as DivisionId[],
            burnedContractsActive ? Math.max(1, sh.level - 1) : sh.level,
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
    const now = Date.now();

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
      missionStreak: 0,
      recruitedAt: now,
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
    const region = await db.regions.get(sh.id);
    const burnedContractsActive =
      !!region?.burnedContractsUntil &&
      region.burnedContractsUntil > Date.now();
    const p = generateRecruitmentPool(
      shId,
      unlockedDivisions as DivisionId[],
      burnedContractsActive ? Math.max(1, sh.level - 1) : sh.level,
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
