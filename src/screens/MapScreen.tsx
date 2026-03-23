import { useCallback, useEffect, useState } from 'react';
import CurrenciesBar from '../components/CurrenciesBar';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  Globe,
  ShieldCheck,
  Target,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { db } from '../db/db';
import type { RegionState, SafeHouse } from '../db/schema';
import type { DivisionId } from '../data/agentTypes';
import { DIVISIONS } from '../data/agentTypes';
import { REGION_MAP } from '../data/regions';
import { COUNTRY_MAP } from '../data/countries';
import {
  getAvailableExpansions,
  expansionCost,
  expansionBuildTime,
} from '../engine/mapGenerator';
import { generateMissionsForRegion } from '../engine/missionGenerator';
import { useGameStore } from '../store/gameStore';
import type { Currencies } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function alertColor(level: number): string {
  if (level < 0.5) return '#4ade80';
  if (level < 1.2) return '#a3e635';
  if (level < 2.0) return '#facc15';
  if (level < 2.7) return '#f97316';
  return '#ef4444';
}

function typeChar(type: string): string {
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

// ─────────────────────────────────────────────
// BuildCountdown
// ─────────────────────────────────────────────

function BuildCountdown({ completesAt }: { completesAt: number }) {
  const [rem, setRem] = useState(
    Math.max(0, Math.ceil((completesAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(
      () => setRem(Math.max(0, Math.ceil((completesAt - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [completesAt]);
  const m = Math.floor(rem / 60),
    s = rem % 60;
  return (
    <span>{rem > 0 ? `${m}:${String(s).padStart(2, '0')}` : 'Hotovo'}</span>
  );
}

// ─────────────────────────────────────────────
// Expansion dialog
// ─────────────────────────────────────────────

function ExpansionDialog({
  regionId,
  distanceFromStart,
  onConfirm,
  onClose,
}: {
  regionId: string;
  distanceFromStart: number;
  onConfirm: (divId: DivisionId) => void;
  onClose: () => void;
}) {
  const region = REGION_MAP.get(regionId);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  const currencies = useGameStore((s) => s.currencies);
  const totalExpansions = useGameStore((s) => s.totalExpansions);
  const unlocked = useGameStore((s) => s.unlockedDivisions);
  const cost = expansionCost(regionId, distanceFromStart, totalExpansions);
  const buildSec = Math.round(expansionBuildTime(distanceFromStart) / 1000);
  const canAfford =
    currencies.money >= cost.money && currencies.intel >= cost.intel;

  const [step, setStep] = useState<'confirm' | 'pick'>('confirm');
  const [picked, setPicked] = useState<DivisionId | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="rounded-t-2xl"
        style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
      >
        <div className="h-1 rounded-t-2xl" style={{ background: '#facc15' }} />
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#333' }}
          />
        </div>

        <div className="px-4 pt-2 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-xs font-medium tracking-widest uppercase mb-0.5"
                style={{ color: '#facc15' }}
              >
                {step === 'confirm' ? 'Expanze' : 'Startovní divize'}
              </p>
              <h3 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>
                {region?.name ?? regionId}
              </h3>
              <p className="text-sm mt-0.5" style={{ color: '#666' }}>
                {country?.name ?? ''} · vzdálenost {distanceFromStart}
              </p>
            </div>
            <button onClick={onClose} style={{ color: '#555' }}>
              <XCircle size={22} />
            </button>
          </div>

          {step === 'confirm' ? (
            <>
              <div
                className="rounded-xl p-3 mb-3 flex gap-6"
                style={{ background: '#111' }}
              >
                {[
                  {
                    icon: '$',
                    color: '#4ade80',
                    val: cost.money,
                    have: currencies.money,
                  },
                  {
                    icon: '◈',
                    color: '#60a5fa',
                    val: cost.intel,
                    have: currencies.intel,
                  },
                ].map(({ icon, color: iconColor, val, have }) => (
                  <div key={icon} className="flex items-center gap-2">
                    <span style={{ color: iconColor }}>{icon}</span>
                    <span
                      className="text-base font-bold"
                      style={{ color: have >= val ? '#4ade80' : '#ef4444' }}
                    >
                      {val}
                    </span>
                    <span className="text-xs" style={{ color: '#555' }}>
                      / {have}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-3 mb-4 flex items-center gap-2"
                style={{ background: '#111' }}
              >
                <Clock size={13} color="#888" />
                <span className="text-sm" style={{ color: '#888' }}>
                  Čas výstavby:{' '}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#e8e8e8' }}
                >
                  {Math.floor(buildSec / 60)}m {buildSec % 60}s
                </span>
              </div>

              {!canAfford && (
                <div
                  className="flex items-center gap-2 mb-3 text-sm"
                  style={{ color: '#ef4444' }}
                >
                  <AlertTriangle size={13} /> Nedostatek zdrojů.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: '#1a1a1a',
                    color: '#888',
                    border: '1px solid #2a2a2a',
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={() => setStep('pick')}
                  disabled={!canAfford}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                  style={{
                    background: canAfford ? '#facc15' : '#1a1a1a',
                    color: canAfford ? '#0a0a0a' : '#444',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Globe size={15} /> Expandovat <ChevronRight size={13} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: '#888' }}>
                Zvol startovní divizi. Další lze přidat za poplatek v Base.
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {(unlocked as DivisionId[]).map((divId) => {
                  const div = DIVISIONS.find((d) => d.id === divId);
                  if (!div) return null;
                  const sel = picked === divId;
                  return (
                    <button
                      key={divId}
                      onClick={() => setPicked(divId)}
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
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: '#1a1a1a',
                    color: '#888',
                    border: '1px solid #2a2a2a',
                  }}
                >
                  Zpět
                </button>
                <button
                  onClick={() => {
                    if (picked) onConfirm(picked);
                  }}
                  disabled={!picked}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                  style={{
                    background: picked ? '#facc15' : '#1a1a1a',
                    color: picked ? '#0a0a0a' : '#444',
                    cursor: picked ? 'pointer' : 'not-allowed',
                  }}
                >
                  Potvrdit <ChevronRight size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CityCard — owned safe house card
// ─────────────────────────────────────────────

function CityCard({
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
      style={{
        background: isActive ? '#0d1a0d' : '#0f0f0f',
        border: `1px solid ${isActive ? '#4ade8033' : '#1a1a1a'}`,
      }}
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
            <span className="text-xs flex-shrink-0" style={{ color: '#555' }}>
              {typeChar(region?.type ?? '')}
            </span>
            <h3
              className="text-base font-bold truncate"
              style={{ color: isActive ? '#4ade80' : '#e8e8e8' }}
            >
              {region?.name ?? sh.id}
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#555' }}>
            {country?.name ?? ''}
            {sh.index === 1 && (
              <span style={{ color: '#4ade8055' }}> · Domovská</span>
            )}
          </p>
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

      <div style={{ borderTop: '1px solid #1a1a1a' }} />

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
                style={{ background: i < sh.level ? '#4ade80' : '#2a2a2a' }}
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
              style={{ background: '#1a1a1a', color: '#555' }}
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
          style={{
            background: isActive ? '#4ade8022' : '#111',
            color: isActive ? '#4ade80' : '#666',
            border: `1px solid ${isActive ? '#4ade8033' : '#1a1a1a'}`,
          }}
        >
          {isActive ? '✓ Aktivní základna' : 'Nastavit jako aktivní'}
        </button>
        <button
          onClick={() => {
            onSelect();
            navigate('/missions');
          }}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
          style={{
            background: '#111',
            color: '#666',
            border: '1px solid #1a1a1a',
          }}
        >
          Mise <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ConstructionCard — city being built
// ─────────────────────────────────────────────

function ConstructionCard({ state }: { state: RegionState }) {
  const region = REGION_MAP.get(state.id);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{ background: '#1a1a08', border: '1px solid #facc1533' }}
    >
      <Clock size={18} color="#facc15" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: '#666' }}>
            {typeChar(region?.type ?? '')}
          </span>
          <p
            className="text-sm font-medium truncate"
            style={{ color: '#e8e8e8' }}
          >
            {region?.name ?? state.id}
          </p>
        </div>
        <p className="text-xs" style={{ color: '#666' }}>
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

// ─────────────────────────────────────────────
// ExpansionCardItem — available expansion target
// ─────────────────────────────────────────────

function ExpansionCardItem({
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
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}
    >
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs flex-shrink-0" style={{ color: '#555' }}>
              {typeChar(region?.type ?? '')}
            </span>
            <h3
              className="text-sm font-bold truncate"
              style={{ color: '#e8e8e8' }}
            >
              {region?.name ?? state.id}
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#555' }}>
            {country?.name ?? ''} · vzdálenost {state.distanceFromStart}
          </p>
        </div>
        <div
          className="flex items-center gap-1 text-xs flex-shrink-0 ml-2"
          style={{ color: '#555' }}
        >
          <Clock size={11} />
          <span>
            {Math.floor(buildSec / 60)}m {buildSec % 60}s
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1a1a1a' }} />

      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#4ade80' }}>
              $
            </span>
            <span
              className="text-sm font-bold"
              style={{
                color: currencies.money >= cost.money ? '#4ade80' : '#ef4444',
              }}
            >
              {cost.money}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#60a5fa' }}>
              ◈
            </span>
            <span
              className="text-sm font-bold"
              style={{
                color: currencies.intel >= cost.intel ? '#60a5fa' : '#ef4444',
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
          style={{
            background: canAfford ? '#facc1522' : '#111',
            color: canAfford ? '#facc15' : '#444',
            border: `1px solid ${canAfford ? '#facc1544' : '#1a1a1a'}`,
            cursor: canAfford ? 'pointer' : 'not-allowed',
          }}
        >
          <Globe size={12} /> Expandovat
        </button>
      </div>

      {wouldUnlock.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid #1a1a1a' }} />
          <div className="px-4 py-2 flex flex-wrap items-center gap-1.5">
            <span
              className="text-[10px] flex-shrink-0"
              style={{ color: '#444' }}
            >
              Odemkne:
            </span>
            {wouldUnlock.slice(0, 4).map((name) => (
              <span
                key={name}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: '#1a1a1a', color: '#666' }}
              >
                {name}
              </span>
            ))}
            {wouldUnlock.length > 4 && (
              <span className="text-[10px]" style={{ color: '#444' }}>
                +{wouldUnlock.length - 4}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function MapScreen() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const incrementStat = useGameStore((s) => s.incrementStat);
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

    const id = setInterval(async () => {
      const now = Date.now();
      const done = await db.regions
        .filter(
          (r) =>
            !!r.constructionInProgress &&
            !!r.constructionCompletesAt &&
            r.constructionCompletesAt <= now,
        )
        .toArray();
      if (done.length === 0) return;
      for (const r of done) {
        const missions = generateMissionsForRegion(r.id, r.alertLevel, 3);
        await db.missions.bulkAdd(missions);
        await db.safeHouses.update(r.id, {
          constructionInProgress: false,
          constructionCompletesAt: undefined,
        });
        await db.regions.update(r.id, {
          owned: true,
          constructionInProgress: false,
          constructionCompletesAt: undefined,
          safeHouseId: r.id,
          availableMissionIds: missions.map((m) => m.id),
        });
        incrementStat('expansions');
      }
      load();
    }, 5000);

    return () => clearInterval(id);
  }, [load, incrementStat]);

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
        background: '#0a0a0a',
        color: '#e8e8e8',
        minHeight: '100%',
        paddingBottom: '5rem',
      }}
    >
      {/* Header */}
      <div
        className="px-4 pt-10 pb-3"
        style={{ borderBottom: '1px solid #1a1a1a' }}
      >
        <div className="flex items-end justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Základny</h1>
            <p className="text-xs mt-0.5" style={{ color: '#555' }}>
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
        style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}
      >
        <button
          onClick={() => setTab('bases')}
          className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: tab === 'bases' ? '#4ade8022' : '#111',
            color: tab === 'bases' ? '#4ade80' : '#666',
            border: `1px solid ${tab === 'bases' ? '#4ade8044' : '#1a1a1a'}`,
          }}
        >
          Základny ({ownedRegions.length + constructingRegions.length})
        </button>
        <button
          onClick={() => setTab('expand')}
          className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: tab === 'expand' ? '#facc1522' : '#111',
            color: tab === 'expand' ? '#facc15' : '#666',
            border: `1px solid ${tab === 'expand' ? '#facc1544' : '#1a1a1a'}`,
          }}
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
                <Globe size={40} style={{ color: '#1a1a1a' }} />
                <p className="text-sm" style={{ color: '#555' }}>
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
                <Globe size={40} style={{ color: '#1a1a1a' }} />
                <p className="text-sm" style={{ color: '#555' }}>
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
