// ─────────────────────────────────────────────────────────────────────────────
// Shadow Ops — Design Tokens
// Jediný zdroj pravdy pro barvy, styly karet, buttonů a UI konstanty.
// NIKDY nepsat inline hex hodnoty — vždy importovat odsud.
//
// Filozofie:
//  • 1 primární akce = zelená
//  • 3 sémantické barvy = red (danger), yellow (warning), blue (info)
//  • Divize: vlastní barvy, POUZE uvnitř karet (avatar dot, badge chip)
//  • Karty jsou vždy stejné (cardBase) — barva žije uvnitř, ne na borderu
//  • Aktivní stav = jemně světlejší pozadí (bgSurface2), nikoli barevný border
// ─────────────────────────────────────────────────────────────────────────────
import type React from 'react';

// ─── BAREVNÁ PALETA ───────────────────────────────────────────────────────────

export const C = {
  // Pozadí — 3 úrovně
  bgBase: '#181818', // root stránka
  bgSurface: '#212121', // karta / panel
  bgSurface2: '#2a2a2a', // nested prvek, aktivní stav
  bgElevated: '#323232', // modální sheet, dropdown

  // Bordery — subtilní, oddělují ale nepoutají pozornost
  borderSubtle: '#1e1e1e',
  borderDefault: '#2c2c2c',
  borderStrong: '#3a3a3a',

  // Text — 3 úrovně
  textPrimary: '#f0f0f0',
  textSecondary: '#888888',
  textMuted: '#666666',
  textDisabled: '#4a4a4a',

  // Primární akce — zelená = jediná barva pro klikatelné akce, CTA, active tabs
  green: '#4ade80',

  // Sémantické — pouze pro stavy, nikoli pro entity
  red: '#ef4444', // danger, error, negative
  yellow: '#facc15', // warning, construction, cost
  blue: '#60a5fa', // intel, info

  // Entity barvy — divize
  // Používat VÝHRADNĚ na: avatar bg (opacity ~8%), badge chip, dot, ikona
  // NIKDY na: border karty, pozadí karty, pozadí sekce
  divSurveillance: '#4ade80',
  divCyber: '#60a5fa',
  divExtraction: '#f97316',
  divSabotage: '#ef4444',
  divInfluence: '#a78bfa',
  divFinance: '#facc15',
  divLogistics: '#94a3b8',
  divMedical: '#2dd4bf',
  divBlackops: '#6b7280',

  // Entity barvy — ostatní herní entity
  bm: '#a855f7', // black market (záměrně odlišné od divInfluence)
  legendary: '#f59e0b', // legendary rarity
  rose: '#f43f5e', // catastrophe výsledek
} as const;

// ─── DIVIZE ───────────────────────────────────────────────────────────────────

export const DIVISION_COLOR: Record<string, string> = {
  surveillance: C.divSurveillance,
  cyber: C.divCyber,
  extraction: C.divExtraction,
  sabotage: C.divSabotage,
  influence: C.divInfluence,
  finance: C.divFinance,
  logistics: C.divLogistics,
  medical: C.divMedical,
  blackops: C.divBlackops,
};

/** Barva divize podle ID. Fallback šedá. */
export function divisionColor(id: string): string {
  return DIVISION_COLOR[id] ?? C.divLogistics;
}

// ─── RARITY ───────────────────────────────────────────────────────────────────

export const RARITY_COLOR: Record<string, string> = {
  common: C.divLogistics,
  uncommon: C.green,
  rare: C.blue,
  legendary: C.legendary,
};

// ─── RANK ─────────────────────────────────────────────────────────────────────

export const RANK_LABEL: Record<string, string> = {
  recruit: 'Rekrut',
  operative: 'Agent',
  specialist: 'Specialista',
  veteran: 'Veterán',
  director: 'Ředitel',
};

export const RANK_STARS: Record<string, number> = {
  recruit: 1,
  operative: 2,
  specialist: 3,
  veteran: 4,
  director: 5,
};

// ─── STAV AGENTA ──────────────────────────────────────────────────────────────

export const STATUS_META: Record<string, { label: string; color: string }> = {
  available: { label: 'Volný', color: C.green },
  on_mission: { label: 'Na misi', color: C.blue },
  injured: { label: 'Zraněný', color: C.divExtraction },
  captured: { label: 'Zajat', color: C.red },
  traveling: { label: 'Cestuje', color: C.divInfluence },
  dead: { label: 'Mrtev', color: C.divBlackops },
};

// ─── ALERT LEVEL ──────────────────────────────────────────────────────────────

/** Sémantický gradient: zelená → žlutá → oranžová → červená */
export function alertColor(level: number): string {
  if (level < 0.5) return C.green;
  if (level < 1.2) return '#a3e635';
  if (level < 2.0) return C.yellow;
  if (level < 2.7) return C.divExtraction;
  return C.red;
}

// ─── TYP MĚSTA ────────────────────────────────────────────────────────────────

export function typeChar(type: string): string {
  switch (type) {
    case 'capital':
      return '★';
    case 'financial':
      return '$';
    case 'tech':
      return '⚙';
    case 'port':
      return '⚓';
    case 'military':
      return '✕';
    default:
      return '·';
  }
}

