import { NavLink } from 'react-router-dom';
import { Map, Target, Users, Building2, Menu } from 'lucide-react';
import { C } from '../styles/tokens';

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
      className="flex"
      style={{
        background: C.bgBase,
        flexShrink: 0,
        marginBottom: -20,
      }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className="flex flex-1">
          {({ isActive }) => (
            <span
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs transition-all"
              style={{
                color: isActive ? C.green : C.textMuted,
                background: isActive ? C.bgSurface2 : 'transparent',
                borderRadius: 12,
                margin: '4px 4px',
              }}
            >
              <Icon size={isActive ? 22 : 20} />
              <span style={{ fontWeight: isActive ? 600 : 400 }}>{label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
