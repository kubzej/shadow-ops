# Shadow Ops — Store vrstva

Všechny storyy používají **Zustand + immer**. Immer umožňuje mutovat stav přímo ve `set()`.

---

## gameStore.ts — `useGameStore`

Primární store pro globální herní data. Vše co přežije session (uloženo v DB přes `_persist()`).

### State

```typescript
interface GameStore {
  loaded: boolean; // false dokud není loadGame() úspěšné
  agencyName: string;
  bossName: string;
  startCityId: string;
  logoId: string;
  createdAt: number;

  currencies: Currencies; // { money, intel, shadow, influence }

  unlockedDivisions: DivisionId[];
  divisionLevels: Record<DivisionId, number>;
  blackMarketUnlocked: boolean;

  totalMissionsCompleted: number;
  totalMissionsAttempted: number;
  totalAgentsLost: number;
  totalExpansions: number;
}
```

### Akce

| Akce                          | Popis                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `setLoaded(meta)`             | Naplní store daty z DB, resetuje session tracking                            |
| `addCurrencies(delta)`        | Přičte delta ke každé měně (floor 0), volá `_persist()`                      |
| `spendCurrencies(cost)`       | Odečte cost pokud canAfford(), vrátí boolean, volá `_persist()`              |
| `canAfford(cost)`             | Ověří bez mutace                                                             |
| `unlockDivision(id)`          | Přidá do unlockedDivisions, nastaví divisionLevels[id]=1                     |
| `upgradeDivision(id)`         | Incrementuje divisionLevels[id] (max 3)                                      |
| `unlockBlackMarket()`         | Nastaví blackMarketUnlocked=true                                             |
| `incrementStat('agents')`     | totalAgentsLost++                                                            |
| `incrementStat('expansions')` | totalExpansions++                                                            |
| `incrementMissionAttempted()` | totalMissionsAttempted++                                                     |
| `incrementMissionCompleted()` | totalMissionsCompleted++                                                     |
| `getPlayTimeSecs()`           | `_loadedPlayTime + (now - _sessionStartedAt) / 1000` (session-level counter) |
| `reset()`                     | Vynuluje všechen state (pro novou hru / slot switch)                         |
| `_persist()`                  | Uloží do `db.gameState` + aktualizuje `metaDb.slots` snapshot                |

### `_persist()` detail

```typescript
db.gameState.put({ id: 1, ...allFields, lastSavedAt: Date.now(), totalPlayTime: ... })
// Aktualizuje slot metadata (pro slot picker):
metaDb.slots.update(slotId, { lastSavedAt, money, intel, totalMissionsCompleted })
```

Volá se automaticky po každé mutaci currencies/divize/statistik.

---

## missionStore.ts — `useMissionStore`

Mission lifecycle: dispatch → tick → collect → dismiss.

### State

```typescript
interface MissionStore {
  availableMissions: Mission[]; // mise pro aktuálně vybraný region
  activeMissions: ActiveMission[]; // dispatched, zatím neskončené
  completedQueue: CompletedMissionResult[]; // čeká na UI pickup
  loading: boolean;
}

interface CompletedMissionResult {
  activeMission: ActiveMission;
  mission: Mission;
  result: MissionResult;
  rewards: MissionRewards;
  alertGain: number;
  affectedAgentIds: string[];
  injuredAgents: InjuredAgentInfo[]; // { id, name, severity, description?, healsAt }
  rankedUpAgents: Array<{ id; name; newRank }>;
  killedAgent?: { id; name };
  lostEquipment?: Array<{ id; name }>; // při partial rescue
}
```

### dispatch(mission, agents, equippedIds=[], approach='standard')

```
1. Zkontroluj intel affordability (pokud mission.intelCost > 0)
2. Přečti region.alertLevel z DB
3. engineDispatch() → ActiveMission (successChance + completesAt předpočítáno)
4. DB transakce:
   - activeMissions.add(activeMission)
   - agents: status → 'on_mission'
   - region: odstraní mission.id z availableMissionIds
5. Po transakci: odečti intel (spendCurrencies)
6. Aktualizuj store (přidej do activeMissions, odstraň z availableMissions)
7. incrementMissionAttempted()
```

### collectResult(activeMissionId) → CompletedMissionResult | null

Nejkomplexnější akce — resolvuje výsledky mise v jedné DB transakci.

```
1. Načti activeMission + mission z DB
2. resolveMission() → { result, rewards, alertGain }
3. Načti agenty + safe house moduly (training_center, black_site, med_bay, saferoom)
4. Aplikuj moduly:
   - training_center: perAgentXp × 1.25
   - black_site:      alertGain × 0.8
   - med_bay:         healTime × 0.5
   - saferoom:        při catastrophe 30% šance agent unikne zajetí → status='injured' (serious), rescue mise se nevytvoří

5. Pre-generuj rescue misi pokud catastrophe (atomicky)

6. DB transakce:
   a) activeMissions.update → { result, collected: true }
   b) Pro každého agenta:
      - rollInjury() → pokud injured: status='injured', injuredAt, healsAt, injuryDescription
      - rollInjuryDescription() → flavor text podle kategorie mise a severity
      - XP += perAgentXp; missionsAttempted++
      - Pokud success/partial: missionsCompleted++
      - canRankUp() → rankUp() → agents.put(ranked)
      - Catastrophe: první agent → status='captured', capturedAt, rescueMissionId
        (pokud hasSaferoom a rand() < 0.3 → místo zajetí serious injury; rescue mise se nepřidá; incrementStat('agents') se nevolá)
   c) Rescue mission outcomes:
      - success: agent.status='available', capturedAt/rescueMissionId cleared
      - partial: agent freed + equipment cleared (30% refund), addCurrencies({money: refund})
      - failure/catastrophe: escalate (nová rescue miss diff+1) nebo kill (diff≥5)
   d) Persistence rescue mise do DB (missions.add + regions.update)
   e) region.alertLevel = min(3, current + effectiveAlertGain)
   f) missionTier update (count missionLog kde regionId == mise.regionId)
   g) missionLog.add(logEntry)

7. Chain follow-up (po transakci):
   - Pokud result=='success' AND mission.chainNextTargetId:
     generateChainMission() → missions.add + regions.update

8. addCurrencies(rewards) → gameStore
9. Pokud success: incrementMissionCompleted()
   Pokud totalMissionsCompleted >= 15 AND !blackMarketUnlocked: unlockBlackMarket()
10. Vrátí CompletedMissionResult, přidá do completedQueue
```

