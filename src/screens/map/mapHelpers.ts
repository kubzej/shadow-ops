export function alertColor(level: number): string {
  if (level < 0.5) return '#4ade80';
  if (level < 1.2) return '#a3e635';
  if (level < 2.0) return '#facc15';
  if (level < 2.7) return '#f97316';
  return '#ef4444';
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
    default:
      return '·';
  }
}
