import { useEffect, useState } from 'react';
import { C } from '../../styles/tokens';
import { formatDuration } from '../../hooks/useMissionTimer';

export function Countdown({ completesAt }: { completesAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((completesAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((completesAt - Date.now()) / 1000));
      setRemaining(r);
    }, 500);
    return () => clearInterval(id);
  }, [completesAt]);

  return <span>{formatDuration(remaining)}</span>;
}

export function FlashCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isCritical = remaining <= 60;
  return (
    <span
      style={{
        color: isCritical ? C.red : C.divExtraction,
        fontWeight: 600,
        animation: isCritical
          ? 'flash-blink 0.8s ease-in-out infinite'
          : undefined,
      }}
    >
      {formatDuration(remaining)}
    </span>
  );
}
