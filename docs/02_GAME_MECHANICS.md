# Shadow Ops — Herní mechaniky

---

## Měny (4 typy)

| Symbol | ID        | Zdroj                                           | Využití                                          |
| ------ | --------- | ----------------------------------------------- | ------------------------------------------------ |
| $      | money     | Pasivní příjem, mise (rewards.money)            | Nábor, upgrade SH, moduly, expanze, refresh pool |
| ◈      | intel     | Surveillance/Cyber příjem, mise (rewards.intel) | Dispatch cost, unlock divize, expanzní cena      |
| ◆      | shadow    | Extraction/Sabotage/Blackops příjem, mise       | Black market, unlock elite divizí (Blackops: 40) |
| ✦      | influence | Influence divize příjem, mise                   | Division upgrade Lv3 (30), black market, moduly  |

Měny mají floor 0 (nikdy záporné). `addCurrencies()` floory každou složku.

---

## Divize (9 celkem)

**Odemykání:** one-time cost, globálně pro celou agenturu. Po odemčení lze přiřazovat do safe houses.

| DivisionId   | Název        | Barva   | Unlock cost (money / intel / shadow) | Free? |
| ------------ | ------------ | ------- | ------------------------------------ | ----- |
| surveillance | Surveillance | #4ade80 | 0 / 0 / 0                            | ✓     |
| cyber        | Cyber        | #60a5fa | 0 / 0 / 0                            | ✓     |
| extraction   | Extraction   | #f97316 | 1 200 / 15 / 0                       | —     |
| sabotage     | Sabotage     | #ef4444 | 1 500 / 20 / 10                      | —     |
| influence    | Influence    | #a78bfa | 2 000 / 25 / 0                       | —     |
| finance      | Finance      | #facc15 | 2 000 / 25 / 0                       | —     |
| logistics    | Logistics    | #94a3b8 | 1 200 / 15 / 0                       | —     |
| medical      | Medical      | #2dd4bf | 1 500 / 20 / 0                       | —     |
| blackops     | Black Ops    | #6b7280 | 3 000 / 40 / 40                      | —     |

**Upgrade úrovně:** globální — prospívá každému safe house kde je divize přiřazena.

| Level → | Money  | Intel | Influence |
| ------- | ------ | ----- | --------- |
| Lv1→2   | 4 000  | 60    | —         |
| Lv2→3   | 25 000 | 200   | 30        |

---

## Agenti — přehled

- **4 ranky:** recruit → operative → specialist → veteran
- **9 divizí** × **4 typy** = **36 typů agentů** celkem
- **Stats:** stealth, combat, intel, tech (každý 0–99)
- **Equipment:** 3 sloty, každý může nést 1 item
- **Salary:** dedukována každý 30s tick (agentType.salary × rankSalaryMult)

**Salary multiplikátor dle ranku:**

| Rank       | Mult |
| ---------- | ---- |
| recruit    | 1.0× |
| operative  | 1.3× |
| specialist | 1.7× |
| veteran    | 2.2× |

**Status lifecycle:**

```
available
  ├── dispatch()      → on_mission
  │     ↓ collectResult() — výsledky:
  │     ├── (žádné zranění)  → available
  │     ├── (zranění)        → injured → (healsAt <= now) → available
  │     ├── (catastrophe)    → captured → rescue mission → available / dead
  │     └── (rescue failure diff≥5) → dead
  └── přesun (Relokovat UI) → traveling
        ↓ tickMissions(): arrivesAt <= now
        → available (v cílové safe house)
```

**Přesun agenta (Travel):**

- Agent Detail Modal → "Přesunout" → výběr cílové safe house
- Cena money + čas (dle vzdálenosti safe housů)
- Během cestování: agent nelze dispatche, zobrazuje se countdown a cíl
- `tickMissions()` každou sekundu kontroluje `arrivesAt` a mění status na `available`

**Instant heal cost:** 10 money × rankIndex (recruit=10, operative=20, specialist=30, veteran=40)

---

## Safe Houses

Jeden per vlastněný region. Level se upgraduje placením money+intel, dokončení trvá čas.

**Moduly** (max 2 najednou na jeden safe house):

| Module ID       | Název              | Cena (money/intel/shadow) | Efekt                  |
| --------------- | ------------------ | ------------------------- | ---------------------- |
| server_room     | Server Room        | 3 000 / 30                | +3 intel/tick          |
| lab             | Výzkumná laboratoř | 2 000 / 20                | +2 intel/tick          |
| armory          | Zbrojnice          | 6 000 / — / 40            | +0.1 shadow/tick       |
| finance_hub     | Finanční centrum   | 5 000 / 40                | +4 money/tick          |
| signal_jammer   | Signal Jammer      | 3 500 / 15 + 10 shadow    | alert decay +0.1/tick  |
| med_bay         | Med Bay            | 3 000 / 20                | healing 2× rychlejší   |
| training_center | Výcvikové centrum  | 4 000 / 30                | +25% XP z misí         |
| forgery_lab     | Padělatelna        | 4 500 / 30 + 10 influence | +0.3 influence/tick    |
| black_site      | Black Site         | 5 500 / 20 + 15 shadow    | −20% alert gain z misí |

