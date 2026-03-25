import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { ORG_LOGOS, DEFAULT_LOGO_ID } from '../data/orgLogos';
import { C, btn, cardBase, modalOverlay, modalSheet } from '../styles/tokens';
import { listSaveSlots, deleteSaveSlot, type SaveSlot } from '../db/saveSlots';

function LogoSVG({
  paths,
  size = 40,
  color = 'currentColor',
}: {
  paths: string;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color }}
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}

interface Props {
  onLoadSlot: (slotId: string) => Promise<void>;
  onNewGame: () => void;
}

export default function LandingScreen({ onLoadSlot, onNewGame }: Props) {
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    listSaveSlots().then((s) => {
      setSlots(s);
      setLoading(false);
    });
  }, []);

  async function handleLoad(slotId: string) {
    setLoadingSlot(slotId);
    await onLoadSlot(slotId);
  }

  async function handleDelete(slotId: string) {
    setDeleting(true);
    await deleteSaveSlot(slotId);
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
    setDeleteConfirm(null);
    setDeleting(false);
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-4 text-center">
        <h1
          className="text-2xl font-bold tracking-widest uppercase"
          style={{ color: C.green }}
        >
          Shadow Ops
        </h1>
        <p className="text-xs mt-1" style={{ color: C.textDisabled }}>
          Uložené hry
        </p>
      </div>

      {/* Slot list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: C.textDisabled }}>
              Načítám...
            </p>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm" style={{ color: C.textMuted }}>
              Žádné uložené hry
            </p>
          </div>
        ) : (
          slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              now={now}
              loading={loadingSlot === slot.id}
              onLoad={() => handleLoad(slot.id)}
              onDeleteRequest={() => setDeleteConfirm(slot.id)}
            />
          ))
        )}

        {/* New game button */}
        <button
          onClick={onNewGame}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 mt-2"
          style={btn.primary()}
        >
          <Plus size={16} />
          Nová hra
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50"
          style={modalOverlay}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-6"
            style={modalSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} color="#ef4444" />
              <p className="font-semibold" style={{ color: '#ef4444' }}>
                Smazat uložení?
              </p>
            </div>
            <p className="text-sm mb-5" style={{ color: C.textSecondary }}>
              Tato akce je nevratná. Celý postup bude ztracen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={btn.secondary()}
              >
                Zrušit
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={btn.destructive}
              >
                {deleting ? 'Mažu...' : 'Smazat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  now,
  loading,
  onLoad,
  onDeleteRequest,
}: {
  slot: SaveSlot;
  now: number;
  loading: boolean;
  onLoad: () => void;
  onDeleteRequest: () => void;
}) {
  const logo =
    ORG_LOGOS.find((l) => l.id === slot.logoId) ??
    ORG_LOGOS.find((l) => l.id === DEFAULT_LOGO_ID)!;

  const ageLabel = useMemo(() => {
    const ms = now - slot.lastSavedAt;
    const mins = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (mins < 2) return 'Právě teď';
    if (hours < 1) return `před ${mins} min`;
    if (hours < 24) return `před ${hours} h`;
    if (days === 1) return 'včera';
    return `před ${days} dny`;
  }, [now, slot.lastSavedAt]);

  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={cardBase}>
      {/* Logo */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: C.bgBase }}
      >
        <LogoSVG paths={logo.paths} size={28} color={C.green} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{slot.agencyName}</p>
        <p className="text-xs truncate" style={{ color: C.textMuted }}>
          Dir. {slot.bossName}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs" style={{ color: C.green }}>
            ${slot.money.toLocaleString()}
          </span>
          <span className="text-xs" style={{ color: C.textMuted }}>
            {slot.totalMissionsCompleted} misí
          </span>
          <span className="text-xs" style={{ color: C.textDisabled }}>
            {ageLabel}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onDeleteRequest}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: C.bgBase, color: C.red }}
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={onLoad}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-bold"
          style={{ ...btn.primary(), opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '...' : 'Načíst'}
        </button>
      </div>
    </div>
  );
}
