import { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  Clock,
  Coins,
  Ghost,
  Lock,
  Map,
  Package,
  Radio,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  C,
  cardBase,
  btn,
  modalSheet,
  modalOverlay,
} from '../../styles/tokens';
import { db } from '../../db/db';
import type {
  Agent,
  SafeHouse,
  BlackMarketListing,
  RegionState,
} from '../../db/schema';
import type { DivisionId, AgentRank } from '../../data/agentTypes';
import { DIVISIONS } from '../../data/agentTypes';
import { SAFE_HOUSE_CAPACITY } from '../../data/costs';
import { EQUIPMENT_CATALOG } from '../../data/equipmentCatalog';
import {
  generateBlackMarketOffer,
  needsRefresh,
  isSpecialAgentListing,
  isExpansionSkipListing,
  parseSpecialAgentListing,
} from '../../engine/blackMarket';
import {
  generateRecruitmentOffer,
  XP_TO_RANK,
  applyEquipmentBonuses,
} from '../../engine/agentGenerator';
import { getAvailableExpansions } from '../../engine/mapGenerator';
import { randomId } from '../../utils/rng';
import { useGameStore } from '../../store/gameStore';
import {
  RARITY_COLOR,
  RARITY_LABEL,
  RANK_LABEL,
  RANK_NUM,
} from '../shared/constants';
import { regionDisplayName, divColor } from './baseHelpers';

// ─────────────────────────────────────────────
// Inner modal: expansion region picker
// ─────────────────────────────────────────────

function ExpansionSkipPickerModal({
  regions,
  onClose,
  onConfirm,
}: {
  regions: RegionState[];
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

// ─────────────────────────────────────────────
// Inner modal: agent picker (equipment listing)
// ─────────────────────────────────────────────

function AgentPickerModal({
  listing,
  onClose,
  onAssign,
}: {
  listing: BlackMarketListing;
  onClose: () => void;
  onAssign: (agent: Agent, listing: BlackMarketListing) => void;
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
  const minRank = eq?.minRank as AgentRank | undefined;

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
// Inner modal: safe house picker (special agent)
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
// Main tab: Black Market
// ─────────────────────────────────────────────

export function BlackMarketTab() {
  const blackMarketUnlocked = useGameStore((s) => s.blackMarketUnlocked);
  const totalMissions = useGameStore((s) => s.totalMissionsCompleted);
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const unlockedDivisions = useGameStore((s) => s.unlockedDivisions);

  const [offer, setOffer] = useState<
    import('../../db/schema').BlackMarket | null
  >(null);
  const [countdown, setCountdown] = useState(0);
  const [buying, setBuying] = useState<BlackMarketListing | null>(null);
  const [pendingAgentListing, setPendingAgentListing] = useState<{
    listing: BlackMarketListing;
    division: string;
    rank: 'specialist' | 'veteran';
    agentName: string;
    agentStats: import('../../db/schema').AgentStats;
    agentTypeId: string;
  } | null>(null);
  const [safeHouses, setSafeHouses] = useState<SafeHouse[]>([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [notif, setNotif] = useState('');
  const [pendingExpansionSkip, setPendingExpansionSkip] =
    useState<BlackMarketListing | null>(null);
  const [availableExpansions, setAvailableExpansions] = useState<RegionState[]>(
    [],
  );

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
    if (blackMarketUnlocked) void loadOffer();
  }, [blackMarketUnlocked, loadOffer]);

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

  async function buyListing(listing: BlackMarketListing) {
    if (isExpansionSkipListing(listing.equipmentId)) {
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
    const pickedDiv = (unlockedDivisions[0] ?? 'surveillance') as DivisionId;
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

  async function assignToAgent(agent: Agent, listing: BlackMarketListing) {
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
          if (eq.minRank) rankBadge = RANK_LABEL[eq.minRank as AgentRank];
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
            const recruitAt = Date.now();
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
              division: p.division as DivisionId,
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
              missionStreak: 0,
              recruitedAt: recruitAt,
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
