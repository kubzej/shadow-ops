import { C } from '../../styles/tokens';

export function alertColor(level: number): string {
  if (level < 0.5) return C.green;
  if (level < 1.2) return '#a3e635';
  if (level < 2.0) return C.yellow;
  if (level < 2.7) return '#f97316';
  return C.red;
}

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
    case 'border':
      return '⬡';
    default:
      return '·';
  }
}

/** Human-readable Czech label for a region type. */
export function typeLabel(type: string): string {
  switch (type) {
    case 'capital':   return 'Hlavní město';
    case 'financial': return 'Finanční';
    case 'tech':      return 'Tech';
    case 'port':      return 'Přístav';
    case 'military':  return 'Vojenský';
    case 'border':    return 'Hraniční';
    default:          return type;
  }
}

/** Short inline description of region type bonuses for tooltip/subtitle use. */
export function regionTypeBonusSummary(
  primaryType: string,
  secondaryType?: string,
): string {
  const bonuses: string[] = [];

  function describe(t: string): string {
    switch (t) {
      case 'capital':   return '+příjem & vliv';
      case 'financial': return '+peníze';
      case 'tech':      return '+intel';
      case 'port':      return '+peníze & shadow, mise ×1.3';
      case 'military':  return '+shadow, mise ×1.3';
      case 'border':    return '+intel & shadow, slevy cestování';
      default:          return '';
    }
  }

  const p = describe(primaryType);
  if (p) bonuses.push(p);
  if (secondaryType) {
    const s = describe(secondaryType);
    if (s) bonuses.push(s);
  }
  return bonuses.join(' · ');
}
