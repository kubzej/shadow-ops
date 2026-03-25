# Shadow Ops - analyza aplikace a navrhy vylepseni

Tento dokument vychazi z projektove dokumentace v `docs/00-07` a hodnoti aktualni stav hry z pohledu produktu, UI, UX, ekonomiky, strategicke hloubky a dlouhodobe retence.

Nejde o kritiku implementace. Zaklad je uz ted solidni: hra ma citelny fantasy loop, slusne definovanou datovou vrstvu, dobry mobilni scope a konzistentni systemy. Zaroven je z dokumentace videt nekolik mist, kde lze pomerne levne ziskat vyssi citelnost, lepsi pacing a vetsi strategickou hloubku.

## 1. Shrnutí stavu

## Co uz funguje dobre

- Jasny core loop: expandovat -> odemykat divize -> nabirat agenty -> posilat mise -> rust ekonomicky i geograficky.
- Silna systemova kostra: regiony, alert, approach, equipment, rescue, rival, safe houses a mission tiers uz tvori dobry management sandbox.
- Dobry mobilni zaklad: bottom nav, bottom sheet modaly, sticky toolbar v misich, jednoduche screen rozdeleni.
- Rozumna datova modularita: store, engine a katalogy jsou oddelene tak, aby slo hru dale rozsirovat bez velkeho prepisu.
- Dobry potencial pro midcore management hru: rozhodnuti maji cenu, ale system jeste neni zbytecne komplikovany.

## Hlavni produktove slabiny

- Chybi silnejsi metagame cile mezi jednotlivymi misemi. Hrac roste, ale casto spis kvantitativne nez kvalitativne.
- Strategie se muze zploštit do optimalizace success chance a income ticku misto skutecneho rozhodovani mezi smery rozvoje.
- Alert je dobry system, ale zatim pusobi primarne jako lokalni penalizace, ne jako sirsi geopoliticky tlak.
- Safe house a divize jsou funkcni, ale ne vzdy generuji zajimava specializovana rozhodnuti. Casto je spravne proste pridat vic vykonu.
- UI je systemove bohate, ale hrozi pretlak dat bez dostatecne silne prioritizace a vysvetleni dopadu.
- Retence je spis operacni nez dramaticka. Hrac sbira progres, ale nema dostatek dlouhodobych payoffu, krizovych momentu a velkych milniku.

## 2. Nejvetsi prilezitosti

## A. Zviditelnit rozhodnuti, ne jen data

Hra uz ma hodne cisel, stavovych efektu a timeru. Dalsi rust kvality neprinese jen pridani dalsich systemu, ale hlavne lepsi vysvetleni:

- proc je konkretni mise dobra nebo spatna,
- proc region stoji za expanzi,
- proc je agent cenny,
- proc ekonomika stagnuje nebo roste,
- proc se rival chysta byt realna hrozba.

## B. Rozdelit hru na zretelne faze

Z dokumentace je patrna dobra early game struktura, ale stredni a pozdni cast potrebuji silnejsi identitu:

- early game: preziti, prvni expanze, prvni specializace,
- mid game: budovani site, protiakce s rivalem, specializace regionu,
- late game: mezinarodni tlak, velke operace, sitove synergie, riziko kolapsu.

## C. Zvysit asymetrii mezi volbami

Mnoho systemu je momentalne spis additivnich. Silnejsi hra vznikne ve chvili, kdy volba jedne cesty aktivne oslabuje jinou nebo meni styl hry.

Priklad:

- stealth-focused sit ma levnejsi alert management, ale slabsi high-yield agresivni mise,
- finance-heavy sit ma silnou ekonomiku, ale je zranitelnejsi v intel valce,
- black ops sit umi resit krize, ale je draha a politicky riskantni.

## 3. UI doporuceni

## Quick wins

### 3.1 Prioritizovana vrstva informaci

Na mobilu je potreba jeste silneji oddelit:

- kriticke informace,
- doporucene informace,
- detail pro power usera.

Navrh:

- Kazda karta mise, mesta a agenta by mela mit 1 hlavni radek rozhodnuti a 1 sekundarni radek kontextu.
- Ostatni detaily schovat do expand/collapse nebo sekundarniho modu.
- U misi zobrazit velky `dopad na sit` signal: zisk / risk / alert / rival relevance.

