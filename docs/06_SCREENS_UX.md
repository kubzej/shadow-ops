# Shadow Ops — Screens a UX flow

---

## Navigace

`BottomNav` je pevně fixován dole (5 tabů). Každý tab = route.

| Tab      | Route     | Ikona (lucide) | Funkce                       |
| -------- | --------- | -------------- | ---------------------------- |
| Mapa     | /map      | Map            | Globální mapa, expanze       |
| Mise     | /missions | Target         | Mise, dispatch, výsledky     |
| Agenti   | /agents   | Users          | Přehled agentů, detail       |
| Základna | /base     | Building       | Nábor, upgrade, divize, shop |
| Menu     | /menu     | Settings       | Statistiky, reset, switch    |

Default route: `/` → redirect na `/map`.

`CurrenciesBar` zobrazuje money / intel / shadow / influence v horní části každé obrazovky.

---

## LandingScreen

**Vstup:** appState='landing'

**Obsah:**

- Logo + název hry
- Seznam existujících save slotů (ze `listSaveSlots()`)
  - Každý slot: agency name, boss name, logo, lastSavedAt, money snapshot, mise snapshot
  - Klik → `handleLoadSlot(slotId)` → `activateSlot()` + `loadGame()` → appState='game'
  - Smazat slot: potvrzovací dialog → `deleteSaveSlot(slotId)`
- Tlačítko "Nová hra" → appState='onboarding'

---

## OnboardingScreen (4 kroky)

**Vstup:** appState='onboarding'

| Krok | Obsah                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------ |
| 1    | Textové inputy: jméno agentury + jméno ředitele. Validace: neprázdné.                            |
| 2    | Výběr loga ze 16 SVG variant (`orgLogos.ts`). Grid karet, highlight vybrané.                     |
| 3    | Výběr startovního města z 11 možností. Každá karta: název, země, typ města.                      |
| 4    | Shrnutí: název, logo, ředitel, město, startovní zdroje (1500$, 30◈). Tlačítko "Zahájit operaci". |

Po potvrzení kroku 4: `initializeGame(agencyName, bossName, startCityId, logoId, slotId)` → store.loaded=true → appState='game'.

---

## MapScreen

**Stav:** SVG mapa s pan gestem (dotyk/mouse drag), zoom.

**Vizuální stavy regionů:**

| Stav            | Barva/ikona         | Podmínka                                    |
| --------------- | ------------------- | ------------------------------------------- |
| Owned           | Zelený kruh + název | region.owned = true                         |
| Construction    | Žlutý + animace     | constructionInProgress = true               |
| Available       | Modrý obrys         | soused owned regionu, ne under construction |
| Locked          | Šedý, slabý         | zbytek                                      |
| Alert indicator | Barevná tečka       | alertLevel dle `alertColor()`               |

**Klik na region:**

- Aktualizuje `selectedRegionId` v uiStore
- Zobrazí `CityBar` (název, typ, alert badge, safe house level pokud owned)

**Expansion dialog** (klik na available region):

- Zobrazí cenu (money + intel), build time, level sousedního SH
- Tlačítko "Expandovat" → `spendCurrencies()` → `db.regions.update(constructionInProgress=true, constructionCompletesAt)` → `db.safeHouses.add(constructionInProgress=true)`

---

## MissionsScreen

Nejkomplexnější obrazovka. 3 části: mission list, active missions, collection modal.

### Mission List

- Načte se při změně `selectedRegionId` nebo focus na tab: `loadMissions(regionId)` + `checkExpirations(regionId)`
- Každá karta mise:
  - Název, kategorie badge (barva + label z `CATEGORY_META`)
  - Difficulty (1–5 hvězdičky)
  - Odměny preview (money, intel, shadow, influence, xp)
  - Alert gain indicator
  - Complication icon pokud přítomna
  - Timer do vypršení (expiresAt)
  - Chain badge pokud chainStep/chainTotal
  - "Intel required" pokud intelCost > 0
  - Lock badge pokud `lockedByDivision` (název divize která musí být přiřazena)
- Klik → otevře Dispatch Modal (locked mise nelze dispatchovat)

### Dispatch Modal

Bottom sheet (modalOverlay + modalSheet).

**Sekce:**

1. **Header:** název mise, flavor text, difficulty, kategorie
2. **Approach selector:** standard / aggressive / covert (3 tlačítka, live preview šance)
3. **Agent výběr:**
   - Grid dostupných agentů (status='available' v tomto regionu)
   - Každý: avatar (division color), jméno, rank stars, stats mini
   - `checkAgentEligibility()` → eligible: normal, missingDivision: oranžový warning, missingStats: červený warning
   - Vybraní agenti: highlight + checkmark
   - Min/max limit dle mise
