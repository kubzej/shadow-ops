import { useCallback, useEffect, useState } from 'react';
import CurrenciesBar from '../components/CurrenciesBar';
import { C, activeTab } from '../styles/tokens';
import { Globe } from 'lucide-react';
import { db } from '../db/db';
import type { RegionState, SafeHouse } from '../db/schema';
import type { DivisionId } from '../data/agentTypes';
import {
  getAvailableExpansions,
  expansionCost,
  expansionBuildTime,
} from '../engine/mapGenerator';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CityCard } from './map/CityCard';
import { ConstructionCard } from './map/ConstructionCard';
import { ExpansionCardItem } from './map/ExpansionCardItem';
import { ExpansionDialog } from './map/ExpansionDialog';

export default function MapScreen() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const totalExpansions = useGameStore((s) => s.totalExpansions);
  const selectRegion = useUIStore((s) => s.selectRegion);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);

  const [regions, setRegions] = useState<RegionState[]>([]);
  const [safeHouses, setSafeHouses] = useState<SafeHouse[]>([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<'bases' | 'expand'>('bases');
  const [expandId, setExpandId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [allRegions, allHouses, allAgents] = await Promise.all([
      db.regions.toArray(),
      db.safeHouses.toArray(),
      db.agents.toArray(),
    ]);
    setRegions(allRegions);
    setSafeHouses(allHouses);
    const counts: Record<string, number> = {};
    for (const a of allAgents) {
      if (a.safeHouseId)
        counts[a.safeHouseId] = (counts[a.safeHouseId] ?? 0) + 1;
    }
    setAgentCounts(counts);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  async function handleExpand(regionId: string, pickedDiv: DivisionId) {
    const state = regions.find((r) => r.id === regionId);
    if (!state) return;
    const cost = expansionCost(
      regionId,
      state.distanceFromStart,
      totalExpansions,
    );
    const ok = spendCurrencies({ money: cost.money, intel: cost.intel });
    if (!ok) return;
    const buildMs = expansionBuildTime(state.distanceFromStart);
    const now = Date.now();
    const ownedCount = regions.filter((r) => r.owned).length;
    try {
      await db.safeHouses.add({
        id: regionId,
        regionId,
        level: 1,
        index: ownedCount + 1,
        assignedDivisions: [pickedDiv],
        modules: [],
        constructionInProgress: true,
        constructionCompletesAt: now + buildMs,
        createdAt: now,
      });
    } catch {
      await db.safeHouses.update(regionId, {
        constructionInProgress: true,
        constructionCompletesAt: now + buildMs,
      });
    }
    await db.regions.update(regionId, {
      constructionInProgress: true,
      constructionCompletesAt: now + buildMs,
    });
    setExpandId(null);
    load();
  }

  const ownedRegions = regions.filter((r) => r.owned);
  const constructingRegions = regions.filter(
    (r) => r.constructionInProgress && !r.owned,
  );
  const ownedIds = ownedRegions.map((r) => r.id);
  const availableIds = new Set(getAvailableExpansions(ownedIds, regions));
  const availableRegions = regions
    .filter((r) => availableIds.has(r.id))
    .sort((a, b) => a.distanceFromStart - b.distanceFromStart);

  const expandState = expandId
    ? (regions.find((r) => r.id === expandId) ?? null)
    : null;

  return (
    <div
      style={{
        background: C.bgBase,
        color: C.textPrimary,
        minHeight: '100%',
        paddingBottom: '5rem',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-end justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Základny</h1>
            <p className="text-xs mt-0.5" style={{ color: '#888' }}>
              {ownedRegions.length} aktivních
              {constructingRegions.length > 0 &&
                ` · ${constructingRegions.length} staví se`}
              {availableIds.size > 0 && ` · ${availableIds.size} dostupných`}
            </p>
          </div>
        </div>
        <CurrenciesBar />
      </div>

      {/* Tabs */}
      <div
        className="sticky top-0 z-10 flex gap-1 px-4 py-2"
        style={{ background: C.bgBase }}
      >
        <button
          onClick={() => setTab('bases')}
          className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={
            tab === 'bases'
              ? { ...activeTab.active, padding: '6px' }
              : { ...activeTab.inactive, padding: '6px' }
          }
        >
          Základny ({ownedRegions.length + constructingRegions.length})
        </button>
        <button
          onClick={() => setTab('expand')}
          className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={
            tab === 'expand'
              ? { ...activeTab.active, color: C.yellow, padding: '6px' }
              : { ...activeTab.inactive, padding: '6px' }
          }
        >
          Expanze ({availableIds.size})
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {tab === 'bases' ? (
          <>
            {safeHouses
              .filter((sh) => !sh.constructionInProgress)
              .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
              .map((sh) => {
                const state = regions.find((r) => r.id === sh.id);
                if (!state) return null;
                return (
                  <CityCard
                    key={sh.id}
                    sh={sh}
                    state={state}
                    agentCount={agentCounts[sh.id] ?? 0}
                    isActive={selectedRegionId === sh.id}
                    onSelect={() => selectRegion(sh.id)}
                  />
                );
              })}

            {constructingRegions.map((r) => (
              <ConstructionCard key={r.id} state={r} />
            ))}

            {ownedRegions.length === 0 && constructingRegions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Globe size={40} style={{ color: '#666666' }} />
                <p className="text-sm" style={{ color: '#888' }}>
                  Žádné základny
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {availableRegions.map((r) => (
              <ExpansionCardItem
                key={r.id}
                state={r}
                totalExpansions={totalExpansions}
                currencies={currencies}
                ownedIds={new Set(ownedRegions.map((x) => x.id))}
                availableIds={availableIds}
                onExpand={() => setExpandId(r.id)}
              />
            ))}
            {availableIds.size === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Globe size={40} style={{ color: '#666666' }} />
                <p className="text-sm" style={{ color: '#888' }}>
                  Žádné dostupné expanze
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {expandState && (
        <ExpansionDialog
          regionId={expandState.id}
          distanceFromStart={expandState.distanceFromStart}
          onConfirm={(div) => handleExpand(expandState.id, div)}
          onClose={() => setExpandId(null)}
        />
      )}
    </div>
  );
}
