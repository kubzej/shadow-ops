# Shadow Ops — Dokumentace

Kompletní technická a herní dokumentace projektu. Primárně určena jako vstupní kontext
pro AI agenty při komplexních implementačních úkolech.

---

## Soubory

| Soubor | Obsah |
|--------|-------|
| [00_OVERVIEW.md](00_OVERVIEW.md) | Přehled projektu, tech stack, adresářová struktura, App state machine, DB schema, startovní stav, klíčové konstanty |
| [01_DATA_SCHEMA.md](01_DATA_SCHEMA.md) | Všechny TypeScript typy a interfaces z `schema.ts`: GameState, SafeHouse, Agent, RegionState, Mission, ActiveMission, RecruitmentPool, BlackMarket, MissionLogEntry |
| [02_GAME_MECHANICS.md](02_GAME_MECHANICS.md) | Herní mechaniky: měny, divize, agenti, mise (approach/výsledky/odměny), alert systém, pasivní příjem, expanze, black market, rescue mise, chain mise, missionTier |
| [03_ENGINE.md](03_ENGINE.md) | Engine vrstva s přesnými vzorci z kódu: calculateSuccessChance, calculateDuration, resolveMission, rollInjury, distributeXp, generateMission, generateRescueMission, passiveIncome, expansionCost, rankUp, applyEquipmentBonuses |
| [04_STORES.md](04_STORES.md) | Store vrstva: gameStore (state + všechny akce), missionStore (dispatch/collectResult/tickMissions detail), uiStore, hooks (useMissionTimer/usePassiveIncome/useConstructionTicker) |
| [05_DATA_CATALOG.md](05_DATA_CATALOG.md) | Datový katalog: všech 36 typů agentů s base stats, tabulky costs (safe house/divize/moduly/expanze), equipment catalog rozhraní, regiony/země přehled |
| [06_SCREENS_UX.md](06_SCREENS_UX.md) | Screens a UX: navigace, LandingScreen, OnboardingScreen (4 kroky), MapScreen, MissionsScreen (dispatch modal detail), AgentsScreen, BaseScreen (4 taby), MenuScreen, toast systém |
| [07_DESIGN_SYSTEM.md](07_DESIGN_SYSTEM.md) | Design systém: celá barevná paleta C, rank/status/result/category meta, cardBase/btn/modal utility styly, alert color gradient, layout struktura |
| [08_KNOWN_GAPS.md](08_KNOWN_GAPS.md) | Known gaps: co je implementované v enginu ale chybí v UI (black market, equipment UI, travel), potenciální problémy, budoucí návrhy |

---

## Rychlý přehled pro agenta

**Hra:** mobile-first PWA, česky, špionážní management, React 18 + Dexie + Zustand

**Herní loop:**
1. Mapa → expanduj do nových regionů
2. Safe House → rekrutuj agenty, přiřaď divize, instaluj moduly
3. Mise → vyber, dispatch (approach + agenti), počkej, sbírej odměny
4. Divize → odemykej a upgraduj pro lepší příjem a mise

**Klíčový flow dat:**
```
User action → store action → DB transakce → store state update → UI re-render
```

**Persistencia:** `gameStore._persist()` volá `db.gameState.put()` po každé mutaci měn/divizí/statů.
Mise, agenti, regiony jsou vždy primárně v Dexie; store drží jen "current view" subset.

**Tick systém:**
- 1s: `tickMissions()` — mise hotové, heal, capture expiry, travel
- 5s: `useConstructionTicker()` — expanze/upgrade dokončení
- 30s: `usePassiveIncome()` — příjem + alert decay

**Design pravidla:**
- Nikdy barevný border na kartě — barva entity jen uvnitř (avatar, chip)
- Active state = `bgSurface2` (#2a2a2a), nikdy border
- Jen 1 primary CTA per screen (zelená)
- Všechny modaly jsou bottom sheets
