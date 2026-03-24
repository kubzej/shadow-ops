# Shadow Ops — Design systém

Jediný zdroj pravdy: `src/styles/tokens.ts`. **Nikdy psát inline hex** — vždy importovat z tokenů.

---

## Filozofie

- **1 primární akce** = zelená (`C.green`)
- **3 sémantické barvy** = red (danger), yellow (warning), blue (info)
- **Divize** mají vlastní barvy, ale **pouze uvnitř karet** (avatar dot, badge chip, accent bar)
- **Karty jsou vždy stejné** (cardBase) — barva entity nesmí být na borderu
- **Active state** = jemně světlejší pozadí (`bgSurface2`), nikdy barevný border

---

## Barevná paleta (`C`)

### Pozadí (3 úrovně)

| Token          | Hex       | Použití                              |
|----------------|-----------|--------------------------------------|
| `C.bgBase`     | `#181818` | Root stránka, hlavní pozadí          |
| `C.bgSurface`  | `#212121` | Karta, panel                         |
| `C.bgSurface2` | `#2a2a2a` | Nested prvek, active/selected state  |
| `C.bgElevated` | `#323232` | Modální sheet, dropdown              |

### Bordery

| Token               | Hex       | Použití              |
|---------------------|-----------|----------------------|
| `C.borderSubtle`    | `#1e1e1e` | Nejjemnější oddělovač |
| `C.borderDefault`   | `#2c2c2c` | Standardní border     |
| `C.borderStrong`    | `#3a3a3a` | Výrazný border        |

### Text (3 úrovně)

| Token              | Hex       | Použití                         |
|--------------------|-----------|----------------------------------|
| `C.textPrimary`    | `#f0f0f0` | Hlavní text                     |
| `C.textSecondary`  | `#888888` | Popisky, sekundární info        |
| `C.textMuted`      | `#666666` | Placeholdery, disabled labels   |
| `C.textDisabled`   | `#4a4a4a` | Disabled prvky                  |

### Akce a sémantika

| Token      | Hex       | Použití                                               |
|------------|-----------|-------------------------------------------------------|
| `C.green`  | `#4ade80` | Primární akce, CTA, success, active tab, XP bar       |
| `C.red`    | `#ef4444` | Danger, error, failure, captured status               |
| `C.yellow` | `#facc15` | Warning, partial, construction, cost indicators       |
| `C.blue`   | `#60a5fa` | Intel měna, info, on_mission status                   |

### Speciální

| Token          | Hex       | Použití                              |
|----------------|-----------|--------------------------------------|
| `C.bm`         | `#a855f7` | Black market (záměrně ≠ divInfluence) |
| `C.legendary`  | `#f59e0b` | Legendary rarity                     |
| `C.rose`       | `#f43f5e` | Catastrophe výsledek mise            |

### Barvy divizí

| Token                | Hex       | Divize       |
|----------------------|-----------|--------------|
| `C.divSurveillance`  | `#4ade80` | surveillance |
| `C.divCyber`         | `#60a5fa` | cyber        |
| `C.divExtraction`    | `#f97316` | extraction   |
| `C.divSabotage`      | `#ef4444` | sabotage     |
| `C.divInfluence`     | `#a78bfa` | influence    |
| `C.divFinance`       | `#facc15` | finance      |
| `C.divLogistics`     | `#94a3b8` | logistics    |
| `C.divMedical`       | `#2dd4bf` | medical      |
| `C.divBlackops`      | `#6b7280` | blackops     |

Funkce `divisionColor(id)` vrátí barvu divize dle ID, fallback = `C.divLogistics` (šedá).

---

## Rarity barvy

```typescript
RARITY_COLOR = {
  common:    C.divLogistics,  // #94a3b8 šedá
  uncommon:  C.green,         // #4ade80
  rare:      C.blue,          // #60a5fa
  legendary: C.legendary,     // #f59e0b
}
```

---

## Rank labels a hvězdičky

```typescript
RANK_LABEL = {
  recruit:    'Rekrut',
  operative:  'Agent',
  specialist: 'Specialista',
  veteran:    'Veterán',
}

RANK_STARS = {
  recruit:    1,
  operative:  2,
  specialist: 3,
  veteran:    4,
}
```

---

## Status agenta (STATUS_META)

```typescript
STATUS_META = {
  available:  { label: 'Volný',    color: C.green          },
  on_mission: { label: 'Na misi',  color: C.blue           },
  injured:    { label: 'Zraněný',  color: C.divExtraction  },  // oranžová
  captured:   { label: 'Zajat',    color: C.red            },
  traveling:  { label: 'Cestuje',  color: C.divInfluence   },  // fialová
  dead:       { label: 'Mrtev',    color: C.divBlackops    },  // šedá
}
```

---

## Výsledky misí (RESULT_META)

