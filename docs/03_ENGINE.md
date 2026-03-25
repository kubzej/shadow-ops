# Shadow Ops — Engine vrstva

Všechny výpočty jsou deterministické (seedovaný RNG přes `createRng()` z `src/utils/rng.ts`).

## Aktualizace: Rival + Counter engine

### missionGenerator.ts

- Přidána `generateCounterOp(regionId, alertLevel, rivalOperationId?)`.
- Přidána konstanta `COUNTER_OP_EXPIRY_MS = 20 min`.
- Counter mise má `isCounterOp=true`, `category='counter'`, vlastní reward/penalty profil.
- Přidána `maxMissionsForRegion(missionTier, alertLevel, ownedSafeHouses)`.
  - Base cap: 6
  - Dynamické bonusy dle tieru/alertu/sítě
  - Hard cap: 10

### missionResolver.ts

- `CATEGORY_STAT_WEIGHTS` rozšířeno o `counter`.

### rival.ts (nové helpery)

- `pickRivalEventType()`
- `createRivalOperation(regionId, eventType)`
- `nextRivalOperationAt(from)`
- `applyRivalOperation(op)`

`applyRivalOperation()` pokrývá:

- asset compromise (demote + XP reset),
- intel theft,
- sabotage (dočasně nefunkční modul),
- agent recruitment,
- disinformation,
- rival leak,
- burned contracts,
- safe house swap.

### usePassiveIncome scheduler

- Rival scheduler běží v 30s ticku.
- Vytváří pending rival operation, generuje counter misi, aplikuje rival event při timeoutu.
- Současně řeší auto-spawn counter misí podle alert thresholdů.

---

## missionResolver.ts

### Stat váhy dle kategorie

```typescript
CATEGORY_STAT_WEIGHTS = {
  surveillance: { stealth: 0.4, combat: 0.1, intel: 0.35, tech: 0.15 },
  cyber: { stealth: 0.2, combat: 0.05, intel: 0.3, tech: 0.45 },
  extraction: { stealth: 0.25, combat: 0.4, intel: 0.15, tech: 0.2 },
  sabotage: { stealth: 0.2, combat: 0.35, intel: 0.1, tech: 0.35 },
  influence: { stealth: 0.25, combat: 0.05, intel: 0.55, tech: 0.15 },
  finance: { stealth: 0.2, combat: 0.05, intel: 0.35, tech: 0.4 },
  logistics: { stealth: 0.3, combat: 0.2, intel: 0.25, tech: 0.25 },
  blackops: { stealth: 0.3, combat: 0.45, intel: 0.15, tech: 0.1 },
};
```

### calculateSuccessChance(agents, mission, alertLevel=0, approach='standard')

```
1. Pro každého agenta vypočítat score = stealth×w.s + combat×w.c + intel×w.i + tech×w.t
2. leader = agent s nejvyšším score, leaderScore = jeho skóre

3. statBonus  = (leaderScore - 50) / 100 × 0.4
              → neutral agent (50 score) = 0 bonus
              → max veteran přibližně +0.14

4. maxTeamBonus dle diff: { 1:0.06, 2:0.07, 3:0.08, 4:0.10, 5:0.12 }
   fillRatio = (agents.length - 1) / (mission.maxAgents - 1)   [0 pro 1 agenta]
   teamBonus = fillRatio × maxTeamBonus
              → přidání agentů nikdy nesnižuje šanci

5. equipBonus = sum(leader.equipment.successBonus) / 100
              → pouze sloty lídra (3 sloty max)

6. streakBonus = floor(leader.missionStreak / 5) × 0.02, max 0.10
               → +2% za každých 5 čistých misí v řadě (bez injury ani failure)
               → pouze leader's streak se počítá

7. compPenalty = complication.difficultyMod × 0.06

8. alertPenalty = (alertLevel / 3) × 0.2
               → max −0.20 při alertLevel 3.0

9. raw = baseSuccessChance + statBonus + teamBonus + equipBonus + streakBonus − compPenalty − alertPenalty
10. final = clamp(raw × APPROACH_MODS[approach].successMult, 0.05, 1.0)
```

**Příklad:** diff-3 mise, 1 operativa (score 60), žádný equipment, alert=0, standard:

- base = 0.67
- statBonus = (60−50)/100 × 0.4 = +0.04
- teamBonus = 0 (1 agent)
- final = clamp(0.71, 0.05, 1.0) = **0.71**

### calculateDuration(mission, agents, equippedIds=[], approach='standard')

