# Shadow Ops — Datový katalog

---

## Agenti — 36 typů (src/data/agentTypes.ts)

Každý typ má: `id, name, division, description, baseStats { stealth:[base,var], combat, intel, tech }, recruitCost, salary`

Hodnoty baseStats jsou pro rank=recruit (mult=1.0). Skutečné stats = `round((base + rand(−var, var)) × rankMult)`.

### SURVEILLANCE (4 typy)

| ID            | Název         | Stealth   | Combat   | Intel    | Tech     | Cost | Salary |
|---------------|---------------|-----------|----------|----------|----------|------|--------|
| shadow        | Shadow        | [28, 6]   | [10, 4]  | [22, 5]  | [14, 4]  | 300  | 3      |
| watcher       | Watcher       | [22, 5]   | [12, 4]  | [28, 6]  | [16, 4]  | 250  | 2      |
| scout         | Scout         | [24, 6]   | [18, 5]  | [18, 4]  | [10, 3]  | 200  | 2      |
| analyst_surv  | Field Analyst | [16, 4]   | [8, 3]   | [32, 5]  | [22, 4]  | 275  | 3      |

### CYBER (4 typy)

| ID         | Název      | Stealth   | Combat  | Intel    | Tech     | Cost | Salary |
|------------|------------|-----------|---------|----------|----------|------|--------|
| hacker     | Hacker     | [20, 4]   | [6, 3]  | [24, 5]  | [32, 6]  | 375  | 3      |
| coder      | Coder      | [14, 4]   | [4, 2]  | [22, 4]  | [34, 5]  | 350  | 3      |
| ghost_net  | Ghost Net  | [26, 6]   | [6, 3]  | [24, 5]  | [30, 5]  | 325  | 3      |
| sniffer    | Sniffer    | [18, 4]   | [8, 3]  | [30, 6]  | [28, 5]  | 300  | 3      |

### EXTRACTION (4 typy)

| ID       | Název    | Stealth   | Combat    | Intel    | Tech     | Cost | Salary |
|----------|----------|-----------|-----------|----------|----------|------|--------|
| cleaner  | Cleaner  | [24, 6]   | [28, 5]   | [12, 4]  | [10, 4]  | 130  | 4      |
| courier  | Courier  | [28, 5]   | [16, 4]   | [14, 4]  | [12, 4]  | 250  | 3      |
| driver   | Driver   | [20, 4]   | [18, 5]   | [10, 4]  | [22, 5]  | 225  | 2      |
| fixer    | Fixer    | [22, 4]   | [14, 4]   | [20, 4]  | [12, 4]  | 275  | 3      |

### SABOTAGE (4 typy)

| ID          | Název       | Stealth   | Combat    | Intel    | Tech     | Cost | Salary |
|-------------|-------------|-----------|-----------|----------|----------|------|--------|
| demo_expert | Demo Expert | [16, 4]   | [26, 5]   | [10, 4]  | [28, 6]  | 350  | 3      |
| disruptor   | Disruptor   | [20, 5]   | [22, 4]   | [16, 4]  | [22, 4]  | 300  | 3      |
| arsonist    | Arsonist    | [22, 6]   | [24, 4]   | [8, 4]   | [16, 4]  | 250  | 3      |
| wrecker     | Wrecker     | [10, 4]   | [32, 6]   | [6, 3]   | [12, 4]  | 275  | 3      |

### INFLUENCE (4 typy)

| ID           | Název       | Stealth   | Combat  | Intel    | Tech     | Cost | Salary |
|--------------|-------------|-----------|---------|----------|----------|------|--------|
| handler      | Handler     | [18, 4]   | [12, 4] | [28, 5]  | [10, 3]  | 325  | 3      |
| diplomat     | Diplomat    | [16, 4]   | [8, 3]  | [32, 6]  | [8, 2]   | 400  | 5      |
| provocateur  | Provocateur | [24, 6]   | [18, 4] | [24, 4]  | [8, 3]   | 275  | 3      |
| spindoctor   | Spin Doctor | [14, 4]   | [6, 3]  | [34, 5]  | [12, 4]  | 350  | 4      |

### FINANCE (4 typy)

| ID            | Název          | Stealth   | Combat  | Intel    | Tech     | Cost | Salary |
|---------------|----------------|-----------|---------|----------|----------|------|--------|
| broker        | Broker         | [20, 4]   | [6, 3]  | [26, 5]  | [22, 4]  | 350  | 4      |
| laundryman    | Laundryman     | [22, 4]   | [4, 2]  | [24, 4]  | [20, 4]  | 300  | 3      |
| auditor       | Ghost Auditor  | [18, 4]   | [4, 2]  | [28, 6]  | [26, 4]  | 325  | 3      |
| counterfeiter | Counterfeiter  | [22, 6]   | [8, 4]  | [20, 4]  | [24, 4]  | 250  | 3      |

### LOGISTICS (4 typy)

