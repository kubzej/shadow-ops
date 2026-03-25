# Shadow Ops — Datové typy a DB schéma

Všechny typy jsou definovány v `src/db/schema.ts`.

## Aktualizace: Achievement systém

- `GameState` nově obsahuje:
  - `unlockedAchievements?: string[]` — pole ID odemčených achievementů
  - `achievementCounters?: AchievementCounters` — countery pro evaluaci podmínek
- Přidán typ `AchievementCounters` (viz níže).
- Katalog achievementů: `src/data/achievements.ts` (50 achievementů, 7 kategorií).
- Engine: `src/engine/achievementEngine.ts` — trigger funkce volané ze stores a hooků.
- UI: `src/screens/AchievementsScreen.tsx` — přístupné z MenuScreen.

### AchievementCounters

```typescript
interface AchievementCounters {
  totalAgentsRecruited: number;
  totalFlashMissionsCompleted: number;
  totalChainMissionsCompleted: number;
  totalCovertMissionsCompleted: number;
  totalAggressiveMissionsCompleted: number;
  totalRescueMissionsCompleted: number;
  totalCounterOpMissionsCompleted: number;
  totalNoAlertMissionsCompleted: number;
  totalModulesInstalled: number;
  totalRivalOperationsEncountered: number;
  totalRivalOperationsBlocked: number;
  totalWorldEventMissionsCompleted: number;
  missionsWithoutLoss: number; // resetuje se při ztrátě agenta
  totalDirectorsRaised: number; // lifetime počet agentů povýšených na Ředitele
  lifetimeMoneyEarned: number; // kumulativní příjmy $ (trackovány z addCurrencies)
  lifetimeMoneySpent: number; // kumulativní výdaje $ (trackovány ze spendCurrencies)
  rivalOpsTodayDate?: string; // ISO datum (YYYY-MM-DD) pro daily rival check
  lastLoginDate?: string; // ISO datum (YYYY-MM-DD) posledního přihlášení
}
```

String pole (`rivalOpsTodayDate`, `lastLoginDate`) se nastavují přes `store.setAchievementCounterString(key, value)` — separátní akce v gameStore (nepoužívá `incrementAchievementCounter`).

---

## Aktualizace: Director rank (pátý rank)

- `GameState` nově obsahuje `directorAgentId?: string` — ID agenta s Director rankem (globálně unikátní).
- `AgentRank` rozšířen o `'director'`.
- `XP_TO_RANK` pro veteran: 4 000 (dříve Infinity), pro director: Infinity.
- `RANK_MULT` pro director: 3.4×.
- `RANK_SALARY_MULT` pro director: 3.0×.

---

## Aktualizace: Rival + Counter-Ops

- `GameState` nově obsahuje rival stav:
  - `rivalName?: string`
  - `nextRivalOperationAt?: number`
  - `activeRivalOperation?: ActiveRivalOperation`
  - `rivalAggressionLevel?: number`
- `SafeHouse` nově obsahuje `disabledModules?: Array<{ moduleId; until; reason: 'rival_sabotage' }>`
- `RegionState` nově obsahuje časově omezené rival efekty:
  - `rivalLeakUntil?: number`
  - `burnedContractsUntil?: number`
- `Mission` nově obsahuje:
  - `isCounterOp?: boolean`
  - `rivalOperationId?: string`
- Přidán typ `RivalEventType` + `ActiveRivalOperation`.

---

## GameState (singleton, id = 1)

```typescript
interface GameState {
  id: 1;
  agencyName: string;
  bossName: string;
  startCityId: string;
  logoId: string;
  createdAt: number; // timestamp
  lastSavedAt: number; // timestamp
  totalPlayTime: number; // kumulativní sekundy (session se přičítá za běhu)

  // Měny
  money: number; // $
  intel: number; // ◈
  shadow: number; // ◆
  influence: number; // ✦

  // Flags
  blackMarketUnlocked: boolean; // odemkne se při 15 úspěšných misích

  // Divize
  unlockedDivisions: DivisionId[];
  divisionLevels: Record<DivisionId, number>; // 0=locked, 1–3=level

  // Statistiky
  totalMissionsCompleted: number;
  totalMissionsAttempted: number;
  totalAgentsLost: number;
  totalExpansions: number;
  // Director — globálně unikátní rank
  directorAgentId?: string; // ID agenta s Director rankem (max 1 najednou)
  // Achievementy
  unlockedAchievements?: string[]; // pole achievement ID
  achievementCounters?: AchievementCounters; // countery pro evaluaci podmínek
}
```

---

## SafeHouse

```typescript
interface SafeHouse {
  id: string; // = regionId
  regionId: string;
  level: number; // 1–5
  index?: number; // pořadí vytvoření (1 = domovský, 2 = první expanze…)
  assignedDivisions: DivisionId[]; // max. dle SAFE_HOUSE_DIVISION_SLOTS[level]
  modules: string[]; // IDs z MODULE_CATALOG, max 2 najednou
  createdAt: number;

  // Upgrade safe house (level++)
  upgradeInProgress?: boolean;
  upgradeCompletesAt?: number;

  // Výstavba (nový safe house po expanzi)
  constructionInProgress?: boolean;
  constructionCompletesAt?: number;
}
```

