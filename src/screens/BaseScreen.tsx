import { useState } from 'react';
import CityBar from '../components/CityBar';
import CurrenciesBar from '../components/CurrenciesBar';
import { C } from '../styles/tokens';
import { RecruitmentTab } from './base/RecruitmentTab';
import { SafeHouseTab } from './base/SafeHouseTab';
import { DivisionsTab } from './base/DivisionsTab';
import { ShopTab } from './base/ShopTab';
import { BlackMarketTab } from './base/BlackMarketTab';

type Tab = 'recruit' | 'safehouse' | 'divisions' | 'shop' | 'blackmarket';

const TABS: { id: Tab; label: string }[] = [
  { id: 'recruit', label: 'Nábor' },
  { id: 'safehouse', label: 'Safe House' },
  { id: 'divisions', label: 'Divize' },
  { id: 'shop', label: 'Obchod' },
  { id: 'blackmarket', label: 'Černý trh' },
];

export default function BaseScreen() {
  const [tab, setTab] = useState<Tab>('recruit');

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-lg font-bold tracking-tight mb-3">Základna</h1>

        <div className="mb-4">
          <CurrenciesBar />
        </div>

        <CityBar />

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? C.bgSurface2 : 'transparent',
                color: tab === t.id ? C.green : C.textMuted,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-4">
        {tab === 'recruit' && <RecruitmentTab />}
        {tab === 'safehouse' && <SafeHouseTab />}
        {tab === 'divisions' && <DivisionsTab />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'blackmarket' && <BlackMarketTab />}
      </div>
    </div>
  );
}
