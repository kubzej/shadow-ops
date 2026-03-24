# Shadow Ops — Přehled projektu a architektura

Shadow Ops je **mobile-first PWA** špionážní management hra. Hráč buduje tajnou agenturu: rekrutuje agenty,
vysílá je na mise, expanduje na globální mapě a spravuje základny. Celá UI je v češtině.

---

## Tech stack

| Vrstva      | Technologie                                |
| ----------- | ------------------------------------------ |
| UI          | React 18, TypeScript, Tailwind CSS         |
| State       | Zustand + immer middleware                 |
| Perzistence | Dexie (IndexedDB wrapper)                  |
| Ikony       | lucide-react                               |
| Routing     | react-router-dom v6                        |
| Build       | Vite                                       |
| PWA         | vite-plugin-pwa (service worker, manifest) |

---

## Adresářová struktura

```
src/
├── App.tsx                      # Root; AppState machine + GameShell + ToastContainer
│
├── db/
│   ├── schema.ts                # Všechny TypeScript typy a interfaces (source of truth)
│   ├── db.ts                    # Dexie DB class + save slot proxy
│   └── saveSlots.ts             # Metadata save slotů (separátní DB: metaDb)
│
├── store/
│   ├── gameStore.ts             # Zustand: měny, divize, statistiky; _persist() → DB
│   ├── missionStore.ts          # Zustand: lifecycle misí (dispatch → collect → reward)
│   └── uiStore.ts               # Zustand: aktivní tab, výběr regionu/agenta, toasty
│
├── engine/
│   ├── missionResolver.ts       # Výpočet šance, délky, resolve výsledků, injury, XP
│   ├── missionGenerator.ts      # Generování misí, rescue misí, chain misí, batch
│   ├── agentGenerator.ts        # Vytváření agentů, rank-up, recruitment pool, equipment bonusy
│   ├── passiveIncome.ts         # Pasivní příjem per 30s tick + alert decay
│   ├── mapGenerator.ts          # BFS vzdálenosti, expanzní náklady a časy, query helpers
│   ├── initializeGame.ts        # initializeGame() (nová hra) + loadGame() (resume)
│   └── blackMarket.ts           # Generování black market listingů
│
├── data/
│   ├── agentTypes.ts            # AGENT_TYPES (36), DIVISIONS (9), DivisionId, AgentRank
│   ├── missionTemplates.ts      # TARGET_POOLS (216 cílů), COMPLICATIONS, FLAVOR_TEMPLATES
│   ├── regions.ts               # REGIONS (100+ měst), REGION_MAP, sousedi, pozice SVG
│   ├── countries.ts             # COUNTRY_MAP, baseAlertLevel, worldRegion
│   ├── equipmentCatalog.ts      # EQUIPMENT_CATALOG (vybavení common→legendary)
│   ├── costs.ts                 # Všechny náklady: safe house, divize, moduly, expanze
│   ├── names.ts                 # FIRST_NAMES, LAST_NAMES (pro generování jmen agentů)
│   └── orgLogos.ts              # SVG loga organizace (16 variant)
│
├── screens/
│   ├── LandingScreen.tsx        # Výběr save slotu (slot picker)
│   ├── OnboardingScreen.tsx     # Tvorba nové hry (4 kroky)
│   ├── MapScreen.tsx            # SVG mapa světa, expanze
│   ├── MissionsScreen.tsx       # Výpis misí, dispatch modal, active missions, collection modal
│   ├── AgentsScreen.tsx         # Agenti, filter tabu, detail modal, heal
│   ├── BaseScreen.tsx           # Základna: Nábor / Safe House / Divize / Obchod
│   └── MenuScreen.tsx           # Stats, reset game, switch save
│
├── components/
│   ├── BottomNav.tsx            # Spodní navigace (5 tabů s lucide ikonami)
│   ├── CurrenciesBar.tsx        # Lišta s měnami (money / intel / shadow / influence)
│   └── CityBar.tsx              # Info bar pro vybraný region (název, alert, safe house status)
│
├── hooks/
│   ├── useMissionTimer.ts       # setInterval 1s: tick misí, heal, capture expiry, travel
│   ├── usePassiveIncome.ts      # setInterval 30s: příjem, alert decay
│   └── useConstructionTicker.ts # setInterval 5s: expanze hotová, safe house upgrade hotový
│
├── styles/
│   └── tokens.ts                # Design tokeny: C (barvy), btn, cardBase, modalSheet atd.
│
└── utils/
    └── rng.ts                   # createRng, pickRandom, pickWeighted, randFloat, randInt, clamp, randomId
```

