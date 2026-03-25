import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Target, Users, Zap } from 'lucide-react';
import { cardBase, cardActive, activeTab } from '../../styles/tokens';
import type { SafeHouse, RegionState } from '../../db/schema';
import { DIVISIONS } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { COUNTRY_MAP } from '../../data/countries';
import { alertColor, typeChar, regionTypeBonusSummary } from './mapHelpers';

export function CityCard({
  sh,
  state,
  agentCount,
  isActive,
  onSelect,
}: {
  sh: SafeHouse;
  state: RegionState;
  agentCount: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const navigate = useNavigate();
  const region = REGION_MAP.get(sh.id);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  const missionCount = state.availableMissionIds?.length ?? 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={isActive ? cardActive : cardBase}
    >
      {/* Title row */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isActive && (
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: '#4ade80' }}
              />
            )}
            <span className="text-xs flex-shrink-0" style={{ color: '#888' }}>
              {typeChar(region?.type ?? '')}
            </span>
            <h3
              className="text-base font-bold truncate"
              style={{ color: isActive ? '#4ade80' : '#e8e8e8' }}
            >
              {region?.name ?? sh.id}
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
            {country?.name ?? ''}
            {sh.index === 1 && (
              <span style={{ color: '#4ade8055' }}> · Domovská</span>
            )}
          </p>
          {region && (
            <p className="text-[10px] mt-0.5" style={{ color: '#60a5fa88' }}>
              {regionTypeBonusSummary(region.type, region.secondaryType)}
            </p>
          )}
        </div>
        {/* Alert */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Zap size={11} color={alertColor(state.alertLevel)} />
          <span
            className="text-xs"
            style={{ color: alertColor(state.alertLevel) }}
          >
            {state.alertLevel.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 py-2 flex items-center gap-4">
        {/* SH level */}
        <div className="flex items-center gap-1.5">
          <Building2 size={12} color="#555" />
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: i < sh.level ? '#4ade80' : '#777777' }}
              />
            ))}
          </span>
        </div>
        {/* Agents */}
        <div className="flex items-center gap-1">
          <Users size={12} color="#60a5fa" />
          <span className="text-xs font-medium" style={{ color: '#60a5fa' }}>
            {agentCount}
          </span>
        </div>
        {/* Missions */}
        <div className="flex items-center gap-1">
          <Target size={12} color="#a78bfa" />
          <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>
            {missionCount}
          </span>
        </div>
        {/* Mission Tier */}
        {(state.missionTier ?? 0) > 0 && (
          <div
            className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{
              background: '#2a1a00',
              color: '#f97316',
            }}
          >
            T{state.missionTier}
          </div>
        )}
        {/* Divisions */}
        <div className="flex flex-wrap gap-1 ml-auto">
          {sh.assignedDivisions.slice(0, 3).map((d) => {
            const div = DIVISIONS.find((x) => x.id === d);
            return div ? (
              <span
                key={d}
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: `${div.color}22`, color: div.color }}
              >
                {div.name}
              </span>
            ) : null;
          })}
          {sh.assignedDivisions.length > 3 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: '#666666', color: '#888' }}
            >
              +{sh.assignedDivisions.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={onSelect}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={
            isActive
              ? { ...activeTab.active, padding: '8px 12px' }
              : { ...activeTab.inactive, padding: '8px 12px' }
          }
        >
          {isActive ? '✓ Aktivní základna' : 'Nastavit jako aktivní'}
        </button>
        <button
          onClick={() => {
            onSelect();
            navigate('/missions');
          }}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
          style={activeTab.inactive}
        >
          Mise <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