4. **Equipment slots** (pro každého vybraného agenta, 3 sloty)
5. **Live preview:**
   - Výsledná success chance (zelená/žlutá/červená dle hodnoty)
   - Délka mise (formatDuration)
   - Alert gain
6. **Dispatch tlačítko:**
   - Disabled pokud: nedostatek agentů, team neeligible, nedostatek intel
   - Klik → `dispatch(mission, agents, equippedIds, approach)` → modal zavřen

### Active Missions Panel

Fixní sekce v horní části MissionsScreen.

- Každá activeMission: název mise, countdown timer (`completesAt - now`), approach badge, agenti
- Po `tickMissions()`: mise přesunuta do completedQueue → zobrazí se Collection Modal

### Collection Modal

Bottom sheet, animovaný.

**Obsah:**

- Accent bar: barva dle výsledku (success=zelená, partial=žlutá, failure=červená, catastrophe=rose)
- Název výsledku (z `RESULT_META`)
- Odměny (každá měna s ikonkou, xp)
- Alert gain
- Zranění agenti: jméno, severity badge, čas do uzdravení
- Rank-up agenti: jméno, nový rank (hvězdičky)
- Killed/captured agent: varování
- Lost equipment (při partial rescue): seznam se jmény
- Tlačítko "Zavřít" → `dismissResult()`

---

## AgentsScreen

### Agent List

- Filter tabu (pills): **Všichni / Volní / Na misi / Zranění**
- Každá karta:
  - Avatar (divisionColor, iniciály nebo ikona)
  - Jméno, division chip (barva + název)
  - Rank stars (1–4) - Pokud `rank === 'veteran'` a `agent.nickname`: přezdívka kurzivou (např. _the Ghost_) - Stats mini-bar (stealth/combat/intel/tech jako tečkový progress)
  - Status badge (`STATUS_META[status]`)
  - XP progress bar
  - Pokud injured: countdown timer do uzdravení
  - Pokud captured: "ZAJAT" červeně
  - Pokud `missionStreak >= 5`: oranžový streak badge (🔥 N) vedle avg skóre

### Agent Detail Modal

Klik na agenta → bottom sheet.

**Sekce:**