```typescript
RESULT_META = {
  success:     { label: 'Úspěch',    color: C.green,  bg: '#0d1e12' },
  partial:     { label: 'Částečně',  color: C.yellow, bg: '#1e1a00' },
  failure:     { label: 'Selhání',   color: C.red,    bg: '#1e0a0a' },
  catastrophe: { label: 'Katastrofa',color: C.rose,   bg: '#240606' },
}
```

---

## Kategorie misí (CATEGORY_META)

```typescript
CATEGORY_META = {
  surveillance: { label: 'Sledování', color: C.divSurveillance, icon: '👁'  },
  cyber:        { label: 'Kyber',     color: C.divCyber,        icon: '💻' },
  extraction:   { label: 'Extrakce',  color: C.divExtraction,   icon: '🚁' },
  sabotage:     { label: 'Sabotáž',   color: C.divSabotage,     icon: '💥' },
  influence:    { label: 'Vliv',      color: C.divInfluence,    icon: '✦'  },
  finance:      { label: 'Finance',   color: C.divFinance,      icon: '💰' },
  logistics:    { label: 'Logistika', color: C.divLogistics,    icon: '📦' },
  blackops:     { label: 'Black Ops', color: C.rose,            icon: '🎯' },
}
```

---

## Karta styly

```typescript
// Základní karta — všechny karty stejné
cardBase: React.CSSProperties = {
  background: C.bgSurface,   // #212121
  borderRadius: 14,
}

// Aktivní/vybraná karta
cardActive: React.CSSProperties = {
  background: C.bgSurface2,  // #2a2a2a
  borderRadius: 14,
}

// Avatar uvnitř karty (color = divisionColor nebo rarityColor)
avatarStyle(color) = {
  background: `${color}14`,  // 8% opacity — jen barevný tón
  color: color,
  borderRadius: 10,
}

// Badge chip (divize, rarity, rank...)
chipStyle(color) = {
  background: `${color}14`,
  color: color,
  borderRadius: 6,
}
```

---

## Tlačítka (`btn`)

```typescript
btn.primary(disabled=false)
  → disabled: bg=bgSurface2, color=textDisabled, opacity=0.45
  → enabled:  bg=C.green, color='#141414', fontWeight=600, borderRadius=14

btn.secondary(disabled=false)
  → bg=bgSurface2, color=textSecondary/textDisabled, borderRadius=14

btn.action(color, disabled=false)
  → disabled: bg=bgSurface2, color=textDisabled
  → enabled:  bg=`${color}14`, color=color, borderRadius=14
  → pro kontextové akce svázané s entitou (hire, buy, assign)

btn.ghost
  → background=transparent, color=textSecondary, border=none

btn.destructive
  → bg=`${C.red}18`, color=C.red, fontWeight=600, borderRadius=14
  → pro nevratné akce (delete, reset)
```

---

## Aktivní taby

```typescript
activeTab.active = {
  background: C.bgSurface2,
  color: C.green,
  borderRadius: 10,
}
activeTab.inactive = {
  background: 'transparent',
  color: C.textMuted,
  borderRadius: 10,
}
```

---

## Modaly

```typescript
// Overlay pozadí
modalOverlay = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  background: 'rgba(0,0,0,0.82)',
}

// Sheet (slide up z dolního okraje)
modalSheet = {
  background: C.bgElevated,  // #323232
  borderRadius: '20px 20px 0 0',
}

// Tenký accent bar nahoře (kontext operace — barva kategorie mise atd.)
modalAccentBar(color) = {
  height: 3,
  background: color,
  borderRadius: '20px 20px 0 0',
}
```

---

## Alert level barevný gradient (`alertColor`)

```typescript
alertColor(level) {
  if level < 0.5  → '#4ade80'  // green
  if level < 1.2  → '#a3e635'  // lime
  if level < 2.0  → '#facc15'  // yellow
  if level < 2.7  → '#f97316'  // orange
  else            → '#ef4444'  // red
}
```

---

## Toasty (ToastContainer v App.tsx)

```typescript
TOAST_COLORS = {
  success: '#4ade80',
  error:   '#ef4444',
  warning: '#facc15',
  info:    '#60a5fa',
}
// Container: background #262626, color = TOAST_COLORS[type]
// Position: fixed bottom (4.5rem), above BottomNav
// Border radius: rounded-xl (12px)
```

---

## Celková layout struktura

```
<div style={{ height: '100%', background: '#222222' }}>
  <main style={{ paddingBottom: '4rem', paddingTop: 'safe-area-inset-top' }}>
    {/* Screen content, scrollable */}
    <Routes> ... </Routes>
  </main>
  <BottomNav />     {/* fixed bottom, height ~4rem */}
  <ToastContainer />
</div>
```

Obsah screenu má `overflow-y: auto`, tedy scrolluje uvnitř `<main>`.
Safe area insets pro iPhone notch/home indicator.
