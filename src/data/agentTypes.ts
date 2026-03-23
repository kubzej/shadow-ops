export type DivisionId =
  | 'surveillance'
  | 'cyber'
  | 'extraction'
  | 'sabotage'
  | 'influence'
  | 'finance'
  | 'logistics'
  | 'medical'
  | 'blackops';

export type AgentRank = 'recruit' | 'operative' | 'specialist' | 'veteran';

export interface AgentTypeStats {
  stealth: [number, number]; // [base, variance]
  combat: [number, number];
  intel: [number, number];
  tech: [number, number];
}

export interface AgentType {
  id: string;
  name: string;
  division: DivisionId;
  description: string;
  baseStats: AgentTypeStats;
  rankMultiplier: Record<AgentRank, number>;
  recruitCost: number; // in 💵
  salary: number; // per 30s passive tick
}

// Recruit is weak. Stats grow significantly each rank so leveling matters.
// recruit=1.0 → operative=1.5 → specialist=2.0 → veteran=2.6
// Primary stat recruit avg ~28 → veteran avg ~73, which maps to minStats:
//   diff2=25 (recruit barely), diff3=40 (operative), diff4=55 (specialist), diff5=65 (veteran)
const RANK_MULT: Record<AgentRank, number> = {
  recruit: 1.0,
  operative: 1.5,
  specialist: 2.0,
  veteran: 2.6,
};

