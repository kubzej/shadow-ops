// Shadow Ops — World Events catalog
// 5 positive + 5 negative global events cycling every ~30 minutes.

export type WorldEventId =
  | 'g8_summit'
  | 'media_frenzy'
  | 'whistleblower'
  | 'economic_boom'
  | 'arms_deal'
  | 'cyber_blackout'
  | 'market_crash'
  | 'interpol_sweep'
  | 'sanctions'
  | 'mole_alert';

export interface WorldEventDef {
  id: WorldEventId;
  name: string;
  description: string;
  durationMs: number;
  /** true = beneficial for player, false = challenge */
  positive: boolean;

  // ── Reward multipliers (applied at mission collect) ──────────────────────
  /** G8 Summit: influence rewards × mult */
  influenceRewardMult?: number;
  /** Whistleblower: intel rewards × mult */
  intelRewardMult?: number;
  /** Economic Boom: money rewards × mult */
  moneyRewardMult?: number;
  /** Market Crash: finance category all rewards × mult */
  financeRewardMult?: number;
  /** Arms Deal: extraction + blackops shadow rewards × mult */
  armsDealShadowMult?: number;
  /** Sanctions: money, shadow, influence rewards × mult (intel untouched) */
  allRewardsMult?: number;

  // ── Alert modifiers ────────────────────────────────────────────────────────
  /** Media Frenzy: passive alert decay multiplier per 30s tick */
  alertDecayMult?: number;
  /** Interpol Sweep: alertGain from missions × mult */
  alertGainMult?: number;

  // ── Mission blocking ───────────────────────────────────────────────────────
  /** Cyber Blackout: mission category that becomes unavailable for dispatch */
  blockedCategory?: string;

  // ── Success chance ─────────────────────────────────────────────────────────
  /** Mole Alert: flat penalty subtracted from successChance at resolve time */
  successChancePenalty?: number;

  // ── Activation effects ─────────────────────────────────────────────────────
  /** Immediate alert +N applied to all owned regions when event starts */
  onActivateAlertBonus?: number;
}

export const WORLD_EVENTS: WorldEventDef[] = [
  // ── POSITIVE ────────────────────────────────────────────────────────────────
  {
    id: 'g8_summit',
    name: 'Summit G8',
    description: 'Diplomatická kooperace — Influence mise +50 % odměna',
    durationMs: 10 * 60 * 1000,
    positive: true,
    influenceRewardMult: 1.5,
  },
  {
    id: 'media_frenzy',
    name: 'Mediální bouře',
    description: 'Pozornost médií tlumí zpravodajství — Alert decay ×2',
    durationMs: 10 * 60 * 1000,
    positive: true,
    alertDecayMult: 2.0,
  },
  {
    id: 'whistleblower',
    name: 'Whistleblower',
    description: 'Informace jsou v kurzu — Intel z misí ×2',
    durationMs: 8 * 60 * 1000,
    positive: true,
    intelRewardMult: 2.0,
  },
  {
    id: 'economic_boom',
    name: 'Ekonomický boom',
    description: 'Trhy rostou — Money z misí +30 %',
    durationMs: 10 * 60 * 1000,
    positive: true,
    moneyRewardMult: 1.3,
  },
  {
    id: 'arms_deal',
    name: 'Zbrojní dohoda',
    description: 'Ilegální obchod — Extraction a Blackops Shadow +80 %',
    durationMs: 8 * 60 * 1000,
    positive: true,
    armsDealShadowMult: 1.8,
  },
  // ── NEGATIVE ────────────────────────────────────────────────────────────────
  {
    id: 'cyber_blackout',
    name: 'Kyber výpadek',
    description: 'Globální výpadek sítí — Cyber mise nedostupné',
    durationMs: 5 * 60 * 1000,
    positive: false,
    blockedCategory: 'cyber',
  },
  {
    id: 'market_crash',
    name: 'Krach trhu',
    description: 'Kolaps trhů — Alert +0.5 ihned, Finance mise odměna −50 %',
    durationMs: 10 * 60 * 1000,
    positive: false,
    onActivateAlertBonus: 0.5,
    financeRewardMult: 0.5,
  },
  {
    id: 'interpol_sweep',
    name: 'Akce Interpolu',
    description: 'Mezinárodní razie — Alert gain z misí ×2',
    durationMs: 8 * 60 * 1000,
    positive: false,
    alertGainMult: 2.0,
  },
  {
    id: 'sanctions',
    name: 'Sankce',
    description: 'Mezinárodní sankce — Money, Shadow a Influence z misí −30 %',
    durationMs: 8 * 60 * 1000,
    positive: false,
    allRewardsMult: 0.7,
  },
  {
    id: 'mole_alert',
    name: 'Podezření na agenta',
    description: 'Zpravodajská komunita v pohotovosti — Success chance −15 %',
    durationMs: 6 * 60 * 1000,
    positive: false,
    successChancePenalty: 0.15,
  },
];
