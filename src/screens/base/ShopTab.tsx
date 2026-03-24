import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Clock,
  Coins,
  Eye,
  Ghost,
  Package,
  Radio,
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
import type { Agent } from '../../db/schema';
import type { AgentRank } from '../../data/agentTypes';
import { applyEquipmentBonuses } from '../../engine/agentGenerator';
import { useGameStore } from '../../store/gameStore';
import { RARITY_COLOR, RARITY_LABEL, RANK_LABEL } from '../shared/constants';
import { divColor, divName } from './baseHelpers';
import {
  currentShopSeed,
  msToNextRotation,
  formatCountdown,
  generateShopItems,
} from './shopHelpers';

export function ShopTab() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const totalMissions = useGameStore((s) => s.totalMissionsCompleted);
  const blackMarketUnlocked = useGameStore((s) => s.blackMarketUnlocked);

  const [shopSeed, setShopSeed] = useState(currentShopSeed);
  const [countdown, setCountdown] = useState(msToNextRotation);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [buying, setBuying] = useState<
    ReturnType<typeof generateShopItems>[0] | null
  >(null);
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

  async function buyAssign(
    eq: ReturnType<typeof generateShopItems>[0],
    agent: Agent,
  ) {
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
                  Vyžaduje {RANK_LABEL[eq.minRank as AgentRank]}
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
