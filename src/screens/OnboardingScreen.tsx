import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Coins, Eye, Ghost, Globe, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { START_CITY_IDS } from '../data/regions';
import { REGION_MAP } from '../data/regions';
import { COUNTRY_MAP } from '../data/countries';
import { initializeGame } from '../engine/initializeGame';
import { ORG_LOGOS, DEFAULT_LOGO_ID } from '../data/orgLogos';
import { randomId } from '../utils/rng';
import { C, cardBase, btn } from '../styles/tokens';

const START_CITIES = START_CITY_IDS.map((id) => {
  const region = REGION_MAP.get(id)!;
  const country = COUNTRY_MAP.get(region.countryId);
  return { id, name: region.name, country: country?.name ?? '' };
});

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

export default function OnboardingScreen() {
  const navigate = useNavigate();

  const [agencyName, setAgencyName] = useState('');
  const [bossName, setBossName] = useState('');
  const [rivalName, setRivalName] = useState('NEXUS');
  const [logoId, setLogoId] = useState(DEFAULT_LOGO_ID);
  const [startCity, setStartCity] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedLogo = ORG_LOGOS.find((l) => l.id === logoId) ?? ORG_LOGOS[0];

  // ── Validation ──────────────────────────────
  const nameValid = (v: string) => v.trim().length >= 2;
  const step1Valid =
    nameValid(agencyName) && nameValid(bossName) && nameValid(rivalName);

  // ── Submit ──────────────────────────────────
  async function handleStart() {
    if (!startCity || !step1Valid) return;
    setLoading(true);
    setError('');
    try {
      const slotId = randomId();
      await initializeGame(
        agencyName.trim(),
        bossName.trim(),
        rivalName.trim(),
        startCity,
        logoId,
        slotId,
      );
      navigate('/map', { replace: true });
    } catch (e) {
      setError('Chyba při inicializaci hry. Zkus to znovu.');
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-6 text-center">
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: C.bgSurface2,
            }}
          >
            <LogoSVG paths={selectedLogo.paths} size={36} color={C.green} />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">SHADOW OPS</h1>
        <p className="text-sm" style={{ color: '#888' }}>
          Nastav svoji agenturu
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ background: s <= step ? C.green : C.bgSurface2 }}
          />
        ))}
      </div>

      <div className="flex-1 px-5 pb-8 flex flex-col">
        {/* ── STEP 1: Agency info ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5 flex-1">
            <div>
              <label
                className="block text-xs font-medium mb-2 tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Název agentury
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="např. NEXUS, PHANTOM, SPECTRE..."
                maxLength={32}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={{
                  background: C.bgSurface,
                  color: C.textPrimary,
                }}
              />
              {agencyName.length > 0 && !nameValid(agencyName) && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  Minimálně 2 znaky
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-2 tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Tvé jméno / Krycí název
              </label>
              <input
                type="text"
                value={bossName}
                onChange={(e) => setBossName(e.target.value)}
                placeholder="např. Director, Handler, Ghost..."
                maxLength={32}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={{
                  background: C.bgSurface,
                  color: C.textPrimary,
                }}
              />
              {bossName.length > 0 && !nameValid(bossName) && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  Minimálně 2 znaky
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-2 tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Jméno rival agentury
              </label>
              <input
                type="text"
                value={rivalName}
                onChange={(e) => setRivalName(e.target.value)}
                placeholder="např. NEXUS, CIPHER, HELIX..."
                maxLength={32}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                style={{
                  background: C.bgSurface,
                  color: C.textPrimary,
                }}
              />
              {rivalName.length > 0 && !nameValid(rivalName) && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  Minimálně 2 znaky
                </p>
              )}
            </div>

            <div className="flex-1" />

            <button
              onClick={() => step1Valid && setStep(2)}
              disabled={!step1Valid}
              className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: step1Valid ? C.green : C.bgSurface2,
                color: step1Valid ? C.bgBase : C.textMuted,
                cursor: step1Valid ? 'pointer' : 'not-allowed',
              }}
            >
              Pokračovat <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP 2: Logo selection ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="mb-1">
              <p className="text-sm font-medium">Vyber symbol organizace</p>
              <p className="text-xs mt-1" style={{ color: '#999' }}>
                Bude reprezentovat tvou agenturu napříč celou hrou.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-3 flex-1">
              {ORG_LOGOS.map((logo) => {
                const selected = logo.id === logoId;
                return (
                  <button
                    key={logo.id}
                    onClick={() => setLogoId(logo.id)}
                    className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: selected ? C.bgSurface2 : C.bgSurface,
                    }}
                  >
                    <LogoSVG
                      paths={logo.paths}
                      size={32}
                      color={selected ? C.green : C.textMuted}
                    />
                    <span
                      className="text-xs"
                      style={{ color: selected ? C.green : C.textMuted }}
                    >
                      {logo.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={btn.secondary()}
              >
                Zpět
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 transition-all"
                style={{ background: C.green, color: C.bgBase }}
              >
                Pokračovat <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Start city ── */}
        {step === 3 && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Globe size={16} color={C.green} />
              <span className="text-sm font-medium">
                Zvol základnu agentury
              </span>
            </div>
            <p className="text-xs mb-2" style={{ color: '#999' }}>
              Toto město se stane vaším prvním safe housem.
            </p>

            <div className="grid grid-cols-2 gap-2 flex-1">
              {START_CITIES.map((city) => (
                <button
                  key={city.id}
                  onClick={() => setStartCity(city.id)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background:
                      startCity === city.id ? C.bgSurface2 : C.bgSurface,
                  }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{
                      color: startCity === city.id ? C.green : C.textPrimary,
                    }}
                  >
                    {city.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#999' }}>
                    {city.country}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={btn.secondary()}
              >
                Zpět
              </button>
              <button
                onClick={() => startCity && setStep(4)}
                disabled={!startCity}
                className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 transition-all"
                style={{
                  background: startCity ? C.green : C.bgSurface2,
                  color: startCity ? C.bgBase : C.textMuted,
                  cursor: startCity ? 'pointer' : 'not-allowed',
                }}
              >
                Pokračovat <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div className="flex flex-col gap-5 flex-1">
            <h2 className="text-base font-semibold">Shrnutí</h2>

            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={cardBase}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#999' }}>
                  Symbol
                </span>
                <div className="flex items-center gap-2">
                  <LogoSVG
                    paths={selectedLogo.paths}
                    size={18}
                    color={C.green}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: C.textPrimary }}
                  >
                    {selectedLogo.name}
                  </span>
                </div>
              </div>
              <Row label="Agentura" value={agencyName} />
              <Row label="Ředitel" value={bossName} />
              <Row label="Rival" value={rivalName} />
              <Row
                label="Základna"
                value={START_CITIES.find((c) => c.id === startCity)?.name ?? ''}
              />
            </div>

            <div className="rounded-xl p-4" style={cardBase}>
              <p
                className="text-xs font-medium mb-3 tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Startovní zdroje
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Resource
                  Icon={Coins}
                  color={C.green}
                  label="Peníze"
                  value="1 500"
                />
                <Resource Icon={Eye} color={C.blue} label="Intel" value="30" />
                <Resource Icon={Ghost} color={C.bm} label="Shadow" value="0" />
                <Resource
                  Icon={Radio}
                  color={C.divExtraction}
                  label="Vliv"
                  value="0"
                />
              </div>
            </div>

            <div className="rounded-xl p-4" style={cardBase}>
              <p
                className="text-xs font-medium mb-2 tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Startovní divize
              </p>
              <div className="flex gap-2">
                <DivisionBadge name="Surveillance" color="#4ade80" />
                <DivisionBadge name="Cyber" color="#60a5fa" />
              </div>
            </div>

            {error && (
              <p className="text-sm text-center" style={{ color: '#ef4444' }}>
                {error}
              </p>
            )}

            <div className="flex-1" />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={btn.secondary()}
              >
                Zpět
              </button>
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex-1 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: loading ? C.bgSurface2 : C.green,
                  color: loading ? C.green : C.bgBase,
                }}
              >
                {loading ? (
                  <span className="animate-pulse">Inicializuji...</span>
                ) : (
                  <>
                    Spustit operaci <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: '#999' }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: C.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

function Resource({
  Icon,
  label,
  value,
  color,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={18} color={color} />
      <div>
        <div className="text-xs" style={{ color: '#999' }}>
          {label}
        </div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function DivisionBadge({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="px-3 py-1 rounded-full text-xs font-medium"
      style={{
        background: `${color}22`,
        color,
      }}
    >
      {name}
    </div>
  );
}