**Limity dle úrovně:**

| Level | Kapacita agentů | Division sloty | Upgrade cena (money/intel) | Upgrade čas |
| ----- | --------------- | -------------- | -------------------------- | ----------- |
| 1     | 3               | 2              | —                          | —           |
| 2     | 5               | 3              | 2 000 / 20                 | 120s        |
| 3     | 8               | 4              | 6 000 / 50                 | 300s        |
| 4     | 12              | 6              | 20 000 / 120               | 600s        |
| 5     | 18              | 9              | 60 000 / 250               | 1 200s      |

---

## Agent

```typescript
type AgentStatus =
  | 'available'
  | 'on_mission'
  | 'injured'
  | 'captured'
  | 'traveling'
  | 'dead';

interface AgentStats {
  stealth: number; // 0–99
  combat: number; // 0–99
  intel: number; // 0–99
  tech: number; // 0–99
}

interface AgentEquipmentSlot {
  equipmentId: string | null;
}

interface Agent {
  id: string;
  name: string;
  typeId: string; // AgentType.id
  division: DivisionId;
  rank: AgentRank; // 'recruit' | 'operative' | 'specialist' | 'veteran'
  stats: AgentStats; // aktuální (base + equipment bonusy)
  baseStats: AgentStats; // bez equipmentu (pro rank-up a reset)
  xp: number;
  xpToNextRank: number; // z XP_TO_RANK[rank]
  status: AgentStatus;
  safeHouseId: string;
  equipment: AgentEquipmentSlot[]; // vždy 3 sloty

  // Zranění
  injuredAt?: number;
  healsAt?: number; // timestamp, kdy se agent uzdraví
  injuryDescription?: string; // flavor text zranění (např. "Střelná rána do ramene při úniku")

  // Cestování (přesun mezi safe houses)
  travelDestinationId?: string;
  arrivesAt?: number;

  // Mise statistiky
  missionsCompleted: number;
  missionsAttempted: number;
  missionStreak: number; // po sobě jdoucí úspěchy bez injury/failure (reset při failure/partial/injury)

  // Zajetí
  capturedAt?: number;
  rescueMissionId?: string; // ID rescue mise (pokud existuje)

  recruitedAt: number; // timestamp
  nickname?: string; // udělena při postupu na Vetán; formát "the X" (např. "the Ghost")
}
```

**XP pro rank-up:**

| Rank → nový rank         | XP threshold |
| ------------------------ | ------------ |
| recruit → operative      | 400          |
| operative → specialist   | 1 000        |
| specialist → veteran     | 2 000        |
| veteran → director       | 4 000        |
| director (max)           | Infinity     |

Director rank je globálně unikátní — pouze 1 agent agentury může být Ředitelem najednou.
Pokud je slot obsazen, veterán s dostatkem XP čeká na uvolnění slotu (smrt nebo dismiss direktora).

**Stat multiplikátor dle ranku (pro generaci statů):**

| Rank       | Mult |
| ---------- | ---- |
| recruit    | 1.0× |
| operative  | 1.5× |
| specialist | 2.0× |
| veteran    | 2.6× |
| director   | 3.4× |

---

## RegionState

```typescript
interface RegionState {
  id: string; // = Region.id
  owned: boolean;
  alertLevel: number; // 0.0–3.0, float; ovlivňuje mise a obtížnost
  distanceFromStart: number;
  safeHouseId?: string; // vyplněno pokud owned a safe house existuje

  availableMissionIds: string[];
  lastMissionGeneratedAt?: number;

  constructionInProgress?: boolean;
  constructionCompletesAt?: number;

  /** Minimální floor obtížnosti (0–4). Narůstá s počtem dokončených misí, nikdy neklesá. */
  missionTier?: number;
  /** Timestamp kdy se má příště spawnout Flash Operation v tomto regionu. Persistováno do DB. */
  nextFlashMissionAt?: number;
}
```

**MissionTier thresholds** (celkový počet misí dokončených v regionu):

| Tier | Potřebné mise |
| ---- | ------------- |
| 0    | 0             |
| 1    | 8             |
| 2    | 20            |
| 3    | 45            |
| 4    | 80            |

---

## Mission