```
1. avgScore = teamAvgStats(agents) × kategoriové váhy

2. speedFactor = 1 - ((avgScore - 50) / 100) × 0.3
              → max −30% pro velmi silný tým (score 100)

3. equipMult = multiplicativní součin durationMult všech equippedIds

4. duration = round(baseDuration × speedFactor × equipMult × APPROACH_MODS[approach].durationMult)
5. return max(30, duration)   → minimum 30 sekund
```

### resolveMission(activeMission, mission)

```
roll = rand() ∈ [0, 1)
sc   = activeMission.successChance

if roll < sc × 0.15          → 'success'      rewards × 1.3,  alertGain × 0.2
else if roll < sc             → 'success'      rewards × 1.0,  alertGain × 0.5
else if roll < sc+(1−sc)×0.4 → 'partial'      rewards × 0.4,  alertGain × 1.0
else:
  catastropheShare = (difficulty - 1) × 0.04
  if catastropheShare > 0 AND roll >= sc + (1−sc) × (1 − catastropheShare):
                              → 'catastrophe'  penalty × 1.5,  alertGain × 2.0
  else                        → 'failure'      penalty × 1.0,  alertGain × 1.5

Všechny alertGain × APPROACH_MODS[approach].alertMult
Při success a diff ≥ 2: rewards.shadow += 1
```

### distributeXp(result, baseXp, agentCount)

```
resultMult = { success: 1.0, partial: 0.5, failure: 0.25, catastrophe: 0.1 }
teamSplit  = max(0.4, 1 − (agentCount − 1) × 0.1)
xpPerAgent = round(baseXp × resultMult[result] × teamSplit)
```

| agentCount | teamSplit                               |
| ---------- | --------------------------------------- |
| 1          | 1.0                                     |
| 2          | 0.9                                     |
| 3          | 0.8                                     |
| 4          | 0.7                                     |
| 5          | 0.6                                     |
| 6          | 0.5 (ale min 0.4 platí od agentCount=7) |

### rollInjury(result, difficulty) → 'none' | 'light' | 'serious' | 'critical'

```
baseChance = { success: 0.03, partial: 0.15, failure: 0.30, catastrophe: 0.80 }
chance     = baseChance[result] + (difficulty − 1) × 0.02

roll = rand()
if roll > chance → 'none'

Severity distribution (lightMult a seriousMult posouvají rozdělení s diff):
lightMult   = 0.50 + (difficulty − 1) × 0.06   → diff1: 0.50, diff5: 0.74
seriousMult = 0.20 + (difficulty − 1) × 0.04   → diff1: 0.20, diff5: 0.36

if roll > chance × lightMult   → 'light'
if roll > chance × seriousMult → 'serious'
else                           → 'critical'
```

**Healing durations (bez med_bay):**

| Severity | Čas            |
| -------- | -------------- |
| light    | 60s            |
| serious  | 300s (5 min)   |
| critical | 1200s (20 min) |

Med Bay modul: healing time × 0.5 (zaokrouhleno nahoru).

Saferoom modul: při výsledku `catastrophe` je 30% šance že první agent **není zajat** — místo toho dostane zranění severity `serious` (Med Bay se aplikuje normálně). Rescue mise se v takovém případě nebytvoří a agent se nezapočítává do ztracených agentů.

### rollInjuryDescription(category, severity, rng) → string

Vybere náhodný flavor text zranění podle kategorie mise a severity.

```
category: surveillance | cyber | extraction | sabotage | influence |
          finance | logistics | medical | blackops
severity: 'light' | 'serious' | 'critical'
```

Každá kombinace má 3 varianty. Příklady:

- extraction + critical → "Střelná rána do hrudníku"
- cyber + serious → "Střepiny z výbuchu serveru v obličeji"
- surveillance + light → "Odřeniny při úniku přes střechy"

Fallback pro neznámou kategorii: generické popisy dle severity.

### checkAgentEligibility(agent, mission)

- Diff 1: vždy eligible (žádné division check)
- Diff 2+: agent.division musí být v mission.requiredDivisions
- minStats: každý definovaný stat musí být ≥ agent.stats[stat]
- Vrací `{ eligible, missingDivision, missingStats[] }`

### checkTeamEligibility(agents, mission)

- True pokud alespoň 1 agent je plně eligible
- True pokud mission nemá requiredDivisions ani minStats

---

## missionGenerator.ts

### generateMission(regionId, alertLevel, existingIds?, availableDivisions?, maxDiff?, minDiff?)