### 3.2 Silnejsi decision summaries

Pred potvrzenim klicove akce zobrazit strucne shrnuti v jedne vete:

- `Sance 71 %, nizky zisk, bezpecne snizi tlak v regionu.`
- `Rychla akce, vysoky alert, dobra volba pred rival utokem.`
- `Expanze otevira financni mesto a zlevni pohyb pres hranici.`

To je pro UX cennejsi nez dalsi ikonky.

### 3.3 Sitovy prehled v horni vrstve

Aktualne je mnoho informaci roztrzenych mezi Map, Base a Missions. Pomohl by lehky globalni prehled:

- netto prijem za tick,
- pocet volnych agentu,
- regiony ve vysokem alertu,
- pending rival threat,
- nejvetsi blokery rustu.

Forma:

- jeden kompakni panel nad obsahem,
- nebo otevritelný command sheet z Menu.

### 3.4 Vyraznejsi hierarchie v Agents screen

Agenti jsou stredobod hry, ale z dokumentace pusobi spis jako seznam jednotek. Doporucuji pridat silnejsi identitu:

- oznacit elitni agenty jako `core operatives`,
- ukazat `role fit` pro aktualni region nebo misi,
- zvyraznit `network impact`, napriklad aura, training centrum, unikatni streak.

### 3.5 Lepší map feedback

Mapa by mela komunikovat nejen vlastnictvi, ale i strategickou hodnotu.

Doplnit vizualni vrstvy:

- `hot zones` podle alertu,
- `economic hubs`,
- `rival pressure`,
- `supply reach` nebo `network depth` od startovniho jadra.

## Vyssi impact UI featury

### 3.6 Operations timeline

Pridat vertikalni timeline aktivni site:

- co se dokonci za 30 s / 2 min / 10 min,
- ktera mise dobihaji,
- ktere rescue nebo counter-op hrozi expiraci,
- kdy prijde rival okno.

To snizi kognitivni zatez a udrzi tok hry bez chaotickeho prepinani obrazovek.

### 3.7 Strategy overlays na mape

Uzivatel by mel mit moznost prepnout overlay:

- alert,
- income,
- expansion cost,
- division coverage,
- rival threat,
- mission density.

Mapa pak nebude jen navigacni, ale rozhodovaci nastroj.

## 4. UX doporuceni

## Nejvetsi UX rizika

- Velke mnozstvi stavovych detailu muze pusobit jako spreadsheet bez dostatecneho vedeni.
- Hrac zrejme casto vi, co se stalo, ale mene proc se to stalo.
- Nektere dulezite efekty jsou pasivni a malo citelne, treba vliv modulu, network bonusu nebo region type bonusu.

## Navrhy

### 4.1 Vysvetlovaci breakdowny vsude, kde je riziko nejasnosti

U success chance, duration, income a alertu doporucuji zobrazit explicitni breakdown:

- zaklad,
- agent leader score,
- tymovy bonus,
- equipment,
- alert penalizace,
- approach,
- modulovy efekt,
- rival modifikator.

Bez toho se system tezko uci a balancuje.

### 4.2 Post-mission debrief jako hlavni zdroj uceni

Collection modal je dobra kostra, ale mel by byt jeste edukativnejsi:

- `Proc uspela: vysoky tech lead, nizky alert, covert approach.`
- `Proc selhala: chybejici divize, vysoky alert, komplikace.`
- `Co to meni: rival tlak +1, region se priblizil hot state.`

To vytvori lepsi ucici smycku nez pouhy reward screen.

### 4.3 Měkčí onboarding do slozitosti

Onboarding resi zalozeni hry, ale ne nutne pochopeni systemu. Doplnit prvnich 10-15 minut o jemne questy:

- vysli prvni covert misi,
- prirad treti divizi,
- postav prvni specializovany modul,
- reaguj na prvni rival hrozbu,
- proved prvni relokaci agenta.

Ne jako tutorial overlay, ale jako operacni briefing.

### 4.4 Kontextove doporuceni misto generickych toastu

