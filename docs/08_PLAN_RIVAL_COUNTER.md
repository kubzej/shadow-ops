# Shadow Ops — Finální plán feature: Rival + Counter-Ops

Datum: 25. března 2026
Stav: Připraveno k implementaci (čeká na GO)

---

## Přehled feature

Feature zavádí dvě navázané mechaniky:

1. Counter-Ops (defenzivní mise)

- Nová mission kategorie `counter` (open, bez division locku).
- Generace při vysokém alertu regionu.
- Tvrdý časový limit 20 minut.
- Ignorace má důsledek: ztráta 1 náhodného modulu v safe housu (pokud existuje).

2. Rival agency (Shadow Faction)

- Rival má jméno generované při onboardingu.
- Každých 30–45 minut zkusí spustit rival operation v owned regionu s alert >= 1.5.
- Rival operation lze zastavit Counter-Op misí.

3. Rival escalation

- `rivalAggressionLevel = floor(totalMissionsCompleted / 25)`.
- Od levelu 3+ dostávají rescue mise +1 difficulty (Hunt Squads).

---

## Uzavřené produktové rozhodnutí

1. Pojmenování

- Všechno držet kolem slova "rival".

2. Counter kategorie

- `counter` je open kategorie (bez tvrdého required division locku).

3. Rival event blokace přes Counter-Op

- Dispatch Counter-Op: rival event je stále pending.
- Success Counter-Op: rival event se neaplikuje.
- Jakýkoli jiný výsledek (partial/failure/catastrophe/expiry): rival event se aplikuje normálně.

4. Asset Compromise

- Místo -10 statu: demote agenta o 1 rank dolů.
- XP reset na 0.
- `xpToNextRank` se přepočítá podle nového ranku.
- Pokud je agent `recruit`, zůstane `recruit` (jen XP=0).

5. Agent Recruitment event

- Pokud zůstane jednoduchá varianta: agent přejde na `dead`.
- Započítá se do `totalAgentsLost`.
- Equipment zaniká.
- (Volitelně do budoucna lze zavést `lost_to_rival`, nyní mimo scope.)

6. Counter-Op expiry bez modulu

- Pokud safe house nemá žádný modul, pouze toast (bez náhradní penalizace).

7. Vybrané doplňkové rival eventy

- `rival_leak` = ANO
- `false_flag` = NE
- `burned_contracts` = ANO
- `supply_intercept` = NE
- `safe_house_swap` = ANO

---

## Finální katalog rival eventů (MVP)

### 1) Asset Compromise

Podmínka cíle:

- Náhodný agent v cílovém regionu, preferenčně živý a aktivní (`available`, `on_mission`, `injured`, `traveling`).
  Efekt:
- Rank -1, XP=0, `xpToNextRank` přepočet.
  Counter-Op success:
- Event se zruší.

### 2) Intel Theft

Efekt:

- Ztráta `intel` v rozsahu 15–30 (clamp min 0).
  Counter-Op success:
- Event se zruší.

### 3) Sabotage

Efekt:

- Náhodný modul v safe housu je nefunkční 10 minut.
- Modul se nemaže, pouze dočasně deaktivuje.
- Pokud nejsou moduly, jen toast.
  Counter-Op success:
- Event se zruší.

### 4) Agent Recruitment

Efekt:

- Nejslabší agent v regionu (nejnižší součet statů) je odstraněn.
- MVP implementace: `status = dead`, equipment zaniká.
  Counter-Op success:
- Event se zruší.

### 5) Disinformation

Efekt:

- `alertLevel +0.5` v cílovém regionu, cap 3.0.
  Counter-Op success:
- Event se zruší.

### 6) Rival Leak (nový, schválený)

Efekt:

- V cílovém regionu mají mise dočasně zvýšený `intelCost` o +3 na 15 minut.
  Implementačně:
- Region flag s expirací, aplikace při dispatch affordability checku.
  Counter-Op success:
- Event se zruší.

### 7) Burned Contracts (nový, schválený)

Efekt:

- Recruitment pool v cílovém safe housu přegenerován s horší kvalitou na 10 minut.
  Implementačně:
- Dočasný quality malus (nižší rank váhy) při generování poolu.
  Counter-Op success:
- Event se zruší.

### 8) Safe House Swap (nový, schválený)

Efekt:

- Náhodný `available` agent v regionu je okamžitě přesunut do jiného owned safe housu.
- Pokud není validní cíl, jen toast.
  Implementačně:
- Přímá změna `safeHouseId`, status zůstává `available`.
  Counter-Op success:
- Event se zruší.

---

## Datový model (návrh)

### GameState

Přidat:

- `rivalName?: string`
- `nextRivalOperationAt?: number`
- `activeRivalOperation?: { id: string; regionId: string; eventType: RivalEventType; createdAt: number; expiresAt: number; blockedByCounterMissionId?: string }`
- `rivalAggressionLevel?: number` (volitelné cache pole, lze dopočítávat)