```typescript
type MissionResult = 'success' | 'partial' | 'failure' | 'catastrophe';

interface MissionRewards {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
  xp: number;
}

interface Mission {
  id: string;
  regionId: string;
  category: MissionCategory; // = DivisionId (viz níže)
  targetId: string; // MissionTarget.id
  complicationId?: string; // MissionComplication.id

  title: string; // "{target.name} — {region.name}"
  flavor: string; // narrativní text z FLAVOR_TEMPLATES

  difficulty: number; // 1–5
  minAgents: number;
  maxAgents: number;

  requiredDivisions?: DivisionId[]; // prázdné nebo undefined = diff-1 (otevřené všem)
  minStats?: Partial<AgentStats>; // alespoň 1 agent musí splňovat

  baseSuccessChance: number; // 0.1–0.85, před modifikátory
  baseDuration: number; // sekundy, před modifikátory

  rewards: MissionRewards;
  failurePenalty: MissionRewards; // záporné hodnoty = penalty

  alertGain: number; // před approach/module modifikátory
  isRescue?: boolean;
  capturedAgentId?: string; // u rescue misí: ID zachraňovaného agenta
  isFlash?: boolean; // Flash Operation — speciální typ, viz Game Mechanics

  intelCost?: number; // intel potřebný k odeslání

  // Chain mise
  chainNextTargetId?: string; // po úspěchu auto-generuje follow-up s tímto target
  chainStep?: number; // 1-based pozice v řetězci
  chainTotal?: number; // celkový počet kroků řetězce
  lockedByDivision?: string; // chain mise čeká na tuto divizi v safe house

  expiresAt?: number; // timestamp vypršení
  createdAt: number;
}
```

**Base success chance dle obtížnosti:** `max(0.1, 0.85 - (diff - 1) × 0.09)`

| Diff | baseSuccessChance      |
| ---- | ---------------------- |
| 1    | 0.85                   |
| 2    | 0.76                   |
| 3    | 0.67                   |
| 4    | 0.58                   |
| 5    | 0.49 (clamped min 0.1) |

**minAgents/maxAgents:**

- diff ≤ 2: min=1, max=1+floor(diff×0.8)
- diff ≤ 4: min=2, max=2+floor(diff×0.8)
- diff 5: min=3, max=3+floor(diff×0.8) (max 6)

**Base duration:**

| Diff | Duration |
| ---- | -------- |
| 1    | 120s     |
| 2    | 240s     |
| 3    | 480s     |
| 4    | 600s     |
| 5    | 720s     |

---

## ActiveMission

```typescript
interface ActiveMission {
  id: string;
  missionId: string;
  agentIds: string[];
  equipmentIds: string[]; // IDs equipmentu lídra (pro duration modifikátory)
  startedAt: number;
  completesAt: number; // timestamp

  successChance: number; // předpočítáno při dispatch (neaktualizuje se)
  approach: 'standard' | 'aggressive' | 'covert';

  result?: MissionResult; // vyplní se při collectResult()
  collected?: boolean; // true = odměny odebrány
}
```

---

## RecruitmentOffer / RecruitmentPool

```typescript
interface RecruitmentOffer {
  id: string;
  agentTypeId: string;
  name: string;
  rank: AgentRank;
  stats: AgentStats;
  cost: number; // money
  expiresAt: number; // timestamp (5 minut od generace)
}

interface RecruitmentPool {
  id: string; // = safeHouseId
  safeHouseId: string;
  offers: RecruitmentOffer[];
  refreshesAt: number; // automatický refresh za 5 minut
}
```

**Rank pool dle úrovně safe house:**

- Lv1: pouze recruit
- Lv2: recruit + operative
- Lv3: recruit + operative + operative + specialist (vyšší šance na operativa/specialistu)
- Lv4: recruit + operative + specialist + specialist + veteran
- Lv5: recruit + operative + specialist + veteran + veteran

**Cena náboru (recruitCost × rankMult):**

| Rank       | Mult |
| ---------- | ---- |
| recruit    | 1.0× |
| operative  | 1.6× |
| specialist | 2.4× |
| veteran    | 3.5× |

---

## BlackMarket

```typescript
interface BlackMarketListing {
  equipmentId: string; // ID z EQUIPMENT_CATALOG nebo speciální sentinel
  costShadow: number;
  costInfluence: number;
  costMoney?: number;
}

interface BlackMarket {
  id: 1; // singleton
  listings: BlackMarketListing[];
  refreshesAt: number; // automatický refresh za 5 minut
}
```

**Speciální sentinelové equipmentId:**

- `__agent__{division}__{rank}__` → speciální agent (division: blackops/extraction/cyber/sabotage)
- `__expansion_skip__` → přeskočí build time pro jeden region

---

## MissionLogEntry

```typescript
interface MissionLogEntry {
  id: string;
  missionId: string;
  activeMissionId: string;
  agentIds: string[];
  regionId: string;
  result: MissionResult;
  rewards: MissionRewards;
  completedAt: number;
  alertGain: number;
}
```

Slouží k výpočtu `missionTier` (count per regionId) a historii.

---

## SaveSlot metadata (separátní DB)

```typescript
interface SaveSlot {
  id: string;
  agencyName: string;
  bossName: string;
  logoId: string;
  createdAt: number;
  lastSavedAt: number;

  // Snapshot pro slot picker
  money: number;
  intel: number;
  totalMissionsCompleted: number;
}
```