---

## Mise — základní přehled

**Kategorie misí** (= DivisionId):
`surveillance | cyber | extraction | sabotage | influence | finance | logistics | blackops`

**Obtížnost (1–5):**

- Diff 1 je vždy otevřená — žádné requiredDivisions
- Diff 2+ vyžaduje příslušnou divizi (requiredDivisions = [category])
- Diff 2+: minStats[primaryStat] (15/40/55/65 dle diff)

**Primary stat dle kategorie:**

| Kategorie    | Primary stat |
| ------------ | ------------ |
| surveillance | stealth      |
| cyber        | tech         |
| extraction   | combat       |
| sabotage     | combat       |
| influence    | intel        |
| finance      | tech         |
| logistics    | intel        |
| blackops     | combat       |

**Approach (volí hráč při dispatch):**

| Approach   | Success mult | Duration mult | Alert mult |
| ---------- | ------------ | ------------- | ---------- |
| standard   | ×1.00        | ×1.00         | ×1.00      |
| aggressive | ×1.15        | ×0.75         | ×1.50      |
| covert     | ×0.90        | ×1.30         | ×0.50      |

**Výsledky mise:**

| Výsledek         | Podmínka (roll r, šance sc)                  | Odměny       | Alert gain |
| ---------------- | -------------------------------------------- | ------------ | ---------- |
| critical_success | r < sc × 0.15                                | ×1.3 rewards | ×0.2       |
| success          | r < sc                                       | ×1.0 rewards | ×0.5       |
| partial          | r < sc + (1−sc) × 0.4                        | ×0.4 rewards | ×1.0       |
| catastrophe      | r ≥ sc+(1−sc)×(1−(diff−1)×0.04) AND diff ≥ 2 | ×1.5 penalty | ×2.0       |
| failure          | zbytek                                       | ×1.0 penalty | ×1.5       |

> Catastrophe chance = (diff−1) × 0.04: diff1=0%, diff2=4%, diff3=8%, diff4=12%, diff5=16%
> Na diff 1 catastrophe **není možná**.

**Odměny dle obtížnosti (diffMult):**

| Diff | diffMult |
| ---- | -------- |
| 1    | 1.2      |
| 2    | 2.5      |
| 3    | 10.0     |
| 4    | 15.0     |
| 5    | 25.0     |

`money = target.baseRewardMoney × diffMult × rand(0.85, 1.15)`
`xp = 30 + diff × 20 + (komplikace ? 15 : 0)`
Failure penalty: intel −50% reward, influence −30% reward, xp = 10 + diff × 5 (vždy)

---

## Alert systém

`alertLevel` je float 0.0–3.0 per region.

**Zdroje alertu:**

- Každá mise přidá `alertGain × approachMult × (0.8 pokud black_site)`
- Různé výsledky mise: critical_success ×0.2, success ×0.5, partial ×1.0, failure ×1.5, catastrophe ×2.0

**Decay (per 30s tick):**

```
decayRate = (hasSurveillanceDivision ? 0.2 : 0.08) + (hasSignalJammer ? 0.1 : 0)
newAlert  = max(0, alertLevel - decayRate)
```

| Konfigurace                   | Decay/tick |
| ----------------------------- | ---------- |
| Bez surveillance, bez jammeru | 0.08       |
| Se surveillance, bez jammeru  | 0.20       |
| Bez surveillance, s jammerem  | 0.18       |
| Se surveillance + jammer      | 0.30       |

**Vliv na mise:**

- Alert penalty na success chance: `(alertLevel / 3) × 0.2` (max −0.20 při alert 3.0)
- Generování nových misí: effectiveAlert = `min(3, alertLevel + country.baseAlertLevel × 0.3)`
- Vyšší effectiveAlert → vyšší difficulty generovaných misí, více sabotage/blackops kategorií

**Sémantický gradient pro UI (alertColor):**

| alertLevel | Barva            |
| ---------- | ---------------- |
| < 0.5      | #4ade80 (green)  |
| 0.5 – 1.2  | #a3e635          |
| 1.2 – 2.0  | #facc15 (yellow) |
| 2.0 – 2.7  | #f97316 (orange) |
| ≥ 2.7      | #ef4444 (red)    |

