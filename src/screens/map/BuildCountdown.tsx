import { useEffect, useState } from 'react';

export function BuildCountdown({ completesAt }: { completesAt: number }) {
  const [rem, setRem] = useState(
    Math.max(0, Math.ceil((completesAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(
      () => setRem(Math.max(0, Math.ceil((completesAt - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [completesAt]);
  const m = Math.floor(rem / 60),
    s = rem % 60;
  return (
    <span>{rem > 0 ? `${m}:${String(s).padStart(2, '0')}` : 'Hotovo'}</span>
  );
}