// Each division has 4 agent types
export const AGENT_TYPES: AgentType[] = [
  // === SURVEILLANCE (4) ===
  {
    id: 'shadow',
    name: 'Shadow',
    division: 'surveillance',
    description: 'Mistrovský v pozorování, téměř neviditelný.',
    baseStats: {
      stealth: [28, 6],
      combat: [10, 4],
      intel: [22, 5],
      tech: [14, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 300,
    salary: 3,
  },
  {
    id: 'watcher',
    name: 'Watcher',
    division: 'surveillance',
    description: 'Specialista na dlouhodobé sledování.',
    baseStats: {
      stealth: [22, 5],
      combat: [12, 4],
      intel: [28, 6],
      tech: [16, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 250,
    salary: 2,
  },
  {
    id: 'scout',
    name: 'Scout',
    division: 'surveillance',
    description: 'Rychlý průzkumník terénu.',
    baseStats: {
      stealth: [24, 6],
      combat: [18, 5],
      intel: [18, 4],
      tech: [10, 3],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 200,
    salary: 2,
  },
  {
    id: 'analyst_surv',
    name: 'Field Analyst',
    division: 'surveillance',
    description: 'Sbírá a analyzuje data přímo v terénu.',
    baseStats: {
      stealth: [16, 4],
      combat: [8, 3],
      intel: [32, 5],
      tech: [22, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 275,
    salary: 3,
  },

  // === CYBER (4) ===
  {
    id: 'hacker',
    name: 'Hacker',
    division: 'cyber',
    description: 'Proniká do systémů s lehkostí.',
    baseStats: {
      stealth: [20, 4],
      combat: [6, 3],
      intel: [24, 5],
      tech: [32, 6],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 375,
    salary: 3,
  },
  {
    id: 'coder',
    name: 'Coder',
    division: 'cyber',
    description: 'Vytváří malware a zákeřné nástroje.',
    baseStats: {
      stealth: [14, 4],
      combat: [4, 2],
      intel: [22, 4],
      tech: [34, 5],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 350,
    salary: 3,
  },
  {
    id: 'ghost_net',
    name: 'Ghost Net',
    division: 'cyber',
    description: 'Neviditelný v kyberprostoru.',
    baseStats: {
      stealth: [26, 6],
      combat: [6, 3],
      intel: [24, 5],
      tech: [30, 5],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 325,
    salary: 3,
  },
  {
    id: 'sniffer',
    name: 'Sniffer',
    division: 'cyber',
    description: 'Zachytává a dešifruje komunikaci.',
    baseStats: {
      stealth: [18, 4],
      combat: [8, 3],
      intel: [30, 6],
      tech: [28, 5],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 300,
    salary: 3,
  },

  // === EXTRACTION (4) ===
  {
    id: 'cleaner',
    name: 'Cleaner',
    division: 'extraction',
    description: 'Vyřeší každou situaci bez stop.',
    baseStats: {
      stealth: [24, 6],
      combat: [28, 5],
      intel: [12, 4],
      tech: [10, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 130,
    salary: 4,
  },
  {
    id: 'courier',
    name: 'Courier',
    division: 'extraction',
    description: 'Přenáší aktiva přes nepřátelské území.',
    baseStats: {
      stealth: [28, 5],
      combat: [16, 4],
      intel: [14, 4],
      tech: [12, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 250,
    salary: 3,
  },
  {
    id: 'driver',
    name: 'Driver',
    division: 'extraction',
    description: 'Řidič-specialista pro útěky.',
    baseStats: {
      stealth: [20, 4],
      combat: [18, 5],
      intel: [10, 4],
      tech: [22, 5],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 225,
    salary: 2,
  },
  {
    id: 'fixer',
    name: 'Fixer',
    division: 'extraction',
    description: 'Vjednává únikové trasy a kryje stopy.',
    baseStats: {
      stealth: [22, 4],
      combat: [14, 4],
      intel: [20, 4],
      tech: [12, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 275,
    salary: 3,
  },

  // === SABOTAGE (4) ===
  {
    id: 'demo_expert',
    name: 'Demo Expert',
    division: 'sabotage',
    description: 'Specialista na výbušniny.',
    baseStats: {
      stealth: [16, 4],
      combat: [26, 5],
      intel: [10, 4],
      tech: [28, 6],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 350,
    salary: 3,
  },
  {
    id: 'disruptor',
    name: 'Disruptor',
    division: 'sabotage',
    description: 'Sabotuje infrastrukturu a operace.',
    baseStats: {
      stealth: [20, 5],
      combat: [22, 4],
      intel: [16, 4],
      tech: [22, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 300,
    salary: 3,
  },
  {
    id: 'arsonist',
    name: 'Arsonist',
    division: 'sabotage',
    description: 'Rychlé a čisté ničení cílů.',
    baseStats: {
      stealth: [22, 6],
      combat: [24, 4],
      intel: [8, 4],
      tech: [16, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 250,
    salary: 3,
  },
  {
    id: 'wrecker',
    name: 'Wrecker',
    division: 'sabotage',
    description: 'Hrubá síla a důslednost.',
    baseStats: {
      stealth: [10, 4],
      combat: [32, 6],
      intel: [6, 3],
      tech: [12, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 275,
    salary: 3,
  },

  // === INFLUENCE (4) ===
  {
    id: 'handler',
    name: 'Handler',
    division: 'influence',
    description: 'Verbuje a řídí informátory.',
    baseStats: {
      stealth: [18, 4],
      combat: [12, 4],
      intel: [28, 5],
      tech: [10, 3],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 325,
    salary: 3,
  },
  {
    id: 'diplomat',
    name: 'Diplomat',
    division: 'influence',
    description: 'Ovlivňuje politická rozhodnutí.',
    baseStats: {
      stealth: [16, 4],
      combat: [8, 3],
      intel: [32, 6],
      tech: [8, 2],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 400,
    salary: 5,
  },
  {
    id: 'provocateur',
    name: 'Provocateur',
    division: 'influence',
    description: 'Vytváří zmatek a nestabilitu.',
    baseStats: {
      stealth: [24, 6],
      combat: [18, 4],
      intel: [24, 4],
      tech: [8, 3],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 275,
    salary: 3,
  },
  {
    id: 'spindoctor',
    name: 'Spin Doctor',
    division: 'influence',
    description: 'Manipuluje mediálním obrazem.',
    baseStats: {
      stealth: [14, 4],
      combat: [6, 3],
      intel: [34, 5],
      tech: [12, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 350,
    salary: 4,
  },

  // === FINANCE (4) ===
  {
    id: 'broker',
    name: 'Broker',
    division: 'finance',
    description: 'Pohybuje fondy nenápadně.',
    baseStats: {
      stealth: [20, 4],
      combat: [6, 3],
      intel: [26, 5],
      tech: [22, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 350,
    salary: 4,
  },
  {
    id: 'laundryman',
    name: 'Laundryman',
    division: 'finance',
    description: 'Čistí špinavé peníze.',
    baseStats: {
      stealth: [22, 4],
      combat: [4, 2],
      intel: [24, 4],
      tech: [20, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 300,
    salary: 3,
  },
  {
    id: 'auditor',
    name: 'Ghost Auditor',
    division: 'finance',
    description: 'Krade finanční data.',
    baseStats: {
      stealth: [18, 4],
      combat: [4, 2],
      intel: [28, 6],
      tech: [26, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 325,
    salary: 3,
  },
  {
    id: 'counterfeiter',
    name: 'Counterfeiter',
    division: 'finance',
    description: 'Falzifikátor dokladů a měn.',
    baseStats: {
      stealth: [22, 6],
      combat: [8, 4],
      intel: [20, 4],
      tech: [24, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 250,
    salary: 3,
  },

  // === LOGISTICS (4) ===
  {
    id: 'quartermaster',
    name: 'Quartermaster',
    division: 'logistics',
    description: 'Zásobuje operace vybavením.',
    baseStats: {
      stealth: [14, 4],
      combat: [16, 4],
      intel: [18, 4],
      tech: [24, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 225,
    salary: 2,
  },
  {
    id: 'smuggler',
    name: 'Smuggler',
    division: 'logistics',
    description: 'Přepravuje zakázané zboží.',
    baseStats: {
      stealth: [26, 6],
      combat: [14, 4],
      intel: [16, 4],
      tech: [16, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 250,
    salary: 3,
  },
  {
    id: 'forger',
    name: 'Forger',
    division: 'logistics',
    description: 'Vyrábí falešné identity a doklady.',
    baseStats: {
      stealth: [20, 4],
      combat: [8, 4],
      intel: [22, 4],
      tech: [26, 5],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 275,
    salary: 3,
  },
  {
    id: 'coordinator',
    name: 'Coordinator',
    division: 'logistics',
    description: 'Orchestruje složité operace.',
    baseStats: {
      stealth: [16, 4],
      combat: [12, 4],
      intel: [28, 5],
      tech: [20, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 300,
    salary: 3,
  },

  // === MEDICAL (4) ===
  {
    id: 'medic',
    name: 'Medic',
    division: 'medical',
    description: 'Udržuje agenty v poli.',
    baseStats: {
      stealth: [16, 4],
      combat: [14, 4],
      intel: [20, 4],
      tech: [26, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 250,
    salary: 2,
  },
  {
    id: 'pharmacist',
    name: 'Pharmacist',
    division: 'medical',
    description: 'Výroba serum a jedů.',
    baseStats: {
      stealth: [18, 4],
      combat: [8, 4],
      intel: [22, 4],
      tech: [30, 5],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 300,
    salary: 2,
  },
  {
    id: 'surgeon',
    name: 'Surgeon',
    division: 'medical',
    description: 'Zvládá i záchranné operace v terénu.',
    baseStats: {
      stealth: [14, 4],
      combat: [12, 4],
      intel: [24, 5],
      tech: [32, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 375,
    salary: 3,
  },
  {
    id: 'chemist',
    name: 'Chemist',
    division: 'medical',
    description: 'Analytik biologických hrozeb.',
    baseStats: {
      stealth: [12, 4],
      combat: [6, 3],
      intel: [26, 6],
      tech: [32, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 325,
    salary: 3,
  },

  // === BLACKOPS (4) — slightly higher base, elite division ===
  {
    id: 'phantom',
    name: 'Phantom',
    division: 'blackops',
    description: 'Nejvyšší třída eliminátorů.',
    baseStats: {
      stealth: [32, 5],
      combat: [32, 5],
      intel: [16, 4],
      tech: [16, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 625,
    salary: 5,
  },
  {
    id: 'assassin',
    name: 'Assassin',
    division: 'blackops',
    description: 'Rychlá a přesná likvidace.',
    baseStats: {
      stealth: [30, 5],
      combat: [34, 5],
      intel: [12, 4],
      tech: [12, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 550,
    salary: 5,
  },
  {
    id: 'infiltrator',
    name: 'Infiltrator',
    division: 'blackops',
    description: 'Proniká i do nejstřeženějších objektů.',
    baseStats: {
      stealth: [34, 5],
      combat: [24, 4],
      intel: [20, 4],
      tech: [20, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 575,
    salary: 5,
  },
  {
    id: 'wetworker',
    name: 'Wetworker',
    division: 'blackops',
    description: 'Bez stop, bez svědků.',
    baseStats: {
      stealth: [28, 5],
      combat: [36, 4],
      intel: [10, 4],
      tech: [8, 4],
    },
    rankMultiplier: RANK_MULT,
    recruitCost: 500,
    salary: 4,
  },
];

export const AGENT_TYPE_MAP = new Map(AGENT_TYPES.map((a) => [a.id, a]));

export const DIVISIONS: {
  id: DivisionId;
  name: string;
  color: string;
  description: string;
}[] = [
  {
    id: 'surveillance',
    name: 'Surveillance',
    color: '#4ade80',
    description: 'Sledování a zpravodajství',
  },
  {
    id: 'cyber',
    name: 'Cyber',
    color: '#60a5fa',
    description: 'Kybernetické operace',
  },
  {
    id: 'extraction',
    name: 'Extraction',
    color: '#f97316',
    description: 'Záchrana a přesun aktiv',
  },
  {
    id: 'sabotage',
    name: 'Sabotage',
    color: '#ef4444',
    description: 'Ničení infrastruktury',
  },
  {
    id: 'influence',
    name: 'Influence',
    color: '#a78bfa',
    description: 'Psychologické operace',
  },
  {
    id: 'finance',
    name: 'Finance',
    color: '#facc15',
    description: 'Finanční manipulace',
  },
  {
    id: 'logistics',
    name: 'Logistics',
    color: '#94a3b8',
    description: 'Zásobování a podpora',
  },
  {
    id: 'medical',
    name: 'Medical',
    color: '#2dd4bf',
    description: 'Lékařská podpora',
  },
  {
    id: 'blackops',
    name: 'Black Ops',
    color: '#6b7280',
    description: 'Popíratelné operace',
  },
];