```
1. effectiveAlert = min(3, alertLevel + country.baseAlertLevel × 0.3)

2. Kategorie (weighted pick z CATEGORY_ORDER):
   CATEGORY_ORDER = ['surveillance','logistics','cyber','finance','influence','extraction','sabotage','blackops']
   base weights   = [10, 8, 8, 6, 6, 5, 4, 3]
   Každá váha += (effectiveAlert × 2 − 3) × danger  (danger = index/7, 0→1)
   Pokud availableDivisions: přiřazená kategorie ×4, ostatní ×0
   → Nízký alert preferuje surveillance/logistics, vysoký sabotage/blackops
   → Přiřazené divize silně dominují

3. Target: pickRandom(TARGET_POOLS.filter(t.category === category))

4. Difficulty:
   baseDiff = 1 + round(effectiveAlert × 1.2 + randFloat(−0.5, 0.5))
   difficulty = clamp(baseDiff, minDiff ?? 1, maxDiff ?? 5)

5. Complication:
   chance = diff == 1 ? 0.15 : 0.1 + diff × 0.1
   → diff1: 15%, diff2: 30%, diff3: 40%, diff4: 50%, diff5: 60%

6. minStats:
   MIN_STAT_BY_DIFFICULTY = { 1: 0, 2: 15, 3: 40, 4: 55, 5: 65 }
   primaryStat = CATEGORY_PRIMARY_STAT[category]
   → pokud threshold > 0: minStats = { [primaryStat]: threshold }

7. Rewards:
   diffMult = [0, 1.2, 2.5, 10.0, 15.0, 25.0][difficulty]
   money = round(target.baseRewardMoney × diffMult × randFloat(0.85, 1.15))
   intel/shadow/influence = round(target.baseReward* × diffMult)
   xp = round(30 + diff × 20 + (complication ? 15 : 0))

8. failurePenalty:
   intel    = −round(rewards.intel × 0.5)
   influence = −round(rewards.influence × 0.3)
   xp       = round(10 + diff × 5)   ← vždy pozitivní, motivace pokračovat

9. alertGain = (target.alertGain + (complication ? 0.1 : 0)) × 1.5

10. Expiry:
    diff ≥ 3: now + 30min × difficulty
    diff < 3: now + 4 hodiny

11. requiredDivisions = diff == 1 ? [] : [category]
```

### generateMissionsForRegion(regionId, alertLevel, count, existingIds?, availableDivisions?, guaranteeEasy?, missionTier?)

- Index 0 + guaranteeEasy: vždy diff 1 (pro emergency topup)
- Poslední mise + missionTier > 0: minDiff = missionTier + 1 (garantovaná výzva pro veterány)
- Zbytek: normální generateMission()

### generateFlashMission(regionId, alertLevel, availableDivisions?)

```
1. Kategorie: stejný weighted pick jako generateMission() (ovlivněný alertLevel + available divisions)
2. Obtížnost: max(3, min(5, 3 + round(effectiveAlert × 0.6 + rand(−0.3, 0.3))))
   → Vždy diff 3–5, nikdy méně
3. Komplíkace: vyšší pravděpodobnost (urgentnost = méně přípravy)
   chance = 0.1 + difficulty × 0.1
4. Rewards: normální výpočet × 1.5 (shadow bonus +8 se přidává v collectResult)
5. expiresAt: now + 5 minut (pouze dispatch window, mise samá trvá normálně)
6. isFlash: true
```

**Konstanty:**

```
FLASH_MISSION_INTERVAL_MIN_MS = 10 × 60 × 1000   // 10 minut
FLASH_MISSION_INTERVAL_MAX_MS = 15 × 60 × 1000   // 15 minut
FLASH_MISSION_MIN_TIER        = 2                 // missionTier potřebný pro spawn
FLASH_MISSION_EXPIRY_MS       = 5 × 60 × 1000    // 5 minut
FLASH_MISSION_SHADOW_BONUS    = 8                 // garantovaný shadow bonus
```

### generateRescueMission(regionId, capturedAgentId, agentName, alertLevel)

```
difficulty = min(5, max(2, round(alertLevel × 1.5 + 2)))
baseSuccessChance = max(0.1, 0.7 − (diff − 2) × 0.1)
expiresAt = now + 15 minut
rewards = { money: 0, intel: 5, shadow: 3, influence: 2, xp: 80 + diff×20 }
failurePenalty = { money: −100, intel: −3, influence: −2, xp: 10 }
category = 'extraction'
targetId = 't39'  (Zajatý agent)
```

### generateChainMission(regionId, alertLevel, chainTargetId, chainStep, chainTotal?, assignedDivisions?)

