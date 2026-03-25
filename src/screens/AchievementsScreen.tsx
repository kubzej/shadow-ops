import { useState } from 'react';
import {
  Award,
  BarChart3,
  Building,
  ChevronLeft,
  CheckCircle,
  Clock,
  Coins,
  Cpu,
  Crown,
  EyeOff,
  Flame,
  Gem,
  Globe,
  Grid,
  Heart,
  Home,
  Layers,
  Link,
  Lock,
  Map,
  Moon,
  Package,
  ShieldCheck,
  ShoppingBag,
  Skull,
  Star,
  Swords,
  Target,
  TrendingUp,
  Unlock,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  type AchievementCategory,
} from '../data/achievements';
import {
  C,
  cardBase,
  activeTab,
  chipStyle,
} from '../styles/tokens';

// ─────────────────────────────────────────────
// Icon map (pouze ikony použité v achievement katalogu)
// ─────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  BarChart3,
  Building,
  CheckCircle,
  Clock,
  Coins,
  Cpu,
  Crown,
  EyeOff,
  Flame,
  Gem,
  Globe,
  Grid,
  Heart,
  Home,
  Layers,
  Link,
  Lock,
  Map,
  Moon,
  Package,
  ShieldCheck,
  ShoppingBag,
  Skull,
  Star,
  Swords,
  Target,
  TrendingUp,
  Unlock,
  UserPlus,
  Users,
  Zap,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Award;
}

const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  missions: C.green,
  agents: C.blue,
  map: C.divCyber,
  base: C.divLogistics,
  playtime: C.divInfluence,
  milestones: C.yellow,
  secret: C.bm,
  economy: '#facc15',
  rivals: '#ef4444',
};

// ─────────────────────────────────────────────
// Achievement card
// ─────────────────────────────────────────────

function AchievementCard({
  id,
  title,
  description,
  icon,
  color,
  hidden,
  unlocked,
}: {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  hidden?: boolean;
  unlocked: boolean;
}) {
  const Icon = getIcon(icon);
  const showLabel = unlocked || !hidden;
  const showDesc = unlocked || !hidden;

  return (
    <div
      key={id}
      className="flex items-start gap-3 p-3 rounded-xl"
      style={{
        ...cardBase,
        opacity: unlocked ? 1 : 0.55,
      }}
    >
      {/* Icon badge */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: unlocked ? `${color}18` : `${C.textMuted}12`,
        }}
      >
        {unlocked ? (
          <Icon size={18} color={color} />
        ) : (
          <Lock size={16} color={C.textMuted} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-tight"
          style={{ color: unlocked ? C.textPrimary : C.textMuted }}
        >
          {showLabel ? title : '???'}
        </p>
        <p
          className="text-xs mt-0.5 leading-snug"
          style={{ color: C.textMuted }}
        >
          {showDesc ? description : 'Splň podmínku pro odhalení.'}
        </p>
      </div>

      {/* Unlocked indicator */}
      {unlocked && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
          style={{ background: color }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function AchievementsScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);
  const unlocked = new Set(unlockedAchievements);

  const [activeCategory, setActiveCategory] =
    useState<AchievementCategory | 'all'>('all');

  const filtered =
    activeCategory === 'all'
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.category === activeCategory);

  const totalUnlocked = unlockedAchievements.length;
  const total = ACHIEVEMENTS.length;

  // Category counts
  const unlockedInCategory = (cat: AchievementCategory | 'all') => {
    if (cat === 'all') return totalUnlocked;
    return ACHIEVEMENTS.filter(
      (a) => a.category === cat && unlocked.has(a.id),
    ).length;
  };

  const totalInCategory = (cat: AchievementCategory | 'all') => {
    if (cat === 'all') return total;
    return ACHIEVEMENTS.filter((a) => a.category === cat).length;
  };

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: C.bgSurface }}
        >
          <ChevronLeft size={18} color={C.textSecondary} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Achievements</h1>
          <p className="text-xs" style={{ color: C.textMuted }}>
            {totalUnlocked} / {total} odemčeno
          </p>
        </div>
        <Award size={20} color={C.yellow} />
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-3">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: C.bgSurface2 }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${total > 0 ? (totalUnlocked / total) * 100 : 0}%`,
              background: C.green,
            }}
          />
        </div>
      </div>

      {/* Category tabs (horizontal scroll) */}
      <div className="px-4 mb-3 overflow-x-auto">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
          {/* Všechny */}
          <button
            onClick={() => setActiveCategory('all')}
            className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
            style={activeCategory === 'all' ? activeTab.active : activeTab.inactive}
          >
            Všechny
            <span
              className="px-1.5 py-0.5 rounded text-[10px]"
              style={chipStyle(activeCategory === 'all' ? C.green : C.textMuted)}
            >
              {unlockedInCategory('all')}/{totalInCategory('all')}
            </span>
          </button>
          {ACHIEVEMENT_CATEGORIES.map((cat) => {
            const color = CATEGORY_COLORS[cat.id];
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                style={isActive ? { ...activeTab.active, color } : activeTab.inactive}
              >
                {cat.label}
                <span
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={chipStyle(isActive ? color : C.textMuted)}
                >
                  {unlockedInCategory(cat.id)}/{totalInCategory(cat.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Achievement list */}
      <div className="px-4 flex flex-col gap-2">
        {filtered.map((a) => (
          <AchievementCard
            key={a.id}
            id={a.id}
            title={a.title}
            description={a.description}
            icon={a.icon}
            color={a.color}
            hidden={a.hidden}
            unlocked={unlocked.has(a.id)}
          />
        ))}
      </div>
    </div>
  );
}
