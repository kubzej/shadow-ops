import { NavLink } from 'react-router-dom';
import { Map, Target, Users, Building2, Menu } from 'lucide-react';

const tabs = [
  { to: '/map', icon: Map, label: 'Mapa' },
  { to: '/missions', icon: Target, label: 'Mise' },
  { to: '/agents', icon: Users, label: 'Agenti' },
  { to: '/base', icon: Building2, label: 'Základna' },
  { to: '/menu', icon: Menu, label: 'Menu' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex border-t"
      style={{
        background: '#111111',
        borderColor: '#2a2a2a',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 py-2 text-xs transition-colors ${
              isActive ? 'text-green-400' : 'text-gray-500'
            }`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