### SafeHouse

Přidat:

- `disabledModules?: Array<{ moduleId: string; until: number; reason: 'rival_sabotage' }>`

### RegionState

Přidat:

- `rivalLeakUntil?: number`
- `burnedContractsUntil?: number`

### Mission

Přidat:

- `isCounterOp?: boolean`
- `rivalOperationId?: string`

### Nové typy

- `type RivalEventType = 'asset_compromise' | 'intel_theft' | 'sabotage' | 'agent_recruitment' | 'disinformation' | 'rival_leak' | 'burned_contracts' | 'safe_house_swap'`

---

## Engine a store logika

1. Counter-Ops generace

- Trigger A: `alertLevel >= 2.5` a v regionu není aktivní counter mise.
- Trigger B: při `alertLevel >= 2.0` šance 10 % per tick.
- Expirace: 20 minut (`expiresAt`).

2. Counter-Ops vyhodnocení

- Success: pokud je svázaná pending rival operation, zrušit ji.
- Jinak standard mission flow.
- Expiry: odebrat 1 náhodný modul (pokud existuje), jinak toast.

3. Rival scheduler

- Každých 30–45 minut vybrat náhodný owned region s `alertLevel >= 1.5`.
- Vytvořit pending rival operation.
- Pokud region splní Counter-Op success včas, event se zruší.
- Pokud ne, event se aplikuje.

4. Rival escalation

- Při generování rescue mise aplikovat:
  - pokud `floor(totalMissionsCompleted / 25) >= 3`, pak `difficulty = min(5, difficulty + 1)`.

5. Disabled moduly

- V income/decay výpočtech ignorovat moduly, které jsou v `disabledModules` a `until > now`.
- Po expiraci efektu modul automaticky znovu funguje.

---

## UI/UX dopad

1. Missions UI

- Counter-Ops karta musí být jasně označená.
- Countdown 20 min prominentně.
- Pokud je Counter-Op svázaná s rival operation, zobrazit info "Rival hrozba".

2. Toasty

- Rival event created.
- Rival event blocked by Counter-Op.
- Rival event applied + stručný efekt.
- Counter-Op expired (module removed / no module).

3. Safe House UI

- U sabotovaného modulu zobrazit badge "Nefunkční" + countdown.

4. Onboarding / lore

- Rival jméno uložit při startu hry.
- Není nutné přidávat nový onboarding krok.

---

## Dotčené soubory (plán změn)

- `src/db/schema.ts`
- `src/engine/initializeGame.ts`
- `src/store/gameStore.ts`
- `src/data/missionTemplates.ts`
- `src/engine/missionGenerator.ts`
- `src/engine/missionResolver.ts`
- `src/store/missionStore.ts`
- `src/hooks/usePassiveIncome.ts`
- `src/engine/passiveIncome.ts`
- `src/screens/missions/missionConstants.ts`
- `src/screens/missions/MissionCard.tsx`
- `src/screens/missions/AgentSelectorModal.tsx`
- `src/screens/MissionsScreen.tsx`
- `src/screens/base/SafeHouseTab.tsx`
- `src/styles/tokens.ts`
- `src/demo/seed.ts`
- `src/screens/DemoScreen.tsx`

Dokumentace:

- `docs/01_DATA_SCHEMA.md`
- `docs/02_GAME_MECHANICS.md`
- `docs/03_ENGINE.md`
- `docs/04_STORES.md`
- `docs/05_DATA_CATALOG.md`
- `docs/06_SCREENS_UX.md`
- `docs/NAVRHY_VYLEPSENI.md` (označit 3.3, 6.1, 6.2 jako implementované)

---

## Pořadí implementace

1. Typy a schema (db + store persist/load).
2. Counter mission category + generator + resolver.
3. Rival scheduler + pending operation model.
4. Counter-Op block/apply flow.
5. Rival escalation pro rescue.
6. UI mise + safe house indikace.
7. Demo seed + demo ovládání.
8. Dokumentace.

---

## Testovací scénáře (MVP)

1. Alert 2.5+ v regionu vytvoří Counter-Op.
2. Counter-Op vyprší a odebere modul.
3. Counter-Op vyprší v regionu bez modulu => jen toast.
4. Rival operation vznikne po 30–45 min v eligible regionu.
5. Success Counter-Op zruší pending rival event.
6. Failure Counter-Op nechá rival event proběhnout.
7. Asset Compromise demotne rank o 1 a resetne XP.
8. Agent Recruitment odstraní nejslabšího agenta a zvýší totalAgentsLost.
9. Sabotage deaktivuje modul přesně na 10 min.
10. Rival escalation level 3+ zvýší rescue diff o +1.

---

## Poznámky k implementaci

- Scope je striktně Rival + Counter-Ops + Rival escalation.
- Bez dalších systémových refaktorů mimo tento rozsah.
- České texty v UI.
- Mobile-first layout, 375 px safe.
