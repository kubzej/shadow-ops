# Shadow Ops — Návrhy vylepšení

> Kreativní návrhy pro rozšíření hry: nové mechaniky, obsah, UX detaily a herní hloubka.
> Seřazeno od nejmenšího (implementačně) po největší (systémové).

---

## 1 MOJE

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

_Dokument vytvořen: 24. března 2026_