| ID            | Název          | Stealth   | Combat   | Intel    | Tech     | Cost | Salary |
|---------------|----------------|-----------|----------|----------|----------|------|--------|
| quartermaster | Quartermaster  | [14, 4]   | [16, 4]  | [18, 4]  | [24, 4]  | 225  | 2      |
| smuggler      | Smuggler       | [26, 6]   | [14, 4]  | [16, 4]  | [16, 4]  | 250  | 3      |
| forger        | Forger         | [20, 4]   | [8, 4]   | [22, 4]  | [26, 5]  | 275  | 3      |
| coordinator   | Coordinator    | [16, 4]   | [12, 4]  | [28, 5]  | [20, 4]  | 300  | 3      |

### MEDICAL (4 typy)

| ID          | Název       | Stealth   | Combat   | Intel    | Tech     | Cost | Salary |
|-------------|-------------|-----------|----------|----------|----------|------|--------|
| medic       | Medic       | [16, 4]   | [14, 4]  | [20, 4]  | [26, 4]  | 250  | 2      |
| pharmacist  | Pharmacist  | [18, 4]   | [8, 4]   | [22, 4]  | [30, 5]  | 300  | 2      |
| surgeon     | Surgeon     | [14, 4]   | [12, 4]  | [24, 5]  | [32, 4]  | 375  | 3      |
| chemist     | Chemist     | [12, 4]   | [6, 3]   | [26, 6]  | [32, 4]  | 325  | 3      |

### BLACKOPS (4 typy) — vyšší base stats, elite divize

| ID           | Název        | Stealth   | Combat    | Intel    | Tech     | Cost | Salary |
|--------------|--------------|-----------|-----------|----------|----------|------|--------|
| phantom      | Phantom      | [32, 5]   | [32, 5]   | [16, 4]  | [16, 4]  | 625  | 5      |
| assassin     | Assassin     | [30, 5]   | [34, 5]   | [12, 4]  | [12, 4]  | 550  | 5      |
| infiltrator  | Infiltrator  | [34, 5]   | [24, 4]   | [20, 4]  | [20, 4]  | 575  | 5      |
| wetworker    | Wetworker    | [28, 5]   | [36, 4]   | [10, 4]  | [8, 4]   | 500  | 4      |

---

## Mission targets — přehled (src/data/missionTemplates.ts)

`TARGET_POOLS` obsahuje 216+ cílů, přibližně 27 per kategorie.

**Rozhraní MissionTarget:**

```typescript
interface MissionTarget {
  id: string;                  // 't1', 't2', ...
  name: string;                // česky
  category: MissionCategory;
  description: string;
  discretion: number;          // 1–5 (nízká = více alertu při odhalení)
  baseRewardMoney: number;
  baseRewardIntel: number;
  baseRewardShadow: number;
  baseRewardInfluence: number;
  alertGain: number;           // před diffMult (generátor × 1.5)
  intelCost?: number;          // intel nutný k odeslání mise
  chainNextTargetId?: string;  // ID follow-up targetu
}
```

**Komplikace (COMPLICATIONS):**

```typescript
interface MissionComplication {
  id: string;
  description: string;
  difficultyMod: number;  // ovlivňuje compPenalty v success chance (×0.06)
  durationMod: number;    // multiplikátor pro baseDuration
  requiresCombat?: number;
  requiresTech?: number;
  requiresStealth?: number;
  requiresIntel?: number;
}
```

---

## Equipment katalog (src/data/equipmentCatalog.ts)

```typescript
interface Equipment {
  id: string;
  name: string;
  category: 'weapon' | 'tech' | 'medical' | 'disguise' | 'communication' |
            'transport' | 'explosive' | 'surveillance' | 'chemical';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  description: string;

  // Stat bonusy (přičítají se k baseStats; clamp 0–99)
  bonusStealth?: number;
  bonusCombat?: number;
  bonusIntel?: number;
  bonusTech?: number;

  // Mise modifikátory
  successBonus?: number;   // procent (5 = +5% success chance, ÷100 v kódu)
  durationMult?: number;   // multiplikátor délky mise (0.9 = −10%)

  // Požadavky
  requiredDivision?: DivisionId;  // agent musí být z této divize
  minRank?: AgentRank;            // nižší rank = item held, ale inactive

  // Cena
  costMoney: number;
  costIntel?: number;
  costShadow?: number;
  costInfluence?: number;
  isBlackMarket?: boolean;  // primárně dostupné přes black market
}
```

**Rarity bonusy (přibližné maxima):**

| Rarity    | Max stat bonus | Max successBonus | Dostupnost         |
|-----------|---------------|------------------|--------------------|
| common    | ~5            | +3%              | Obchod, mise       |
| uncommon  | ~12           | +6%              | Obchod, mise       |
| rare      | ~18           | +10%             | Black market, mise |
| legendary | ~25+          | +15%             | Black market only  |

---

