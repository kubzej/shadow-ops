export function StatBar({
  label,
  value,
  color,
  bonus,
}: {
  label: string;
  value: number;
  color: string;
  bonus?: number;
}) {
  const base = bonus ? value - bonus : value;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-12 flex-shrink-0" style={{ color: '#999' }}>
        {label}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: '#666666' }}
      >
        <div className="h-full flex">
          <div style={{ width: `${base}%`, background: color }} />
          {bonus && bonus > 0 && (
            <div
              style={{
                width: `${bonus}%`,
                background: 'rgba(255,255,255,0.4)',
              }}
            />
          )}
        </div>
      </div>
      <span
        className="text-xs w-7 text-right font-mono"
        style={{ color: '#aaa' }}
      >
        {value}
      </span>
    </div>
  );
}