Toast je dobry na signal, ne na vysvetleni. Dulezite udalosti by mely mit akci:

- `Rival se pripravuje v Parizi. Otevrit counter-op.`
- `Sit je v zapornem ticku. Otevrit safe house ekonomiku.`
- `Veteran ma XP na Director slot. Otevrit detail.`

## 5. Economy doporuceni

## Co je na ekonomice dobre

- 4 meny davaji hře slusnou expresivitu.
- Divize a moduly vytvari vice os rozvoje.
- Pasivni income v kombinaci s vydeji za agenty, moduly a expanzi je dobry management fundament.

## Pravdepodobne slabe body ekonomiky

### 5.1 Risk snowballingu

Pokud hrac dobre trefi ekonomickou krivku, muze se hra zlomit do stabilniho scalingu bez dostatecneho protitlaku.

Navrhy:

- zavest `regional upkeep pressure` za rozsah site,
- zvysit cenu spatne koordinovane expanze,
- zavest `administrative load`, ktery nuti bud specializovat, nebo investovat do logistiky/vedeni.

### 5.2 Slabsi identity men v pozdejsi fazi

Je potreba, aby kazda mena mela i v mid/late game jasny stres:

- money: objem, provoz, rychlost scalingu,
- intel: pristup k operacim a informacni dominance,
- shadow: spinave reseni a elitni akce,
- influence: politicke odemykani, krizovy cushioning, manipulace systemu.

Pokud jedna mena dlouhodobe ztrati napeti, hra se zplošti.

### 5.3 Malo ekonomickych trade-offu mezi kratkym a dlouhym horizontem

Doporucuji pridat investice s opozdenou navratnosti:

- sleeper cell,
- shell company,
- kompromitovana instituce,
- lokalni informator network.

Kazda investice:

- zere zdroje ted,
- nese periodicky benefit pozdeji,
- muze byt odhalena rivalem nebo alertem.

## Konretni economy featury

### 5.4 Regional specialization

Kazdy safe house by mohl dostat specializaci, napriklad:

- Intel Hub,
- Black Clinic,
- Laundering Node,
- Forward Base,
- Diplomatic Cell.

Prinos:

- posili identitu regionu,
- ztizi rozhodnuti, protoze specializace blokuje jine buildy,
- lepe definuje sit jako celek.

### 5.5 Smuggling a supply lines

Zavedl bych lehkou logistickou vrstvu:

- vzdaleny region bez logisticke podpory je drazsi,
- border a port mesta snizuji friction,
- equipment a shadow-heavy operace jsou levnejsi pres vhodnou sit.

Tim mapa dostane realnou ekonomickou topologii.

### 5.6 Heat taxation

Pri vysokem alertu muze region docasne:

- generovat mensi income,
- zdrazovat recruitment,
- srazet kvalitu poolu,
- zhorsovat market rotaci.

To premeni alert z mise penalizace na makroekonomicky tlak.

## 6. Strategy doporuceni

## Aktualni potencial

Hra ma vsechny stavebni kameny pro silnou strategii, ale potrebuje silneji nutit hrace k volbe doktriny.

## Navrhy

### 6.1 Agency doctrines

Jedna z nejhodnotnejsich velkych featur.

Po urcitem milniku by si hrac zvolil doktrinu, napr.:

- Ghost Network: mensi alert, lepsi covert, horsi vysokovydelecne akce,
- Iron Directorate: agresivni mise, lepsi extraction/black ops, vyssi heat,
- Financial Capture: silne money a influence, horsi bojove reseni,
- Deep Signals: cyber/surveillance dominance, lepsi counter-play proti rivalovi.

Doktrina by mela:

- odemykat perky,
- menit balanc systemu,
- vytvaret replayabilitu.

### 6.2 Regional control tiers

Owned region je zatim spis binarni stav. Doplnit uroven kontroly:

- foothold,
- embedded,
- dominated.

Vyssi kontrola muze:

- snizovat alert decay problem,
- zlepsovat recruitment,
- odemykat lokalni operace,
- zvedat rival pozornost.

### 6.3 Counterplay proti vlastnimu min-maxu

Strategicka hra je silnejsi, kdyz nejde donekonecna opakovat jedno optimalni reseni.