---

## App state machine (App.tsx)

```
'loading'   → init(): zkusí loadGame() z lastSlotId
                ├─ success         → 'game'
                ├─ slots exist     → 'landing'
                └─ no slots        → 'onboarding'

'landing'   → LandingScreen: vyber slot nebo nová hra
                ├─ handleLoadSlot() → 'game'
                └─ onNewGame()      → 'onboarding'

'onboarding' → OnboardingScreen: 4 kroky
                └─ initializeGame() → store.loaded=true → 'game'

'game'      → GameShell:
                ├─ usePassiveIncome()      (30s tick)
                ├─ useMissionTimer()       (1s tick)
                ├─ useConstructionTicker() (5s tick)
                ├─ Routes: /map /missions /agents /base /menu
                ├─ BottomNav
                └─ ToastContainer
```

---

## Databázová vrstva (Dexie)

Každý save slot má vlastní Dexie databázi (`shadow-ops-slot-{id}`).
Přepínání slotů = `activateSlot(slotId)` přesměruje `db` proxy na nový slot.

Metadata slotů jsou v separátní DB `shadow-ops-meta` (tabulka `slots`).
`localStorage.shadow-ops-active-slot` uchovává ID aktivního slotu.

**Tabulky v herní DB:**

| Tabulka            | Klíč                 | Indexy                          |
| ------------------ | -------------------- | ------------------------------- |
| `gameState`        | `id` (=1, singleton) | —                               |
| `safeHouses`       | `id`                 | —                               |
| `agents`           | `id`                 | `division, status, safeHouseId` |
| `regions`          | `id`                 | —                               |
| `missions`         | `id`                 | `regionId`                      |
| `activeMissions`   | `id`                 | —                               |
| `recruitmentPools` | `id`                 | —                               |
| `blackMarket`      | `id` (=1)            | —                               |
| `missionLog`       | `id`                 | `regionId`                      |

---

## Startovní stav nové hry (initializeGame.ts)

```
Měny:      money: 1500  intel: 30  shadow: 0  influence: 0
Divize:    surveillance (Lv1), cyber (Lv1)  — obě odemčené zdarma
Agenti:    shadow (surveillance, recruit), hacker (cyber, recruit)
Startovní město: owned, safe house Lv1 (2 division sloty, kapacita 3 agentů)
Mise:      4 ks, biased ke startovním divizím, alespoň 1 diff-1
Pool:      recruitment pool pro startovní safe house, 3 nabídky, refresh za 5 min
```

---

## Klíčové konstanty (přehled)

```
MIN_MISSIONS_PER_REGION        = 3
MAX_MISSIONS_PER_REGION        = 4
MISSION_REGEN_INTERVAL_MS      = 20 min
MISSION_EXPIRY_MS (diff≥3)     = 30 min × difficulty
MISSION_EXPIRY_MS (diff<3)     = 4 hodiny
RESCUE_EXPIRY_MS               = 15 min
PASSIVE_INCOME_TICK            = 30s
CONSTRUCTION_CHECK_TICK        = 5s
MISSION_TIMER_TICK             = 1s
RECRUITMENT_REFRESH_COOL       = 5 min (automatický)
RECRUITMENT_REFRESH_COST       = 100 money (manuální)
BLACK_MARKET_REFRESH           = 5 min
MODULE_MAX_PER_SAFEHOUSE       = 2
RESCUE_EQUIPMENT_SELL_REFUND   = 30 %
BLACK_MARKET_UNLOCK_AT         = 15 dokončených misí
INSTANT_HEAL_COST              = 10 money × rankIndex (10/20/30/40)
MISSIONTIER_THRESHOLDS         = [0, 8, 20, 45, 80] (počet misí v regionu)
```