### tickMissions() — voláno každou 1s

```
Ochrana před re-entrancy: _ticking flag

1. Auto-heal: agents WHERE status='injured' AND healsAt <= now
   → status='available', healsAt/injuredAt/injuryDescription cleared

2. Capture expiry: agents WHERE status='captured'
   → Načti rescueMission → pokud expired nebo neexistuje:
   → agent.status='dead', incrementStat('agents')
   → showToast('error', '{name} byl zabit — záchranná mise vypršela.')

3. Collect completed: activeMissions WHERE !result AND completesAt <= now
   → collectResult(am.id) pro každou

4. Resolve travel: agents WHERE status='traveling' AND arrivesAt <= now
   → status='available', safeHouseId=travelDestinationId, cleared
```

### checkExpirations(regionId) — voláno při otevření MissionsScreen

```
1. Odstraň expired mise (expiresAt < now)
2. Pokud chybí diff-1 mise: vygeneruj 1 okamžitě (guaranteeEasy=true)
   Pokud pool plný: drop nejnovější non-rescue misi
3. Pokud needed > 0 (pod MIN=3): generuj chybějící
4. Timed regen: pokud pod MAX=4 AND interval prošel: generuj 1
```

### invalidateRegionMissions(regionId)

Smaže všechny non-rescue, non-lockedByDivision mise, regeneruje region.
Volá se po přiřazení/odebrání divize ze safe house.

---

## uiStore.ts — `useUIStore`

### State

```typescript
interface UIStore {
  activeTab: 'map' | 'missions' | 'agents' | 'base' | 'menu';
  selectedRegionId: string | null;
  selectedAgentId: string | null;
  toasts: Toast[]; // max 3, LIFO
  saveSwitchRequested: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  expiresAt: number; // now + 3500ms
}
```

### Akce

| Akce                       | Popis                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| `setActiveTab(tab)`        | Přepne aktivní tab                                                            |
| `selectRegion(id)`         | Nastaví selectedRegionId                                                      |
| `selectAgent(id)`          | Nastaví selectedAgentId                                                       |
| `showToast(type, message)` | Přidá toast; max 3 (nejstarší odstraněn); auto-dismiss za 3.6s (`setTimeout`) |
| `dismissToast(id)`         | Odstraní konkrétní toast                                                      |
| `requestSaveSelect()`      | saveSwitchRequested=true → App.tsx přejde na landing                          |
| `clearSaveSwitchRequest()` | Resetuje flag                                                                 |

Toast auto-dismiss: `showToast` nastaví `setTimeout(dismissToast, 3600ms)`.

---

## Hooks

### useMissionTimer() — interval 1s

```typescript
useEffect(() => {
  const id = setInterval(() => useMissionStore.getState().tickMissions(), 1000);
  return () => clearInterval(id);
}, []);
```

### usePassiveIncome() — interval 30s

```typescript
useEffect(() => {
  const id = setInterval(async () => {
    if (!useGameStore.getState().loaded) return;
    const [safeHouses, divisionLevels, agents] = await loadFromDB();
    const income = calculatePassiveIncome(safeHouses, divisionLevels, agents);
    useGameStore.getState().addCurrencies(income);
    // Alert decay pro každý owned region
    for (const region of owned regions) {
      const sh = safehouseForRegion(region.id);
      const hasSurv = sh?.assignedDivisions.includes('surveillance');
      const hasJammer = sh?.modules.includes('signal_jammer');
      const newAlert = decayAlertLevel(region.alertLevel, hasSurv, hasJammer);
      await db.regions.update(region.id, { alertLevel: newAlert });
    }
  }, 30000);
  return () => clearInterval(id);
}, []);
```

### useConstructionTicker() — interval 5s

```typescript
useEffect(() => {
  const id = setInterval(async () => {
    if (!useGameStore.getState().loaded) return;
    const now = Date.now();

    // Dokonči expanze
    const regions = await db.regions
      .filter(
        (r) => r.constructionInProgress && r.constructionCompletesAt <= now,
      )
      .toArray();
    for (const region of regions) {
      // Vytvoř safe house pro region
      // Generuj mise + recruitment pool
      // db.regions.update: constructionInProgress=false, owned=true, safeHouseId
      // incrementStat('expansions')
      // showToast('success', `Expanze do ${city.name} dokončena!`)
    }

    // Dokonči upgrady safe housů
    const houses = await db.safeHouses
      .filter((sh) => sh.upgradeInProgress && sh.upgradeCompletesAt <= now)
      .toArray();
    for (const sh of houses) {
      await db.safeHouses.update(sh.id, {
        level: sh.level + 1,
        upgradeInProgress: false,
        upgradeCompletesAt: undefined,
      });
    }
  }, 5000);
  return () => clearInterval(id);
}, []);
```
