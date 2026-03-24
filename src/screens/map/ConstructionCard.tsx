import { Clock } from 'lucide-react';
import type { RegionState } from '../../db/schema';
import { REGION_MAP } from '../../data/regions';
import { COUNTRY_MAP } from '../../data/countries';
import { typeChar } from './mapHelpers';
import { BuildCountdown } from './BuildCountdown';

export function ConstructionCard({ state }: { state: RegionState }) {
  const region = REGION_MAP.get(state.id);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;

  return (
    <div
      className="rounded-2xl overflow-hidden flex items-center gap-3 p-3"
      style={{ background: '#1a1a08' }}
    >
      <Clock size={18} color="#facc15" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: '#999' }}>
            {typeChar(region?.type ?? '')}
          </span>
          <p
            className="text-sm font-medium truncate"
            style={{ color: '#e8e8e8' }}
          >
            {region?.name ?? state.id}
          </p>
        </div>
        <p className="text-xs" style={{ color: '#999' }}>
          {country?.name ?? ''} · Výstavba probíhá
        </p>
      </div>
      {state.constructionCompletesAt && (
        <span
          className="text-sm font-mono font-semibold flex-shrink-0"
          style={{ color: '#facc15' }}
        >
          <BuildCountdown completesAt={state.constructionCompletesAt} />
        </span>
      )}
    </div>
  );
}