---

## Pasivní příjem (per 30s tick)

**Příjem divize per tick per level:**

| Division     | Money | Intel | Shadow | Influence |
| ------------ | ----- | ----- | ------ | --------- |
| surveillance | 1.5   | 2.0   | 0      | 0         |
| cyber        | 2.0   | 1.5   | 0      | 0         |
| extraction   | 1.5   | 0.5   | 0.5    | 0         |
| sabotage     | 1.5   | 0     | 1.0    | 0         |
| influence    | 1.0   | 0.5   | 0      | 1.5       |
| finance      | 3.0   | 0     | 0.5    | 0         |
| logistics    | 1.5   | 0.5   | 0      | 0.5       |
| medical      | 1.0   | 0.5   | 0      | 0         |
| blackops     | 1.0   | 0     | 1.0    | 0         |

**Level multiplier:** Lv1=1.0×, Lv2=1.4×, Lv3=2.0×

**Slot diminishing returns** (v rámci jednoho safe house):

- 1. divize: 100%
- 2. divize: 80%
- 3. divize: 65%
- 4.+ divize: 50%

**City bonus:** +10% per extra owned miasto (mimo první), cap +50% při 5+ vlastněných.
`cityBonus = min(1.5, 1 + 0.1 × max(0, activeSafeHouses.length - 1))`

**Náklady:**

- Agent salary per tick: `agentType.salary × RANK_SALARY_MULT[rank]`
- Safe house upkeep per tick: `SAFE_HOUSE_UPKEEP_PER_HOUR[level] / 120`

| Level | Upkeep/hod | Upkeep/tick |
| ----- | ---------- | ----------- |
| 1     | 40         | 0.33        |
| 2     | 90         | 0.75        |
| 3     | 180        | 1.50        |
| 4     | 300        | 2.50        |
| 5     | 450        | 3.75        |

---

## Expanze na nové regiony

**Cena expanze:**

```
scaleMult = min(3.0, 1 + 0.4 × totalExpansions)
money = (1000 + 200×distance + country.baseAlertLevel×50) × scaleMult
intel = (15   + 6×distance   + country.baseAlertLevel×2)  × scaleMult
```

**Build time:**

```
(60 + 30 × distanceFromStart) × 1000   [ms]
```

Např. vzdálenost 1: 90s, vzdálenost 3: 150s, vzdálenost 5: 210s.

Po dokončení výstavby: generuje se recruitment pool + 4 mise pro nový region.

---

## Black Market

Odemkne se automaticky po `totalMissionsCompleted >= 15`.

- Refresh každých 5 minut (automaticky nebo manuálně)
- 4 standardní listingy: rare/legendary equipment za shadow + influence
- 30% šance: speciální agent (elite divize, specialist nebo veteran rank)
  - Cena: 25 shadow + 15 influence
  - Divize: blackops, extraction, cyber, sabotage
- 20% šance: expansion skip (přeskočí build time pro 1 region)
  - Cena: 30 shadow + 20 influence

---

## Rescue mise

Vznikají při **catastrophe výsledku** — první agent v týmu je zajat.

**Generace rescue mise:**

```
difficulty = min(5, max(2, round(alertLevel × 1.5 + 2)))
baseSuccessChance = max(0.1, 0.7 - (diff - 2) × 0.1)
expiresAt = now + 15 minut
minAgents = 2, maxAgents = 4
rewards = { money: 0, intel: 5, shadow: 3, influence: 2, xp: 80 + diff×20 }
```

**Výsledky rescue mise:**

- **success:** agent osvobozen, vybavení zachováno
- **partial:** agent osvobozen, vybavení ztraceno (30% refund v money)
- **failure:** eskalace — nová, těžší rescue mise (+1 difficulty)
- **failure na diff 5:** agent umírá, `incrementStat('agents')`

Pokud rescue vyprší bez dokončení (timer v `tickMissions()`), agent umírá.

---

## Chain mise

---

## Flash Operations (Urgentní mise)

Speciální typ mise označený ikonou ⚡. Generují se automaticky per region, persistentně.

**Podmínky spawnu:**

- Region musí mít `missionTier ≥ 2` (aspoň 20 misí dokončeno v regionu)
- Spawn interval: náhodně 10–15 minut po spawnu předchozí flash mise v tomto regionu
- V regionu může být nejvýše 1 flash mise najednou

**Timer persistence:** `nextFlashMissionAt` je uložen v `RegionState` v IndexedDB. Restart appky timer **nepřeruší** — hra pokračuje od správného timestampu.

**Vlastnosti flash mise:**

