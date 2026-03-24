import { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { db } from '../db/db';
import type { SafeHouse, RegionState } from '../db/schema';
import { REGION_MAP } from '../data/regions';
import { COUNTRY_MAP } from '../data/countries';
import { useUIStore } from '../store/uiStore';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function typeIcon(type: string): string {
  switch (type) {
    case 'capital':
      return '★';
    case 'financial':
      return '$';
    case 'tech':
      return '⚙';
    case 'port':
      return '⚓';
    case 'military':
      return '✕';
    default:
      return '·';
  }
}

function alertColor(level: number): string {
  if (level < 0.5) return '#4ade80';
  if (level < 1.2) return '#a3e635';
  if (level < 2.0) return '#facc15';
  if (level < 2.7) return '#f97316';
  return '#ef4444';
}

// ─────────────────────────────────────────────
// City switcher overlay
// ─────────────────────────────────────────────

interface CityEntry {
  id: string;
  name: string;
  country: string;
  type: string;
  level: number;
  alertLevel: number;
  missionCount: number;
  agentCount: number;
}

function CitySwitcherOverlay({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const selectedId = useUIStore((s) => s.selectedRegionId);
  const [cities, setCities] = useState<CityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [houses, regions, agents] = await Promise.all([
        db.safeHouses.filter((h) => !h.constructionInProgress).toArray(),
        db.regions.filter((r) => r.owned).toArray(),
        db.agents.toArray(),
      ]);

      const agentCounts: Record<string, number> = {};
      for (const a of agents) {
        if (a.safeHouseId)
          agentCounts[a.safeHouseId] = (agentCounts[a.safeHouseId] ?? 0) + 1;
      }

      const regionMap = new Map<string, RegionState>(
        regions.map((r) => [r.id, r]),
      );

      const entries: CityEntry[] = (houses as SafeHouse[])
        .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
        .map((sh) => {
          const region = REGION_MAP.get(sh.id);
          const country = region
            ? COUNTRY_MAP.get(region.countryId)
            : undefined;
          const state = regionMap.get(sh.id);
          return {
            id: sh.id,
            name: region?.name ?? sh.id,
            country: country?.name ?? '',
            type: region?.type ?? 'city',
            level: sh.level,
            alertLevel: state?.alertLevel ?? 0,
            missionCount: state?.availableMissionIds?.length ?? 0,
            agentCount: agentCounts[sh.id] ?? 0,
          };
        });

      setCities(entries);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl overflow-hidden"
        style={{
          background: '#262626',
          border: '1px solid #2a2a2a',
          maxHeight: '70vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#333' }}
          />
        </div>

        {/* Title row */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#555' }}
          >
            Přepnout základnu
          </span>
          <button onClick={onClose} style={{ color: '#555' }}>
            <X size={16} />
          </button>
        </div>

        {/* City list */}
        <div
          className="overflow-y-auto px-4 py-3 flex flex-col gap-2"
          style={{ maxHeight: '55vh' }}
        >
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl h-16 animate-pulse"
                  style={{ background: '#2b2b2b' }}
                />
              ))
            : cities.map((city) => {
                const isActive = selectedId === city.id;
                return (
                  <button
                    key={city.id}
                    onClick={() => onSelect(city.id)}
                    className="flex items-center gap-3 rounded-xl p-3 text-left w-full transition-all"
                    style={{
                      background: isActive ? '#4ade8011' : '#2b2b2b',
                      border: `1px solid ${isActive ? '#4ade8033' : '#333333'}`,
                    }}
                  >
                    {/* Active indicator */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: isActive ? '#4ade80' : '#444444' }}
                    />

                    {/* Name + country */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: '#555' }}>
                          {typeIcon(city.type)}
                        </span>
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: isActive ? '#4ade80' : '#e8e8e8' }}
                        >
                          {city.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: '#555' }}>
                          {city.country}
                        </span>
                        <span className="text-xs" style={{ color: '#333' }}>
                          ·
                        </span>
                        {/* SH level dots */}
                        <span className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{
                                background:
                                  i < city.level ? '#4ade80' : '#444444',
                              }}
                            />
                          ))}
                        </span>
                      </div>
                    </div>

                    {/* Stats + alert */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div
                          className="text-xs font-medium"
                          style={{ color: '#a78bfa' }}
                        >
                          {city.missionCount} misí
                        </div>
                        <div className="text-xs" style={{ color: '#60a5fa' }}>
                          {city.agentCount} agentů
                        </div>
                      </div>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: alertColor(city.alertLevel) }}
                      />
                    </div>
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CityBar — main export
// ─────────────────────────────────────────────

export default function CityBar() {
  const selectedId = useUIStore((s) => s.selectedRegionId);
  const selectRegion = useUIStore((s) => s.selectRegion);
  const [open, setOpen] = useState(false);

  const region = REGION_MAP.get(selectedId ?? '');
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;

  return (
    <>
      <button
        className="w-full flex items-center gap-2 px-4 py-2 text-left mb-3"
        style={{
          background: '#0c0c0c',
          borderBottom: '1px solid #1a1a1a',
        }}
        onClick={() => setOpen(true)}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: selectedId ? '#4ade80' : '#333' }}
        />
        {region && (
          <span className="text-xs flex-shrink-0" style={{ color: '#555' }}>
            {typeIcon(region.type)}
          </span>
        )}
        <span
          className="text-sm font-medium flex-1 truncate"
          style={{ color: region ? '#e8e8e8' : '#555' }}
        >
          {region?.name ?? 'Vyber základnu'}
        </span>
        {country && (
          <span className="text-xs flex-shrink-0" style={{ color: '#444' }}>
            {country.name}
          </span>
        )}
        <ChevronDown size={13} style={{ color: '#444', flexShrink: 0 }} />
      </button>

      {open && (
        <CitySwitcherOverlay
          onClose={() => setOpen(false)}
          onSelect={(id) => {
            selectRegion(id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
