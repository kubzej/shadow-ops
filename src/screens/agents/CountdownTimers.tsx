import { useEffect, useState } from 'react';
import { formatTime } from './agentHelpers';

export function HealingCountdown({ healsAt }: { healsAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((healsAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((healsAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [healsAt]);

  return <span>{remaining > 0 ? formatTime(remaining) : 'Vyléčen'}</span>;
}

export function TravelCountdown({ arrivesAt }: { arrivesAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((arrivesAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((arrivesAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [arrivesAt]);
  return <span>{remaining > 0 ? formatTime(remaining) : 'Dorazil'}</span>;
}