1. **Header:** avatar velký, jméno, (přezdívka kurzivou pod jménem pokud `nickname` existuje), divize, rank, status
2. **Stats detail:** 4 řádky (stealth/combat/intel/tech), progress bar 0–99, číslo. Pokud agent nese equipment s bonusem, bar má dvě části: base v barvě divize + bonus segment v zelené (#4ade80)
3. **XP progress:** "XP: {xp} / {xpToNextRank}" + progress bar
4. **Mise statistiky:** missionsCompleted / missionsAttempted
5. **Equipment sloty:** 3 sloty. Osazený slot: název itemu, rarity badge, stat bonusy jako barevné tagy, tlačítka "Prodat" (30% refund) a "Přendat →" (transfer na jiného agenta ve stejné safe house). Prázdný slot: zobrazí "Prázdný slot" (neklikatelný — equipment se kupuje v Obchodě).
6. **Akce:**
   - Pokud injured: "Okamžitě uzdravit (10$×rank)" → `db.agents.update(status='available')` + `spendCurrencies`
   - Pokud available: "Přesunout" → výběr cílové safe house, cena + čas cestování → `status='traveling'`
   - Pokud traveling: zobrazí "Cestuje do {název} za {countdown}"

---

## BaseScreen

4 taby: **Nábor / Safe House / Divize / Obchod**

### Tab 1: Nábor

- Vybraný safe house (dle selectedRegionId)
- Recruitment pool: 3 nabídky, countdown do auto-refresh
- Každá nabídka: agent type ikona, jméno, divize, rank, stats preview, cena v money
- Tlačítko "Najmout": `spendCurrencies({money: offer.cost})` → `createAgent()` → `db.agents.add()`
- Tlačítko "Obnovit" (manuální refresh): `spendCurrencies({money: 100})` → `generateRecruitmentPool()` → `db.recruitmentPools.put()`
- Countdown do automatického refresh (refreshesAt)

### Tab 2: Safe House

- Info: level, kapacita (current/max agentů), division sloty (assigned/max)
- Upgrade sekce:
  - Pokud upgradeInProgress: progress bar + countdown
  - Pokud level < 5: tlačítko "Upgrade na Lv{n+1}" s cenou
  - `spendCurrencies()` → `db.safeHouses.update(upgradeInProgress=true, upgradeCompletesAt)`
- Division assignment:
  - Přiřazené divize (chips, klik = odebrat)
  - Dostupné divize k přiřazení (pouze odemčené, pokud slot volný); cena `DIVISION_ASSIGN_BASE_COST × sh.index`
  - Po přiřazení: odemkne `lockedByDivision` mise pro tuto divizi, volá `invalidateRegionMissions()`
  - Po odebrání: volá `invalidateRegionMissions()` (regeneruje mise pro region)
- Module sekce:
  - Nainstalované moduly (max 2): jméno, popis, tlačítko "Odebrat"
  - Dostupné moduly k instalaci (pokud < 2): cena, popis, "Instalovat"
  - `spendCurrencies()` → `db.safeHouses.update(modules: [...modules, modId])`

### Tab 3: Divize

- Globální přehled všech 9 divizí
- Každá divize karta:
  - Barva, název, popis
  - Status: "Odemčeno Lv{n}" / "Locked"
  - Příjem per tick (z `DIVISION_INCOME`)
  - Pokud locked: cena unlocku, tlačítko "Odemknout"
  - Pokud unlocked a level < 3: tlačítko "Upgrade", cena
  - `unlockDivision(id)` / `upgradeDivision(id)` po zaplacení

### Tab 4: Obchod

Rotující výběr 6 equipment itemů. Refresh každou hodinu (countdown v hlavičce).

- **Locked stav:** pokud `totalMissionsCompleted < 15` → locked message s hint textem
- **Tier hint:** pokud < 10 misí → text o rare/legendary itemech
- Každý item: název, rarity badge (barva), stat bonusy, cena (money/intel/shadow/influence)
- Tlačítko "Koupit" → otevře agent picker (agenti v aktuální safe house s volným slotem)
  - Pokud `eq.requiredDivision`: filtruje pouze agenty té divize
  - Po výběru agenta: `buyAssign(eq, agent)` → `spendCurrencies()` → `db.agents.update(equipment, stats)`
  - Notifikace: "{název itemu} → {jméno agenta}" na 2.5s
- **Černý trh** (pokud `blackMarketUnlocked`): 4 listingy za shadow+influence
  - 30% šance: speciální agent (blackops/extraction/cyber/sabotage, specialist/veteran, cena 25◆+15✦)
  - 20% šance: expansion skip (přeskočí build time, cena 30◆+20✦)
  - Jinak: rare/legendary equipment

---

## MenuScreen

- **Header:** logo + název agentury + jméno ředitele
- **Statistiky:**
  - Celkem mise dokončeny / pokusů
  - Agenti ztraceni
  - Expanze
  - Playtime (formátováno jako h:mm:ss z `getPlayTimeSecs()`)
- **Měny:** aktuální stav všech 4 měn
- **Tlačítko "Přepnout uložení":** `requestSaveSelect()` → App.tsx → landing
- **Tlačítko "Resetovat hru":** potvrzovací dialog → `db.delete()` → `metaDb.slots.delete()` → `localStorage.removeItem` → `reset()` → appState='onboarding'

---

## Toast systém

Toasty jsou renderovány v `ToastContainer` (součást GameShell v App.tsx).
Fixní pozice: bottom, nad BottomNav.

```
Barvy:
  success → #4ade80 (zelená)
  error   → #ef4444 (červená)
  warning → #facc15 (žlutá)
  info    → #60a5fa (modrá)

Background: #262626
Auto-dismiss: 3.6s
Max najednou: 3 toasty (nejstarší odstraněn)
```

Kde se toasty zobrazují:

- `tickMissions()`: agent zabit při capture expiry
- `useConstructionTicker()`: expanze dokončena
- (budoucí): reward collection, upgrade completed atd.

---

## Obecné UI konvence

- **Všechny modaly** jsou bottom sheets (slide up z dolního okraje)
- **Žádný barevný border** na kartách — barva entity žije uvnitř (avatar, badge)
- **Active state** = o něco světlejší bg (`bgSurface2`), nikoli border
- **Disabled** = opacity 0.45, `not-allowed` cursor
- **Potvrzovací dialogy** pro nevratné akce (smazání slotu, reset hry)
- **Czech UI** — veškerý text v češtině (agent statusy, mise kategorie, rank labely)