Priklady:

- opakovane pouzivani stejneho pristupu v regionu zveda detekcni adaptaci,
- stejny leader je casteji cilem rivalu,
- opakovane finance-heavy akce zvysuji audit risk,
- presycenost jedne divize snizuje quality returns.

### 6.4 Crisis arcs

Misto izolovanych eventu pridat vicestupnove krize:

- leak -> probe -> raid,
- insider suspicion -> mole hunt -> split loyalty,
- sanctions -> asset freeze -> market collapse.

To vytvori strategicke oblouky, ne jen jednotlivy incident.

## 7. Mechaniky a systemic design

## Drobna vylepseni s vysokou hodnotou

### 7.1 Traits u agentu

Agenti by ziskali 1-2 trvalé vlastnosti:

- Cold Blooded: nizsi injury chance,
- Sloppy: vyssi alert gain,
- Linguist: bonus v cizich regionech,
- Ghost: silny covert bonus,
- Ambitious: rychle XP, vyssi salary,
- Compromised: riziko rival triggeru.

To zvysi emocionalni vazbu i roster decisions.

### 7.2 Fatigue nebo exposure

Ne nutne stamina system, ale lehka penalizace za spam jednoho agenta:

- kratsi okno `exposure`,
- lehce zvyseny injury risk,
- kratkodobe slabsi success bonus.

To podpori rotaci tymu.

### 7.3 Mission tags a team synergie

Krome kategorie pridat tagy:

- urban,
- diplomatic,
- digital,
- violent,
- timed,
- infiltration,
- extraction-heavy.

Agenti, equipment a doctrine pak mohou reagovat na tagy. System ziska vic designove elasticity bez nutnosti delat 20 novych men.

### 7.4 Komplikace jako volitelny risk, ne jen random vrstva

Misty by hrac mohl komplikaci predem prijmout nebo odmitnout:

- prijmout vyssi risk za bonus reward,
- investovat intel pro pre-briefing a snizit komplikaci,
- odlozit operaci za cenu expirace jine prilezitosti.

To z randomu dela rozhodnuti.

## Vetsi mechanicke feature smerovani

### 7.5 Story operations / multi-stage missions

Velmi silny smer pro mid/late game.

Operace by mela 3-5 kroku:

- reconnaissance,
- infiltration,
- pressure / sabotage,
- extraction,
- cleanup.

Kazda faze:

- pouzije jine divize,
- nese prenos stavu,
- umozni hraci zvolit risk profil.

To by vyborne prodalo sitovy charakter agentury.

### 7.6 Factions a geopolitika

Vedle rival agentury pridat frakce:

- statni bezpecnost,
- korporace,
- kriminalni syndikaty,
- aktivisticke site.

Region by pak nemel jen alert, ale i `power landscape`. Mise a eventy by davaly smysluplnejsi kontext.

### 7.7 Internal security

Silna feature pro pozdejsi cast:

- mole suspicion,
- loyalty,
- audit sitovych zranitelnosti,
- kompromitovane moduly,
- dvojiti agenti.

Diky tomu bude hrozba casto vychazet i zevnitr, ne jen z regionu nebo rivala.

## 8. Rival system doporuceni

Rival je dobra osa napeti, ale muze jit jeste dal.

## Co doplnit

### 8.1 Rival personality profiles

Rival agentura by nemela byt jen scheduler problemu. Kazdy rival muze mit profil:

- Predator: caste utoky na agenty,
- Broker: ekonomicke utoky a korupce,
- Specter: leak a dezinformace,
- General: direct counter-ops a kontrola regionu.

To podpori replayabilitu a anticipaci.

### 8.2 Visible rival campaign

Misto nahodnych hitu zobrazit i cast rivalova zameru:

- `Rival buduje vliv v severni Evrope.`
- `Rival se zameruje na technologicka mesta.`
- `Rival lovi elitni agenty.`

Hrac pak planuje, ne jen reaguje.

### 8.3 Rival territory pressure

Rival muze casem ziskavat skrytou kontrolu regionu nebo sektoru. Hrac pak musi:

- odhalovat infiltraci,
- cistit sit,
- prebijet control tiers.

