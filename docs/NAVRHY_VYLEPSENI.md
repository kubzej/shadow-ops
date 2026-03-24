# Shadow Ops — Návrhy vylepšení

> Kreativní návrhy pro rozšíření hry: nové mechaniky, obsah, UX detaily a herní hloubka.
> Seřazeno od nejmenšího (implementačně) po největší (systémové).

---

## 2. Agentský systém

### 2.1 Specializace veteránů (Veteran Perks)

Při dosažení ranku **Veterán** si hráč vybere 1 ze 3 nabízených perků specifických pro divizi agenta:

**Příklady perků:**

| Divize       | Perk A                            | Perk B                              | Perk C                             |
| ------------ | --------------------------------- | ----------------------------------- | ---------------------------------- |
| Cyber        | `GHOST_PROTOCOL`: −30% alert gain | `OVERCLOCKED`: −20% duration        | `DEEP SCAN`: +15% success          |
| Extraction   | `CLEAN EXIT`: injury chance −20%  | `EVADE`: escape bez equipment loss  | `IRON WILL`: nikdy critical injury |
| Blackops     | `SHADOW STEP`: +20% success diff5 | `COLLATERAL DMG`: +50% rewards      | `GHOST`: capture chance −50%       |
| Surveillance | `NETWORK`: passive intel +1/tick  | `COUNTER-SURVEILLANCE`: decay +0.05 | `ANALYSIS`: chain missions +1 tier |
| Medical      | `FIELD MEDIC`: heal tým za mise   | `STIMS`: −30% healing time          | `DENIABILITY`: injury text hidden  |

Perk je uložen jako `veteranPerk?: string` na Agent entitě.

## 3. Mise — nové typy a mechaniky

### 3.2 Kooperativní mise (Multi-Site Operations)

Mise vyžadující agenty ze **2 různých safe houses** (nová property `requiresMultipleSafeHouses: true`). Oba týmy jsou dispatched simultánně, výsledek je průměr obou success chances ale rewards × 1.8. Pro tuto misi je nutný modul `comms_hub` (nový — viz sekce 5).

### 3.3 Defenzivní mise (Counter-Ops)

Nová kategorie: **`counter`**. Generuje se automaticky při `alertLevel ≥ 2.5` nebo náhodně (10% šance per tick při alert ≥ 2.0). Pokud není dokončena do 20 minut, safe house **přijde o 1 modul** (náhodný). Ignorace má reálné důsledky.

```typescript
// Generace:
if (alertLevel >= 2.5 && !activeCounterOpsInRegion) {
  generateCounterOp(regionId);
}
```

### 3.4 Sezonní / globální události

Každých 30 minut se aktivuje globální event z `WORLD_EVENTS`:

| Název          | Efekt                                                 | Trvání |
| -------------- | ----------------------------------------------------- | ------ |
| G8 Summit      | Influence mise +50% reward po dobu 10 min             | 10 min |
| Market Crash   | Finance mise reward × 2.0, ale alert +0.5 po skončení | 10 min |
| Cyber Blackout | Cyber mise unavailable ve 3 náhodných regionech       | 5 min  |
| Shadow War     | Blackops mise se generují 3× častěji                  | 8 min  |
| Media Frenzy   | Alert decay −50% globálně                             | 10 min |

Event se zobrazuje v `CurrenciesBar` jako blinkující badge s odpočtem.

### 3.5 Osobní mise agenta (Agent Personal Missions)

Veterán agenti mají 10% šanci za 24h generovat **osobní misi** — single-agent, narrative-heavy, bez komplikací. Rewards jsou nízké (spíš XP + speciální perk point), ale missne naznačují backstory agenta. Příklad: _"Phantom chce splatit dluh z minulosti v Bejrútu."_

---

## 4. Základna a progrese

### 4.2 HQ — centrální základna

Hráče **první safe house** (index=1) dostane speciální status **HQ**. HQ má extra tab v BaseScreen s globálními upgrady (neidentické s moduly):

| Upgrade            | Cena          | Efekt                                                              |
| ------------------ | ------------- | ------------------------------------------------------------------ |
| Intel Sítě         | 5 000 / 80◈   | +1 intel slot na každé misi zdarma                                 |
| Divize HQ          | 10 000 / 150◈ | Divize v HQ poskytují pasivní příjem i z jiných safe houses (−50%) |
| Globální logistika | 8 000 / 60◈   | Přesun agentů −50% čas                                             |
| Archiv             | 12 000 / 100◈ | Mission log udrží 200 záznamů místo 50                             |