```
baseDiff = 2 + round(effectiveAlert × 0.8 + randFloat(−0.5, 0.5))
difficulty = max(2, min(5, baseDiff))
baseSuccessChance = max(0.1, 0.8 − (diff − 1) × 0.09)
xp = round(40 + diff × 25)
expiresAt = now + 30min × difficulty
```

---

## agentGenerator.ts

### generateAgentStats(agentTypeId, rank)

```
mult = agentType.rankMultiplier[rank]   // 1.0 / 1.5 / 2.0 / 2.6
stat = clamp(round((base + randInt(−variance, variance)) × mult), 1, 99)
```

### createAgent(agentTypeId, rank, safeHouseId)

- Vygeneruje stats, baseStats = kopie stats
- equipment = [{equipmentId: null}, {equipmentId: null}, {equipmentId: null}]
- xp = 0, xpToNextRank = XP_TO_RANK[rank]
- status = 'available'
- missionsCompleted = 0, missionsAttempted = 0

### canRankUp(agent)

`agent.rank !== 'veteran' AND agent.xp >= agent.xpToNextRank`

### generateNickname(agentId: string) → string

Deterministická funkce — vrátí vždy stejnou přezdívku pro dané `agentId`.

```
1. Hash agentId → 32-bit seed (Mulberry32)
2. pickRandom(AGENT_NICKNAMES, seededRng)
3. Vrátí: "the {slovo}"  (např. "the Ghost", "the Fixer")
```

`AGENT_NICKNAMES` je 55-položkový seznam v `src/data/names.ts`. Seed je odvozen z ID agenta, takže přezdívka je stabilní při každém volání.

### rankUp(agent)

```
newRank    = RANK_ORDER[currentIdx + 1]
newStats   = generateAgentStats(agent.typeId, newRank)    ← nové stats pro vyšší rank
rankedAgent = {
  ...agent,
  rank: newRank,
  xp: 0,
  xpToNextRank: XP_TO_RANK[newRank],
  baseStats: newStats,
  stats: applyEquipmentBonuses(newStats, agent.equipment, newRank),
  nickname: newRank === 'veteran' ? generateNickname(agent.id) : agent.nickname,
}
```

### applyEquipmentBonuses(baseStats, equipment, agentRank='recruit')

```
RANK_NUM = { recruit: 0, operative: 1, specialist: 2, veteran: 3 }

pro každý slot:
  if slot.equipmentId == null → skip
  if eq.minRank && RANK_NUM[agentRank] < RANK_NUM[eq.minRank] → skip (held, inactive)
  result.stealth = clamp(result.stealth + (eq.bonusStealth ?? 0), 0, 99)
  result.combat  = clamp(result.combat  + (eq.bonusCombat  ?? 0), 0, 99)
  result.intel   = clamp(result.intel   + (eq.bonusIntel   ?? 0), 0, 99)
  result.tech    = clamp(result.tech    + (eq.bonusTech    ?? 0), 0, 99)
```

### generateRecruitmentOffer(division, safeHouseLevel)

```
Rank pool dle úrovně SH:
  Lv1: ['recruit']
  Lv2: ['recruit', 'operative']
  Lv3: ['recruit', 'operative', 'operative', 'specialist']
  Lv4: ['recruit', 'operative', 'specialist', 'specialist', 'veteran']
  Lv5: ['recruit', 'operative', 'specialist', 'veteran', 'veteran']
cost = agentType.recruitCost × rankCostMult[rank]
  rankCostMult = { recruit:1.0, operative:1.6, specialist:2.4, veteran:3.5 }
expiresAt = now + 5 minut
```

### generateRecruitmentPool(safeHouseId, activeDivisions, safeHouseLevel, count=3)

3 náhodné nabídky, každá z náhodné divize z activeDivisions.
Pokud activeDivisions prázdné, default ['surveillance', 'cyber'].
`refreshesAt = now + 5 minut`

---

## passiveIncome.ts

### calculateSafeHouseIncome(safeHouse, divisionLevels, agents)

```
income = { money: 0, intel: 0, shadow: 0, influence: 0 }

// Divize (s diminishing returns)
forEach divId in safeHouse.assignedDivisions at slotIndex:
  base     = DIVISION_INCOME[divId]
  mult     = LEVEL_MULT[min(divisionLevels[divId], 3)]
  slotMult = divisionSlotMult(slotIndex)   // 1.0 / 0.8 / 0.65 / 0.5
  income += base × mult × slotMult

// Moduly
forEach modId in safeHouse.modules:
  income += MODULE_INCOME_EFFECTS[modId]   // pokud existuje

// Agent salary
forEach agent (safeHouseId == safeHouse.id):
  income.money -= agentType.salary × RANK_SALARY_MULT[agent.rank]

// Upkeep
income.money -= SAFE_HOUSE_UPKEEP_PER_HOUR[safeHouse.level] / 120
```