## 9. Retence a dlouhodoby obsah

## Chybejici vrstva: velke milniky

Doporucuji doplnit vyrazne milestones:

- odemceni doktriny,
- prvni globalni krize,
- rezim `most wanted`,
- director council perk,
- endgame operace proti rival HQ.

## Další silne retencni prvky

### 9.1 Agency legacy

Po kampani nebo kolapsu muze cast hodnot prechazet do dalsiho runu:

- trvale kontakty,
- odemcene rival profily,
- doktrinalni research,
- kosmeticke trofeje,
- startovni perk.

To posili replay value bez nutnosti delat cisty roguelite.

### 9.2 Seasonal challenge mutators

Lehke challenge mody:

- Low Cash Start,
- Hyper Surveillance World,
- Double Rival Pressure,
- No Black Market,
- Wounded Stay Longer.

### 9.3 Dynamic achievements s dopadem na hru

Achievementy by mohly casto odemykat i lehke systemove bonusy nebo side goals, ne byt jen vitrinka.

## 10. Doporučená priorita implementace

## Faze 1 - vysoka hodnota, nizke riziko

- decision summaries u misi, expanze a klicovych akci,
- breakdown success chance, alert gain a income,
- debrief s vysvetlenim proc mise dopadla tak jak dopadla,
- globalni network overview panel,
- map overlays: alert / income / rival threat.

## Faze 2 - stredni feature vrstva

- regional specialization safe housu,
- traits u agentu,
- heat taxation pri vysokem alertu,
- operations timeline,
- visible rival intent.

## Faze 3 - velke systemove featury

- agency doctrines,
- multi-stage story operations,
- regional control tiers,
- factions a geopoliticka vrstva,
- agency legacy / long-run metaprogress.

## 11. Konkretni male zmeny, ktere bych udelal hned

- Pridat `proc ano / proc ne` u kazde mise.
- Zvysit viditelnost netto tick ekonomiky na vsech relevantnich screenech.
- U mesta ukazat `strategickou hodnotu` jednim souhrnnym tagem.
- U agenta ukazat `nejvhodnejsi role` a `riziko pretezovani`.
- U rival eventu vzdy zobrazit `jak tomu slo predejit`.
- U rescue a counter-op zviditelnit casovou kriticnost.
- U alertu ukazat i makro dopad, ne jen ciselny level.
- Zobrazit `sit je preexpanzovana` nebo `sit je financne zdrava` jako interpretaci stavu.

## 12. Konkretni velke feature nápady

### Varianta A - The Network Game

Focus na logistiku, supply lines, specialization a territorial control.

Nejvetsi prinos:

- mapa dostane opravdovy strategicky vyznam,
- regiony budou vic nez jen zdroj mise a safe housu,
- expanze prestane byt linearni rust.

### Varianta B - The Rival War

Focus na aktivni duel s jednou nebo vice agenturami.

Nejvetsi prinos:

- jasny antagonisticky tah,
- silnejsi napeti,
- lepsi kampanovy oblouk.

### Varianta C - The Human Layer

Focus na agenty, traits, loyalty, unavu, interni bezpecnost a personal stories.

Nejvetsi prinos:

- silnejsi emocionalni vazba,
- lepsi drama,
- vic smysluplnych roster rozhodnuti.

## 13. Zaver

Shadow Ops ma podle dokumentace velmi dobry zaklad pro mobilni midcore management hru. Nejvetsi sila projektu neni v tom, ze potrebuje dalsich deset izolovanych systemu, ale v tom, ze uz existujici systemy maji potencial byt mnohem citelnejsi, vice propojene a vice dramaticke.

Pokud bych mel zvolit jednu hlavni tezi:

> Dalsi velky posun kvality neprinese jen vic obsahu, ale hlavne lepsi citelnost dopadu, silnejsi strategicka asymetrie a vetsi dlouhodoby oblouk kampane.

Prakticky doporuceny smer:

- nejdriv zlepsit cteni systemu a kvalitu rozhodovani,
- potom pridat specializaci site a agentu,
- nakonec vystavet vyraznou metagame osu pres doctrines, rival war nebo geopoliticke kampane.