### 4.3 Nový modul: Communications Hub

`comms_hub` — Komunikační centrum. Umožňuje **kooperativní mise** z tohoto safe house (viz 3.2). Cena: 6 000 / 50◈ / 20◆. Bez tohoto modulu se kooperativní mise v regionu negenerují.

## 5. Intel síť a mapa

### 5.2 Mapa — Region typ bonus

Regiony různých typů dávají bonus safe housu:

| Typ       | Bonus                                         |
| --------- | --------------------------------------------- |
| capital   | +1 influence/tick                             |
| financial | +2 money/tick                                 |
| tech      | +2 intel/tick                                 |
| port      | Logistics mise reward × 1.3                   |
| military  | Blackops mise reward × 1.3, alert decay −0.05 |
| border    | Přesun agentů −30% cena                       |

---

## 6. Rivalita a protistrana

### 6.1 Rival agentura (Shadow Faction)

Oblast inspirace: existující `alertLevel` systém. K lore přidá protivníka.

Hráč dostane jméno **rival agentury** (generované při onboardingu — 5 možností: NEXUS, CIPHER, HELIX, VORTEX, SPECTER). Rival provádí vlastní operace — každých 30–45 minut se v náhodném **vlastněném** regionu s alertLevel ≥ 1.5 vygeneruje `RIVAL_OPERATION event`:

| Event typ         | Efekt                                          |
| ----------------- | ---------------------------------------------- |
| Asset Compromise  | Jeden náhodný agent dostane −10 k primaryStat  |
| Intel Theft       | Ztráta 15–30◈                                  |
| Sabotage          | Modul v safe house přestane fungovat na 10 min |
| Agent Recruitment | Rival "přetáhne" nejslabšího agenta (zmizel)   |
| Disinformation    | Alert v regionu +0.5                           |

Rival eventy jdou ignorovat — ale mají nepříjemné důsledky. Nebo je lze "blokovat" dispatching **Counter-Op mise** (viz 3.3).

### 6.2 Rival eskalace

Čím víc misí player dokončí, tím agresivnější rival je (`rivalAggressionLevel = floor(totalMissionsCompleted / 25)`). Na level 3+ rival začne generovat "Hunt Squads" — rescue mise pro **hráčovy captured agenty** jsou obtížnější (+1 diff).

---

## 7. Progresní systém — pozdní hra

### 7.1 Pátý rank: Director

Po Agency Rank 10 (viz 4.1) se odemkne 5. rank **Ředitel** (`director`). Pouze 1 agent může mít tento rank najednou (globálně). Ředitel:

- Salary × 3.0
- Stat bonus × 1.5 oproti veteránovi
- Pasivní efekt: všichni agenti ve stejném safe house +5% success chance
- Speciální schopnost dle divize (viz Veteran Perks, ale silnější)

### 7.2 Globální influence projekty (Grand Operations)

Odemknou se při Agency Rank 7+. Jsou to multi-krokové "projekty" trvající 24–72 hodin reálného času, vyžadující dokončení 5–10 specifických misí v sekvenci. Reward: unikátní trvalý efekt (není dostupný jinak):

| Projekt               | Požadavek                              | Reward                                   |
| --------------------- | -------------------------------------- | ---------------------------------------- |
| Operation BLACKOUT    | 5× Cyber diff4+ v různých regionech    | Global alert decay +0.05 permanentně     |
| Operation HEGEMON     | 10× Influence mise v 5 zemích          | +1 influence slot v HQ                   |
| Operation CLEAN SWEEP | 3× Rescue mise success v řadě          | Capture chance −10% globálně             |
| Operation GHOST TOWN  | 7× mise s covert approach bez failures | Covert approach alert mult 0.3 místo 0.5 |

### 7.3 Achievementy / Odznaky

Hidden achievementy, viditelné v MenuScreen po splnění:

| Achievement        | Podmínka                          | Reward               |
| ------------------ | --------------------------------- | -------------------- |
| První krev         | 1 mise completed                  | Kosmetika HQ         |
| Nikdo nesmí vědět  | 10 covert misí bez failure        | Covert badge         |
| Obchodník se smrtí | 50 black market nákupů            | BM refresh −50% cena |
| Stín světa         | Expanze do 20 regionů             | Titul "Stín světa"   |
| Nesmrtelný         | 100 misí bez single ztráty agenta | Speciální logo frame |
| Neukojitelný       | 3× diff-5 mise v jednom dni       | +10% XP globálně     |