### calculatePassiveIncome(safeHouses, divisionLevels, agents)

```
activeSafeHouses = safeHouses.filter(!sh.constructionInProgress)
cityBonus = min(1.5, 1 + 0.1 × max(0, activeSafeHouses.length − 1))

total = sum(calculateSafeHouseIncome(sh, ...) × cityBonus)
return floor(total)   ← integer výsledek
```

### decayAlertLevel(currentAlert, hasSurveillanceDivision, hasSignalJammer=false)

```
decayRate = (hasSurveillanceDivision ? 0.2 : 0.08) + (hasSignalJammer ? 0.1 : 0)
return max(0, currentAlert − decayRate)
```

---

## mapGenerator.ts

### computeDistances(startCityId) → Map<regionId, distance>

BFS přes `REGION_MAP` (neighbor grafy jsou bidirectional).

### expansionCost(regionId, distanceFromStart, totalExpansions=0)

```
scaleMult = min(3.0, 1 + 0.4 × totalExpansions)
country   = COUNTRY_MAP.get(region.countryId)
alertMod  = country?.baseAlertLevel ?? 0

money = round((1000 + 200 × distance + alertMod × 50) × scaleMult)
intel = round((15   + 6   × distance + alertMod × 2)  × scaleMult)
```

**Příklady (0 dosavadních expanzí, alertMod=0):**

| Distance | Money | Intel |
| -------- | ----- | ----- |
| 1        | 1 200 | 21    |
| 2        | 1 400 | 27    |
| 3        | 1 600 | 33    |

**Scale multiplier dle počtu expanzí:**

| totalExpansions | scaleMult  |
| --------------- | ---------- |
| 0               | 1.0×       |
| 1               | 1.4×       |
| 2               | 1.8×       |
| 3               | 2.2×       |
| 5               | 3.0× (cap) |

### expansionBuildTime(distanceFromStart) → ms

```
(60 + 30 × distanceFromStart) × 1000
```

| Distance | Build time |
| -------- | ---------- |
| 1        | 90s        |
| 2        | 120s       |
| 5        | 210s       |

---

## blackMarket.ts

### generateBlackMarketOffer() → BlackMarket

```
listings = []

// 4 standardní listingy (rare + legendary z EQUIPMENT_CATALOG)
forEach x in [1..4]:
  eq = pickRandom(rareLegendaryEquipment)
  costShadow = floor(eq.costMoney / 20)
  costInfluence = floor(eq.costMoney / 30)
  costMoney = isBlackMarket ? eq.costMoney : round(eq.costMoney × 1.4)
  listings.push(...)

// 30% šance: speciální agent listing
if rand() < 0.3:
  division = pickRandom(['blackops', 'extraction', 'cyber', 'sabotage'])
  rank = pickRandom(['specialist', 'veteran'])
  listings.push({ equipmentId: `__agent__${division}__${rank}__`, costShadow: 25, costInfluence: 15 })

// 20% šance: expansion skip
if rand() < 0.2:
  listings.push({ equipmentId: '__expansion_skip__', costShadow: 30, costInfluence: 20 })

refreshesAt = now + 5 minut
```

---

## initializeGame.ts

### initializeGame(agencyName, bossName, startCityId, logoId, slotId)

1. Vytvoří nový slotId → `activateSlot(slotId)` → nastaví localStorage
2. `generateMap(startCityId)` → RegionState[] pro všechna města
3. Vloží GameState (singleton) s výchozími měnami + divizemi
4. Vloží RegionStates do DB
5. Vytvoří SafeHouse pro startCityId (level 1, assignedDivisions = [surveillance, cyber])
6. Vytvoří 2 startovní agenty (shadow + hacker, oba recruits)
7. Vygeneruje 4 startovní mise pro startCity (guaranteeEasy=true)
8. Vygeneruje recruitment pool
9. Vygeneruje black market listing (i když locked)
10. `setLoaded(meta)` → gameStore
11. Uloží metadata do metaDb

### loadGame() → boolean

1. Načte GameState z DB
2. Pokud nenalezena → return false
3. `useGameStore.getState().setLoaded(...)` → naplní store
4. Return true