## Regiony a mapy (src/data/regions.ts)

```typescript
interface Region {
  id: string;             // slug, např. 'prague', 'berlin'
  name: string;           // česky, např. 'Praha'
  countryId: string;
  type: 'capital' | 'financial' | 'tech' | 'port' | 'border' | 'military';
  secondaryType?: CityType;
  neighbors: string[];    // bidirectional graph (každý soused má zpětný link)
  position: { x: number; y: number };  // 0–1000, normalizované pro SVG mapu
}
```

**Symbol city type pro UI (`typeChar()`):**
- capital → ★
- financial → $
- tech → ⚙
- port → ⚓
- military → ✕
- border → ·

**Startovní města (11 možností):**

| ID         | Název      |
|------------|------------|
| prague     | Praha      |
| berlin     | Berlín     |
| paris      | Paříž      |
| london     | Londýn     |
| vienna     | Vídeň      |
| warsaw     | Varšava    |
| budapest   | Budapešť   |
| amsterdam  | Amsterdam  |
| zurich     | Curych     |
| brussels   | Brusel     |
| stockholm  | Stockholm  |

**Geografické pokrytí:**
Záp. Evropa · Vých. Evropa · Skandinávie · UK · Balkán · Rusko/SNS · USA · Kanada · Stř. Amerika · Již. Amerika · Sev. Afrika · Střední východ · Indie · Vých. Asie

---

## Země (src/data/countries.ts)

```typescript
interface Country {
  id: string;
  name: string;
  worldRegion: 'europe' | 'north_america' | 'south_america' | 'asia' | 'middle_east' | 'africa';
  baseAlertLevel: number;  // 0–3; ovlivňuje difficulty misí a cenu expanze
  cityIds: string[];
}
```

**Příklady zemí a jejich baseAlertLevel:**

| Země             | baseAlertLevel | Poznámka              |
|------------------|---------------|-----------------------|
| Czechia          | 0             | Startovní, nejklidnější |
| Germany          | 1             |                       |
| France           | 1             |                       |
| UK               | 1             |                       |
| Poland           | 1             |                       |
| Ukraine          | 2             |                       |
| Russia           | 3             | Nejtěžší              |
| North Korea      | 3             |                       |
| USA              | 1             |                       |
| China            | 2             |                       |

---

## Náklady — kompletní přehled (src/data/costs.ts)

### Safe House upgrade

| → Level | Money  | Intel | Upgrade čas |
|---------|--------|-------|-------------|
| → 2     | 2 000  | 20    | 120s        |
| → 3     | 6 000  | 50    | 300s        |
| → 4     | 20 000 | 120   | 600s        |
| → 5     | 60 000 | 250   | 1 200s      |

### Division unlock (one-time, globální)

| Division     | Money  | Intel | Shadow |
|--------------|--------|-------|--------|
| surveillance | 0      | 0     | 0      |
| cyber        | 0      | 0     | 0      |
| extraction   | 1 200  | 15    | 0      |
| sabotage     | 1 500  | 20    | 10     |
| influence    | 2 000  | 25    | 0      |
| finance      | 2 000  | 25    | 0      |
| logistics    | 1 200  | 15    | 0      |
| medical      | 1 500  | 20    | 0      |
| blackops     | 3 000  | 40    | 40     |

### Division level upgrade (globální)

| → Level | Money  | Intel | Influence |
|---------|--------|-------|-----------|
| → Lv2   | 4 000  | 60    | —         |
| → Lv3   | 25 000 | 200   | 30        |

### Moduly

| Module ID        | Název                | Money  | Intel | Shadow | Influence |
|------------------|----------------------|--------|-------|--------|-----------|
| server_room      | Server Room          | 3 000  | 30    | —      | —         |
| lab              | Výzkumná laboratoř   | 2 000  | 20    | —      | —         |
| armory           | Zbrojnice            | 6 000  | —     | 40     | —         |
| finance_hub      | Finanční centrum     | 5 000  | 40    | —      | —         |
| signal_jammer    | Signal Jammer        | 3 500  | 15    | 10     | —         |
| med_bay          | Med Bay              | 3 000  | 20    | —      | —         |
| training_center  | Výcvikové centrum    | 4 000  | 30    | —      | —         |
| forgery_lab      | Padělatelna          | 4 500  | 30    | —      | 10        |
| black_site       | Black Site           | 5 500  | 20    | 15     | —         |

### Expanze

```
EXPANSION_BASE_COST           = { money: 1000, intel: 15 }
EXPANSION_COST_PER_DISTANCE   = { money: 200,  intel: 6  }
EXPANSION_COST_SCALE          = 0.4  (per completed expansion)
EXPANSION_BUILD_TIME_BASE     = 60s
EXPANSION_BUILD_TIME_PER_DIST = 30s
DIVISION_ASSIGN_BASE_COST     = 500 money (×safe house index)
RECRUITMENT_REFRESH_COST      = 100 money
```
