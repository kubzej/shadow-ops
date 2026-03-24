import { Clock, Coins, Eye, Globe } from 'lucide-react';
import { C, cardBase, btn } from '../../styles/tokens';
import type { RegionState } from '../../db/schema';
import type { Currencies } from '../../store/gameStore';
import { REGION_MAP } from '../../data/regions';
import { COUNTRY_MAP } from '../../data/countries';
import { expansionCost, expansionBuildTime } from '../../engine/mapGenerator';
import { typeChar } from './mapHelpers';

export function ExpansionCardItem({
  state,
  totalExpansions,
  currencies,
  ownedIds,
  availableIds,
  onExpand,
}: {
  state: RegionState;
  totalExpansions: number;
  currencies: Currencies;
  ownedIds: Set<string>;
  availableIds: Set<string>;
  onExpand: () => void;
}) {
  const region = REGION_MAP.get(state.id);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  const cost = expansionCost(
    state.id,
    state.distanceFromStart,
    totalExpansions,
  );
  const buildSec = Math.round(
    expansionBuildTime(state.distanceFromStart) / 1000,
  );
  const canAfford =
    currencies.money >= cost.money && currencies.intel >= cost.intel;

  // Cities that become newly accessible if this expansion is taken
  const wouldUnlock = (region?.neighbors ?? [])
    .filter((n) => !ownedIds.has(n) && !availableIds.has(n))
    .map((n) => REGION_MAP.get(n)?.name ?? n);

  return (
    <div className="rounded-2xl overflow-hidden" style={cardBase}>
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs flex-shrink-0" style={{ color: '#888' }}>
              {typeChar(region?.type ?? '')}
            </span>
            <h3
              className="text-sm font-bold truncate"
              style={{ color: '#e8e8e8' }}
            >
              {region?.name ?? state.id}
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
            {country?.name ?? ''} · vzdálenost {state.distanceFromStart}
          </p>
        </div>
        <div
          className="flex items-center gap-1 text-xs flex-shrink-0 ml-2"
          style={{ color: '#888' }}
        >
          <Clock size={11} />
          <span>
            {Math.floor(buildSec / 60)}m {buildSec % 60}s
          </span>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <Coins size={11} color={C.green} />
            <span
              className="text-sm font-bold"
              style={{
                color: currencies.money >= cost.money ? C.green : C.red,
              }}
            >
              {cost.money}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Eye size={11} color={C.blue} />
            <span
              className="text-sm font-bold"
              style={{
                color: currencies.intel >= cost.intel ? C.blue : C.red,
              }}
            >
              {cost.intel}
            </span>
          </div>
        </div>
        <button
          onClick={onExpand}
          disabled={!canAfford}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
          style={btn.action(C.yellow, !canAfford)}
        >
          <Globe size={12} /> Expandovat
        </button>
      </div>

      {wouldUnlock.length > 0 && (
        <>
          <div className="px-4 py-2 flex flex-wrap items-center gap-1.5">
            <span
              className="text-[10px] flex-shrink-0"
              style={{ color: '#777' }}
            >
              Odemkne:
            </span>
            {wouldUnlock.slice(0, 4).map((name) => (
              <span
                key={name}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: '#666666', color: '#999' }}
              >
                {name}
              </span>
            ))}
            {wouldUnlock.length > 4 && (
              <span className="text-[10px]" style={{ color: '#777' }}>
                +{wouldUnlock.length - 4}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