| Vlastnost         | Hodnota                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Obtížnost         | 3–5 (nikdy méně)                                                                         |
| Dispatch window   | **5 minut** od spawnu (pak vyprší)                                                       |
| Odměny            | ×1.5 na všechny měny (money, intel, shadow, influence, xp)                               |
| Shadow bonus      | **+8 shadow garantovaně** po dokončení (bez ohledu na výsledek misí, přičteno k odměnám) |
| Katastrofa        | Možná (jako normálně dle diff)                                                           |
| requiredDivisions | Ano (dle kategorie, jako diff 3+)                                                        |

**UI:** Karta mise zobrazuje `⚡ URGENTNÍ MISE` badge (žlutý) a vlastní countdown timer. Countdown **bliká červeně** když zbývá méně než 60 sekund.

**Toast notifikace:** Při spawnu flash mise se zobrazí info toast: _"⚡ Urgentní mise v {region} — 5 minut na odeslání!"_

Pokud má `MissionTarget.chainNextTargetId`, po **úspěchu** se automaticky vygeneruje follow-up mise.

- Difficulty chain mise: min 2, computed z alertLevel
- `baseSuccessChance = max(0.1, 0.8 - (diff - 1) × 0.09)`
- XP: `40 + diff × 25` (o něco více než normální mise)
- Pokud safe house nemá patřičnou divizi, chain mise dostane `lockedByDivision` flag
  (existuje v DB, ale je locked pro dispatch dokud se divize nepřiřadí)

---

## MissionTier systém

Každý region má `missionTier` (0–4). Narůstá s počtem dokončených misí v tomto regionu, **nikdy neklesá**.

Při generování misí: poslední mise v batch je garantovaně `difficulty >= missionTier + 1`.
Zajišťuje, že veteráni mají vždy výzvu i ve "starých" regionech.

---

## Globální události (World Events)

Každých ~30 minut se aktivuje náhodný globální event. Každý event je aktivní po svoji dobu trvání, pak nastane 20minutová pauza, pak se aktivuje další event.

**Časování:**

```
Start hry → 5 min klid → Event (5–10 min) → 20 min klid → Event → ...
                                                       ↑
                                   nextWorldEventAt = expiresAt + 20 min
```

**Uložení stavu:** `GameState.activeWorldEvent` (typ `ActiveWorldEvent`) + `GameState.nextWorldEventAt` (timestamp). Oba se persistují přes `_persist()`.

**UI:** Blinkující badge v `CurrenciesBar` s názvem eventu a odpočtem. Zelený badge = pozitivní event, červený = negativní.

### 5 pozitivních eventů

| Název           | Efekt                                                 | Trvání |
| --------------- | ----------------------------------------------------- | ------ |
| Summit G8       | Influence mise +50% odměna                            | 10 min |
| Mediální bouře  | Alert decay ×2.0 globálně (pasivní tick 2× rychlejší) | 10 min |
| Whistleblower   | Intel z misí ×2                                       | 8 min  |
| Ekonomický boom | Money z misí +30%                                     | 10 min |
| Zbrojní dohoda  | Extraction a Blackops Shadow +80%                     | 8 min  |

### 5 negativních eventů

| Název               | Efekt                                                               | Trvání |
| ------------------- | ------------------------------------------------------------------- | ------ |
| Kyber výpadek       | Cyber mise nedostupné ve všech owned regionech                      | 5 min  |
| Krach trhu          | Alert +0.5 ihned na všech owned regionech; Finance mise reward ×0.5 | 10 min |
| Akce Interpolu      | AlertGain z misí ×2.0                                               | 8 min  |
| Sankce              | Money, Shadow, Influence z misí −30% (intel nezasažen)              | 8 min  |
| Podezření na agenta | Success chance −15% při resolve                                     | 6 min  |

### Implementace

- **Katalog:** `src/data/worldEvents.ts` — `WORLD_EVENTS: WorldEventDef[]`
- **Engine helpers:** `src/engine/worldEvents.ts` — `pickRandomEvent()`, `getEventDef()`, `applyEventRewards()`, `isCategoryBlockedByEvent()`, `getEventAlertDecayMult()`, `getEventAlertGainMult()`, `getEventSuccessChancePenalty()`
- **Scheduler:** `usePassiveIncome` hook — aktivuje/expiruje eventy každých 30s tick
- **Dispatch guard:** `missionStore.dispatch()` — blokuje odeslání do zakázané kategorie
- **Reward efekty:** `missionStore.collectResult()` — aplikuje multiplikátory přes `applyEventRewards()`
- **Alert decay:** `usePassiveIncome` — `decayAlertLevel()` výsledek je násoben `alertDecayMult`
- **Success penalty:** `missionStore.collectResult()` — `successChance` snížená před `resolveMission()`