// ─── KATEGORIE MISE ───────────────────────────────────────────────────────────

export const CATEGORY_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  surveillance: { label: 'Sledování', color: C.divSurveillance, icon: '👁' },
  cyber: { label: 'Kyber', color: C.divCyber, icon: '💻' },
  extraction: { label: 'Extrakce', color: C.divExtraction, icon: '🚁' },
  sabotage: { label: 'Sabotáž', color: C.divSabotage, icon: '💥' },
  influence: { label: 'Vliv', color: C.divInfluence, icon: '✦' },
  finance: { label: 'Finance', color: C.divFinance, icon: '💰' },
  logistics: { label: 'Logistika', color: C.divLogistics, icon: '📦' },
  blackops: { label: 'Black Ops', color: C.rose, icon: '🎯' },
  counter: { label: 'Counter-Op', color: C.yellow, icon: '🛡' },
};

// ─── VÝSLEDEK MISE ────────────────────────────────────────────────────────────

export const RESULT_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  success: { label: 'Úspěch', color: C.green, bg: '#0d1e12' },
  partial: { label: 'Částečně', color: C.yellow, bg: '#1e1a00' },
  failure: { label: 'Selhání', color: C.red, bg: '#1e0a0a' },
  catastrophe: { label: 'Katastrofa', color: C.rose, bg: '#240606' },
};

// ─── STYLY KARET ──────────────────────────────────────────────────────────────

/**
 * Základní styl karty — všechny karty v aplikaci vypadají stejně.
 * Barva entity žije uvnitř karty (avatar, badge), nikoli na borderu.
 * Používat jako spread: `style={{ ...cardBase }}`
 */
export const cardBase: React.CSSProperties = {
  background: C.bgSurface,
  borderRadius: 14,
};

/**
 * Karta ve vybraném / aktivním stavu.
 * Jemně světlejší pozadí — žádný barevný border.
 */
export const cardActive: React.CSSProperties = {
  background: C.bgSurface2,
  borderRadius: 14,
};

/**
 * Avatar / initials badge uvnitř karty.
 * color = divisionColor nebo rarityColor entity
 */
export function avatarStyle(color: string): React.CSSProperties {
  return {
    background: `${color}14`, // ~8% opacity — jen tón
    color,
    borderRadius: 10,
  };
}

/**
 * Malý badge chip (divize, rarity, rank...).
 */
export function chipStyle(color: string): React.CSSProperties {
  return {
    background: `${color}14`,
    color,
    borderRadius: 6,
  };
}

// ─── STYLY BUTTONŮ ────────────────────────────────────────────────────────────

export const btn = {
  /** Hlavní CTA obrazovky — max 1× na screen. Zelená výplň. */
  primary: (disabled = false): React.CSSProperties => ({
    background: disabled ? C.bgSurface2 : C.green,
    color: disabled ? C.textDisabled : '#141414',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: 'none',
    borderRadius: 14,
    fontWeight: 600,
  }),

  /** Neutrální vedlejší akce. Tmavé bg, šedý text. */
  secondary: (disabled = false): React.CSSProperties => ({
    background: C.bgSurface2,
    color: disabled ? C.textDisabled : C.textSecondary,
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 14,
  }),

  /** Kontextová akce svázaná s entitou (hire, buy...) — barva entity. */
  action: (color: string, disabled = false): React.CSSProperties => ({
    background: disabled ? C.bgSurface2 : `${color}14`,
    color: disabled ? C.textDisabled : color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 14,
  }),

  /** Dismiss / zpět — neviditelné bg. */
  ghost: {
    background: 'transparent',
    color: C.textSecondary,
    border: 'none',
    cursor: 'pointer',
    borderRadius: 14,
  } as React.CSSProperties,

  /** Nevratné / nebezpečné akce. */
  destructive: {
    background: `${C.red}18`,
    color: C.red,
    cursor: 'pointer',
    borderRadius: 14,
    fontWeight: 600,
  } as React.CSSProperties,
};

// ─── AKTIVNÍ STAV (taby, list položky) ───────────────────────────────────────

/**
 * Aktivní tab nebo vybraná položka v listu.
 * ŽÁDNÝ barevný border — pouze jemnější pozadí + primární barva textu/ikony.
 */
export const activeTab = {
  active: {
    background: C.bgSurface2,
    color: C.green,
    borderRadius: 10,
  } as React.CSSProperties,
  inactive: {
    background: 'transparent',
    color: C.textMuted,
    borderRadius: 10,
  } as React.CSSProperties,
};

// ─── MODÁLNÍ OKNA ─────────────────────────────────────────────────────────────

export const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  background: 'rgba(0,0,0,0.82)',
};

export const modalSheet: React.CSSProperties = {
  background: C.bgElevated,
  borderRadius: '20px 20px 0 0',
};

/** Tenký akcentový pruh nahoře modálního sheetu — kontext operace. */
export function modalAccentBar(color: string): React.CSSProperties {
  return {
    height: 3,
    background: color,
    borderRadius: '20px 20px 0 0',
    marginBottom: 0,
  };
}