---

## 8. UX / workflow vylepšení

### 8.1 Quick Dispatch

Na kartě mise tlačítko "⚡ Quick" (vedle Dispatch): automaticky vybere **nejlepší dostupný tým** (optimální dle success chance) a approach a otevře Dispatch Modal předvyplněný. Hráč jen potvrdí. Ušetří čas u rutinních misí.

### 8.2 Mise filter + sort

Na MissionsScreen toolbar se filtry:

- **Kategorie** (chip filtry dle divize — barevné)
- **Obtížnost** (1★ – 5★ slider)
- **Sort:** reward / alert gain / time / difficulty
- **Pouze dostupné** (toggle — skryje locked mise)

### 8.3 Agent comparator

Ve výběru agentů pro dispatch: tlačítko "Porovnat" vedle dvou agentů zobrazí side-by-side stats. Notable diff hodnoty jsou zelené/červené.

### 8.10 Barevné kódování rizika v dispatch modalu

Success chance zobrazena jako filled arc (kruhový progress) s gradientem červená → zelená. Pod 30%: pulsuje červeně + zobrazí warning "Vysoké riziko". Vizuálnější než jen číslo.

---

## 9. Nový obsah — vybavení a typy

### 9.1 Setové bonusy vybavení (Equipment Sets)

Skupiny 3 itemů, které dávají bonus pokud jsou všechny tři nasazeny:

| Set             | Itemy                                 | Set bonus                          |
| --------------- | ------------------------------------- | ---------------------------------- |
| Ghost Loadout   | Silencer + Shadow Suit + Fake ID      | +15% success, alert ×0.7           |
| Combat Package  | Assault Rifle + Body Armor + Stimpack | −20% injury chance, +10 combat     |
| Tech Rig        | Laptop + Signal Disruptor + Ear Piece | +12 tech, cyber mise −20% duration |
| Medical Kit Pro | Med Kit + Stims + Nanobots            | Auto-heal light injuries, +8 intel |

### 9.2 Consumable vybavení

Nový property `charges: number` na equipmentu. Single-use itemy s vyšším bonusem:

| Item          | Effect                       | Charges | Cost      |
| ------------- | ---------------------------- | ------- | --------- |
| Frag Grenade  | +25% success na combat mise  | 1       | 200$      |
| Encrypted USB | +20% success na cyber mise   | 1       | 150$ / 5◈ |
| Burner Phone  | −50% alert gain z jedné mise | 1       | 300$ / 5◆ |

Po použití zmizí ze slotu. Ekonomická volba vs. trvalý item.

### 9.3 Regionálně specifické vybavení

Mise v určitých city types mohou odměnit unikátním vybavením dostupným jen tam:

| Region type | Unikátní item              | Efekt                             |
| ----------- | -------------------------- | --------------------------------- |
| military    | Military Grade Armor       | Combat +20, injury −30%           |
| tech        | Quantum Decryptor          | Tech +18, cyber mise success +12% |
| port        | Maritime Routing System    | Logistics mise duration −40%      |
| financial   | Offshore Account (passive) | +3 money/tick pasivní příjem      |

### 9.4 Divize 10: Research & Development

Nová divize `research` (🔬 cyan `#22d3ee`).

Unlock: 3 000$ / 50◈ / 20✦. Pasivní příjem: 0 money, 3 intel, 0 shadow, 1 influence.

R&D mise: `prototype_recovery`, `lab_infiltration`, `scientist_extraction`. Reward: unikátní itemy dostupné jen přes R&D mise. Strategicky: R&D divize = způsob jak získávat legendary equipment bez Black Marketu.

---

### 10.3 Soft deletion agentů

Místo pevného mazání z DB při `dead` statusu — uložit `deadAt: number`. Dead agenti se zobrazují v MenuScreen → "Padlí agenti" jako připomínka (memorial wall). Lze implementovat jako query `agents.filter(a => a.status === 'dead')`.

### 10.4 Batch generování světových eventů

```typescript
// V passiveIncome.ts — per 30s tick
function tickWorldEvents(store) {
  const now = Date.now();
  if (now > store.nextWorldEventAt) {
    const event = pickWeighted(WORLD_EVENTS, rng);
    applyWorldEvent(event);
    store.nextWorldEventAt = now + randInt(30 * 60 * 1000, 45 * 60 * 1000);
  }
}
```

---

_Dokument vytvořen: 24. března 2026_
