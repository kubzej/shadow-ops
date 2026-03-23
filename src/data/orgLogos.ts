export interface OrgLogo {
  id: string;
  name: string;
  /** SVG path data (viewBox="0 0 64 64") */
  paths: string;
}

export const ORG_LOGOS: OrgLogo[] = [
  {
    id: 'serpent',
    name: 'Serpent',
    paths: `
      <circle cx="32" cy="18" r="5" fill="currentColor"/>
      <ellipse cx="29" cy="17" rx="1.5" ry="1" fill="#0a0a0a"/>
      <ellipse cx="35" cy="17" rx="1.5" ry="1" fill="#0a0a0a"/>
      <line x1="30" y1="22" x2="28" y2="25" stroke="#0a0a0a" stroke-width="1"/>
      <line x1="34" y1="22" x2="36" y2="25" stroke="#0a0a0a" stroke-width="1"/>
      <path d="M 32 23 C 20 28, 16 36, 20 44 C 24 52, 40 52, 44 44 C 48 36, 44 28, 32 23 Z" fill="none" stroke="currentColor" stroke-width="3"/>
      <path d="M 32 32 C 36 36, 36 40, 32 44 C 28 40, 28 36, 32 32 Z" fill="currentColor"/>
    `,
  },
  {
    id: 'eye',
    name: 'Eye',
    paths: `
      <ellipse cx="32" cy="32" rx="22" ry="12" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="32" cy="32" r="8" fill="currentColor"/>
      <circle cx="32" cy="32" r="4" fill="#0a0a0a"/>
      <circle cx="34" cy="30" r="1.5" fill="currentColor"/>
      <line x1="32" y1="8" x2="32" y2="14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="14" y1="14" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="50" y1="14" x2="46" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    `,
  },
  {
    id: 'skull',
    name: 'Skull',
    paths: `
      <path d="M 32 10 C 18 10, 12 20, 12 30 C 12 38, 16 43, 22 45 L 22 52 L 42 52 L 42 45 C 48 43, 52 38, 52 30 C 52 20, 46 10, 32 10 Z" fill="currentColor"/>
      <ellipse cx="23" cy="30" rx="5" ry="6" fill="#0a0a0a"/>
      <ellipse cx="41" cy="30" rx="5" ry="6" fill="#0a0a0a"/>
      <rect x="27" y="45" width="4" height="7" rx="1" fill="#0a0a0a"/>
      <rect x="33" y="45" width="4" height="7" rx="1" fill="#0a0a0a"/>
      <path d="M 26 38 L 38 38" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'dagger',
    name: 'Dagger',
    paths: `
      <line x1="32" y1="6" x2="32" y2="50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <path d="M 32 6 L 26 20 L 32 18 L 38 20 Z" fill="currentColor"/>
      <rect x="22" y="36" width="20" height="4" rx="2" fill="currentColor"/>
      <rect x="28" y="48" width="8" height="6" rx="2" fill="currentColor"/>
      <line x1="14" y1="14" x2="50" y2="50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
      <line x1="50" y1="14" x2="14" y2="50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
    `,
  },
  {
    id: 'hex',
    name: 'Hex',
    paths: `
      <polygon points="32,10 50,21 50,43 32,54 14,43 14,21" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="32" y1="10" x2="32" y2="54" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <line x1="14" y1="21" x2="50" y2="43" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <line x1="50" y1="21" x2="14" y2="43" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <circle cx="32" cy="32" r="5" fill="currentColor"/>
    `,
  },
  {
    id: 'ouroboros',
    name: 'Ouroboros',
    paths: `
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="6"/>
      <circle cx="32" cy="14" r="6" fill="currentColor"/>
      <circle cx="29" cy="13" r="1.5" fill="#0a0a0a"/>
      <circle cx="35" cy="13" r="1.5" fill="#0a0a0a"/>
      <path d="M 30 19 L 28 23 M 34 19 L 36 23" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="8" fill="#0a0a0a"/>
      <circle cx="32" cy="32" r="3" fill="currentColor"/>
    `,
  },
  {
    id: 'prism',
    name: 'Prism',
    paths: `
      <polygon points="32,8 56,52 8,52" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="32,20 46,44 18,44" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="8" x2="32" y2="52" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <circle cx="32" cy="38" r="4" fill="currentColor"/>
    `,
  },
  {
    id: 'orbit',
    name: 'Orbit',
    paths: `
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <ellipse cx="32" cy="32" rx="20" ry="8" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(45 32 32)"/>
      <ellipse cx="32" cy="32" rx="20" ry="8" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-45 32 32)"/>
      <circle cx="32" cy="32" r="4" fill="currentColor"/>
    `,
  },
];

export const DEFAULT_LOGO_ID = 'eye';
