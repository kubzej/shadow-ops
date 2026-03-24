import { ShieldCheck } from 'lucide-react';
import { cardBase, btn } from '../../styles/tokens';
import { db } from '../../db/db';
import type { DivisionId } from '../../data/agentTypes';
import { DIVISIONS } from '../../data/agentTypes';
import type { Mission } from '../../db/schema';
import {
  DIVISION_UNLOCK_COSTS,
  DIVISION_LEVEL_COSTS,
  SAFE_HOUSE_DIVISION_SLOTS,
} from '../../data/costs';
import { useGameStore } from '../../store/gameStore';
import { useMissionStore } from '../../store/missionStore';
import { useUIStore } from '../../store/uiStore';

export function DivisionsTab() {
  const currencies = useGameStore((s) => s.currencies);
  const spendCurrencies = useGameStore((s) => s.spendCurrencies);
  const unlocked = useGameStore((s) => s.unlockedDivisions);
  const levels = useGameStore((s) => s.divisionLevels);
  const unlockDivision = useGameStore((s) => s.unlockDivision);
  const upgradeDivision = useGameStore((s) => s.upgradeDivision);
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);
  const showToast = useUIStore((s) => s.showToast);
  const invalidateRegionMissions = useMissionStore(
    (s) => s.invalidateRegionMissions,
  );

  async function doUnlock(id: DivisionId) {
    const cost = DIVISION_UNLOCK_COSTS[id];
    if (!cost) return;
    if (
      !spendCurrencies({
        money: cost.money,
        intel: cost.intel,
        shadow: cost.shadow,
      })
    )
      return;
    unlockDivision(id);

    // Auto-assign to the current safe house if it has a free slot
    const currentRegionId = selectedRegionId ?? startCityId;
    const sh = await db.safeHouses.get(currentRegionId);
    if (
      sh &&
      !sh.constructionInProgress &&
      !sh.assignedDivisions.includes(id) &&
      sh.assignedDivisions.length < (SAFE_HOUSE_DIVISION_SLOTS[sh.level] ?? 2)
    ) {
      await db.safeHouses.update(sh.id, {
        assignedDivisions: [...sh.assignedDivisions, id],
      });
      const region = await db.regions.get(sh.id);
      const missionIds = region?.availableMissionIds ?? [];
      if (missionIds.length) {
        const allMissions = (await db.missions.bulkGet(missionIds)).filter(
          Boolean,
        ) as Mission[];
        const toUnlock = allMissions.filter((m) => m.lockedByDivision === id);
        for (const m of toUnlock) {
          await db.missions.update(m.id, { lockedByDivision: undefined });
        }
      }
      invalidateRegionMissions(sh.id);
      const divName = DIVISIONS.find((d) => d.id === id)?.name ?? id;
      showToast(
        'success',
        `${divName} přiřazena do ${sh.id === startCityId ? 'domovské základny' : sh.id}`,
      );
    }
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
            style={{ ...cardBase, opacity: isOn || canU ? 1 : 0.6 }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: isOn ? `${div.color}22` : '#666666' }}
            >
              <ShieldCheck size={15} color={isOn ? div.color : '#777'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-sm font-medium"
                  style={{ color: isOn ? '#e8e8e8' : '#888' }}
                >
                  {div.name}
                </p>
                {isOn && (
                  <span className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: i < lv ? div.color : '#777777' }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: '#888' }}>
                {div.description}
              </p>
            </div>

            {!isOn ? (
              isFree ? (
                <span
                  className="text-xs px-2 py-1 rounded flex-shrink-0"
                  style={{ background: '#666666', color: '#888' }}
                >
                  Starter
                </span>
              ) : (
                <button
                  onClick={() => doUnlock(div.id)}
                  disabled={!canU}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0"
                  style={btn.action(div.color as string, !canU)}
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
                style={btn.action(div.color as string, !canUpg)}
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
