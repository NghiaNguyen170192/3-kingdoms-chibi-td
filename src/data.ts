import type {
  EliteModifier,
  EnemyDef,
  EquipSlot,
  GemFamily,
  HeroDef,
  ItemBase,
  Modifier,
  Rarity,
  StatId,
} from "./types.js";

export const RARITY_ORDER: Rarity[] = [
  "normal",
  "magic",
  "rare",
  "unique",
  "legendary",
  "mythic",
];

/** Extra rolled modifiers by rarity. Data-driven for balancing. */
export const RARITY_AFFIX_COUNT: Record<Rarity, number> = {
  normal: 0,
  magic: 1,
  rare: 2,
  unique: 3,
  legendary: 4,
  mythic: 5,
};

export const EQUIPMENT_MERGE = {
  inputCount: 5,
} as const;

export const GEM_MERGE = {
  inputCount: 3,
} as const;

/** Sockets belong to the hero, not the item. Mythic is the cap. */
export const GEM_SOCKETS_BY_RARITY: Record<Rarity, number> = {
  normal: 1,
  magic: 2,
  rare: 3,
  unique: 4,
  legendary: 5,
  mythic: 6,
};

export const MAX_GEM_SOCKETS = GEM_SOCKETS_BY_RARITY.mythic;

export const HERO_MERGE = {
  inputCount: 3,
} as const;

/** Account energy. One point starts one wave. A cleared pass may drop a battery. */
export const ENERGY = {
  max: 100,
  perWave: 1,
  batteryValues: [1, 2, 5],
} as const;

/** Flat chance for items, gems, fragments, and a pass energy battery. */
export const DROP_CHANCE = 0.05;

function speedHero(
  id: string,
  name: string,
  rarity: Rarity,
  damage: number,
  attackSpeed: number,
  critChance: number,
): HeroDef {
  return {
    id,
    name,
    archetype: "speed",
    rarity,
    baseDamage: damage,
    attackSpeed,
    castSpeed: 1,
    range: 1,
    critChance,
    critMultiplier: 2,
    cleaveRadius: 0,
    aoeRadius: 0,
    gemSockets: GEM_SOCKETS_BY_RARITY[rarity],
  };
}

function damagerHero(
  id: string,
  name: string,
  rarity: Rarity,
  damage: number,
  attackSpeed: number,
  critChance: number,
): HeroDef {
  return {
    id,
    name,
    archetype: "damager",
    rarity,
    baseDamage: damage,
    attackSpeed,
    castSpeed: 1,
    range: 2,
    critChance,
    critMultiplier: 1.7,
    cleaveRadius: 1,
    aoeRadius: 0,
    gemSockets: GEM_SOCKETS_BY_RARITY[rarity],
  };
}

function mageHero(
  id: string,
  name: string,
  rarity: Rarity,
  damage: number,
  castSpeed: number,
  critChance: number,
): HeroDef {
  return {
    id,
    name,
    archetype: "mage",
    rarity,
    baseDamage: damage,
    attackSpeed: 1,
    castSpeed,
    range: 3,
    critChance,
    critMultiplier: 1.8,
    cleaveRadius: 0,
    aoeRadius: 1,
    gemSockets: GEM_SOCKETS_BY_RARITY[rarity],
  };
}

export const HERO_DEFS: HeroDef[] = [
  speedHero("zhao-yun", "Zhao Yun", "mythic", 8, 2.0, 0.2),
  speedHero("ma-chao", "Ma Chao", "mythic", 9, 2.15, 0.22),
  speedHero("gan-ning", "Gan Ning", "mythic", 7, 2.35, 0.16),
  speedHero("taishi-ci", "Taishi Ci", "mythic", 10, 2.25, 0.24),
  speedHero("sun-ce", "Sun Ce", "mythic", 8, 1.9, 0.18),
  damagerHero("guan-yu", "Guan Yu", "mythic", 26, 0.55, 0.08),
  damagerHero("zhang-fei", "Zhang Fei", "mythic", 24, 0.62, 0.07),
  damagerHero("lu-bu", "Lü Bu", "mythic", 32, 0.5, 0.12),
  damagerHero("xu-chu", "Xu Chu", "mythic", 22, 0.58, 0.06),
  damagerHero("dian-wei", "Dian Wei", "mythic", 28, 0.52, 0.1),
  mageHero("zhuge-liang", "Zhuge Liang", "mythic", 16, 0.75, 0.1),
  mageHero("sima-yi", "Sima Yi", "mythic", 17, 0.8, 0.12),
  mageHero("pang-tong", "Pang Tong", "mythic", 15, 0.85, 0.09),
  mageHero("guo-jia", "Guo Jia", "mythic", 14, 0.92, 0.08),
  mageHero("zhou-yu", "Zhou Yu", "mythic", 16, 0.78, 0.11),
];

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  troop: {
    type: "troop",
    name: "Troop",
    hp: 42,
    speed: 28,
    leakDamage: 1,
    resist: {},
    critResist: 0,
    regen: 0,
  },
  scout: {
    type: "scout",
    name: "Scout",
    hp: 22,
    speed: 58,
    leakDamage: 1,
    resist: {},
    critResist: 0,
    regen: 0,
  },
  brute: {
    type: "brute",
    name: "Brute",
    hp: 140,
    speed: 18,
    leakDamage: 1,
    resist: { physical: 0.4 },
    critResist: 0,
    regen: 0,
  },
  elite: {
    type: "elite",
    name: "Elite",
    hp: 95,
    speed: 32,
    leakDamage: 5,
    resist: { physical: 0.15 },
    critResist: 0.1,
    regen: 0,
  },
  boss: {
    type: "boss",
    name: "Lu Bu Echo",
    hp: 720,
    speed: 16,
    leakDamage: 10,
    resist: { physical: 0.2, fire: 0.15, cold: 0.15, lightning: 0.15 },
    critResist: 0.2,
    regen: 2,
  },
};

export const ELITE_MODIFIERS: EliteModifier[] = [
  "armoured",
  "fast",
  "regenerating",
  "fireResistant",
  "coldResistant",
  "lightningResistant",
  "toxicResistant",
  "criticalResistant",
];

export const ITEM_BASES: ItemBase[] = [
  {
    id: "dagger",
    name: "Chibi Dagger",
    slot: "weapon",
    weaponStyle: "oneHand",
    implicits: [{ id: "flatDamage", value: 4 }],
  },
  {
    id: "blade",
    name: "Chibi Blade",
    slot: "weapon",
    weaponStyle: "oneHand",
    implicits: [{ id: "flatDamage", value: 6 }],
  },
  {
    id: "polearm",
    name: "Green Dragon Polearm",
    slot: "weapon",
    weaponStyle: "twoHand",
    implicits: [
      { id: "flatDamage", value: 14 },
      { id: "cleaveRadius", value: 1 },
    ],
  },
  {
    id: "staff",
    name: "Strategist Staff",
    slot: "weapon",
    weaponStyle: "twoHand",
    implicits: [
      { id: "flatDamage", value: 10 },
      { id: "castSpeed", value: 0.08 },
      { id: "areaOfEffect", value: 1 },
    ],
  },
  {
    id: "helmet",
    name: "Officer Helm",
    slot: "helmet",
    implicits: [{ id: "maxHp", value: 12 }],
  },
  {
    id: "body",
    name: "Lamellar Coat",
    slot: "body",
    implicits: [{ id: "armour", value: 8 }],
  },
  {
    id: "gloves",
    name: "War Gloves",
    slot: "gloves",
    implicits: [{ id: "attackSpeed", value: 0.04 }],
  },
  {
    id: "belt",
    name: "Sash",
    slot: "belt",
    implicits: [{ id: "maxHp", value: 8 }],
  },
  {
    id: "boots",
    name: "Marching Boots",
    slot: "boots",
    implicits: [{ id: "goldFind", value: 0.05 }],
  },
  {
    id: "ring",
    name: "Jade Ring",
    slot: "ring",
    implicits: [{ id: "critChance", value: 0.02 }],
  },
  {
    id: "amulet",
    name: "Tiger Amulet",
    slot: "amulet",
    implicits: [{ id: "increasedDamage", value: 0.06 }],
  },
];

export const MODIFIER_POOL: Array<{ id: StatId; min: number; max: number }> = [
  { id: "flatDamage", min: 2, max: 8 },
  { id: "increasedDamage", min: 0.06, max: 0.18 },
  { id: "attackSpeed", min: 0.04, max: 0.12 },
  { id: "castSpeed", min: 0.04, max: 0.12 },
  { id: "critChance", min: 0.02, max: 0.08 },
  { id: "critMultiplier", min: 0.1, max: 0.35 },
  { id: "areaOfEffect", min: 0.5, max: 1 },
  { id: "attackRange", min: 0.5, max: 1 },
  { id: "skillDamage", min: 0.06, max: 0.16 },
  { id: "bossDamage", min: 0.08, max: 0.22 },
  { id: "maxHp", min: 6, max: 20 },
  { id: "armour", min: 4, max: 14 },
  { id: "itemFind", min: 0.05, max: 0.15 },
  { id: "goldFind", min: 0.05, max: 0.2 },
];

export interface GemLevelDef {
  primary: Modifier;
  extras: Modifier[];
}

/** Primary identity stays; extras unlock at milestones. */
export const GEM_PROGRESSION: Record<GemFamily, GemLevelDef[]> = {
  attackSpeed: [
    { primary: { id: "attackSpeed", value: 0.05 }, extras: [] },
    { primary: { id: "attackSpeed", value: 0.08 }, extras: [] },
    { primary: { id: "attackSpeed", value: 0.12 }, extras: [{ id: "critChance", value: 0.03 }] },
    { primary: { id: "attackSpeed", value: 0.16 }, extras: [{ id: "critChance", value: 0.05 }, { id: "critMultiplier", value: 0.1 }] },
    { primary: { id: "attackSpeed", value: 0.22 }, extras: [{ id: "critChance", value: 0.08 }, { id: "critMultiplier", value: 0.15 }, { id: "moreDamage", value: 0.1 }] },
  ],
  castSpeed: [
    { primary: { id: "castSpeed", value: 0.05 }, extras: [] },
    { primary: { id: "castSpeed", value: 0.08 }, extras: [] },
    { primary: { id: "castSpeed", value: 0.12 }, extras: [{ id: "areaOfEffect", value: 1 }] },
    { primary: { id: "castSpeed", value: 0.16 }, extras: [{ id: "areaOfEffect", value: 1 }, { id: "skillDamage", value: 0.08 }] },
    { primary: { id: "castSpeed", value: 0.22 }, extras: [{ id: "areaOfEffect", value: 2 }, { id: "skillDamage", value: 0.12 }, { id: "moreDamage", value: 0.1 }] },
  ],
  critRate: [
    { primary: { id: "critChance", value: 0.05 }, extras: [] },
    { primary: { id: "critChance", value: 0.08 }, extras: [] },
    { primary: { id: "critChance", value: 0.11 }, extras: [{ id: "critMultiplier", value: 0.08 }] },
    { primary: { id: "critChance", value: 0.14 }, extras: [{ id: "critMultiplier", value: 0.12 }, { id: "attackSpeed", value: 0.04 }] },
    { primary: { id: "critChance", value: 0.18 }, extras: [{ id: "critMultiplier", value: 0.18 }, { id: "attackSpeed", value: 0.06 }, { id: "moreDamage", value: 0.08 }] },
  ],
  critMulti: [
    { primary: { id: "critMultiplier", value: 0.2 }, extras: [] },
    { primary: { id: "critMultiplier", value: 0.28 }, extras: [] },
    { primary: { id: "critMultiplier", value: 0.36 }, extras: [{ id: "critChance", value: 0.03 }] },
    { primary: { id: "critMultiplier", value: 0.45 }, extras: [{ id: "critChance", value: 0.05 }, { id: "bossDamage", value: 0.08 }] },
    { primary: { id: "critMultiplier", value: 0.55 }, extras: [{ id: "critChance", value: 0.07 }, { id: "bossDamage", value: 0.12 }, { id: "moreDamage", value: 0.08 }] },
  ],
  moreDamage: [
    { primary: { id: "moreDamage", value: 0.1 }, extras: [] },
    { primary: { id: "moreDamage", value: 0.14 }, extras: [] },
    { primary: { id: "moreDamage", value: 0.18 }, extras: [{ id: "flatDamage", value: 3 }] },
    { primary: { id: "moreDamage", value: 0.22 }, extras: [{ id: "flatDamage", value: 5 }, { id: "bossDamage", value: 0.08 }] },
    { primary: { id: "moreDamage", value: 0.28 }, extras: [{ id: "flatDamage", value: 7 }, { id: "bossDamage", value: 0.12 }, { id: "increasedDamage", value: 0.08 }] },
  ],
  fire: [
    { primary: { id: "addedFire", value: 4 }, extras: [{ id: "igniteChance", value: 0.2 }] },
    { primary: { id: "addedFire", value: 6 }, extras: [{ id: "igniteChance", value: 0.28 }] },
    { primary: { id: "addedFire", value: 9 }, extras: [{ id: "igniteChance", value: 0.35 }, { id: "increasedDamage", value: 0.05 }] },
    { primary: { id: "addedFire", value: 12 }, extras: [{ id: "igniteChance", value: 0.42 }, { id: "increasedDamage", value: 0.08 }] },
    { primary: { id: "addedFire", value: 16 }, extras: [{ id: "igniteChance", value: 0.5 }, { id: "increasedDamage", value: 0.12 }, { id: "moreDamage", value: 0.08 }] },
  ],
  cold: [
    { primary: { id: "addedCold", value: 4 }, extras: [{ id: "chillChance", value: 0.25 }] },
    { primary: { id: "addedCold", value: 6 }, extras: [{ id: "chillChance", value: 0.32 }, { id: "freezeChance", value: 0.05 }] },
    { primary: { id: "addedCold", value: 8 }, extras: [{ id: "chillChance", value: 0.4 }, { id: "freezeChance", value: 0.08 }] },
    { primary: { id: "addedCold", value: 11 }, extras: [{ id: "chillChance", value: 0.48 }, { id: "freezeChance", value: 0.12 }] },
    { primary: { id: "addedCold", value: 14 }, extras: [{ id: "chillChance", value: 0.55 }, { id: "freezeChance", value: 0.16 }, { id: "moreDamage", value: 0.08 }] },
  ],
  lightning: [
    { primary: { id: "addedLightning", value: 4 }, extras: [{ id: "shockChance", value: 0.2 }, { id: "chainChance", value: 0.25 }] },
    { primary: { id: "addedLightning", value: 6 }, extras: [{ id: "shockChance", value: 0.28 }, { id: "chainChance", value: 0.35 }] },
    { primary: { id: "addedLightning", value: 9 }, extras: [{ id: "shockChance", value: 0.35 }, { id: "chainChance", value: 0.45 }] },
    { primary: { id: "addedLightning", value: 12 }, extras: [{ id: "shockChance", value: 0.42 }, { id: "chainChance", value: 0.55 }] },
    { primary: { id: "addedLightning", value: 16 }, extras: [{ id: "shockChance", value: 0.5 }, { id: "chainChance", value: 0.7 }, { id: "moreDamage", value: 0.08 }] },
  ],
  toxic: [
    { primary: { id: "addedToxic", value: 3 }, extras: [{ id: "poisonChance", value: 0.3 }] },
    { primary: { id: "addedToxic", value: 5 }, extras: [{ id: "poisonChance", value: 0.4 }] },
    { primary: { id: "addedToxic", value: 7 }, extras: [{ id: "poisonChance", value: 0.5 }, { id: "increasedDamage", value: 0.04 }] },
    { primary: { id: "addedToxic", value: 10 }, extras: [{ id: "poisonChance", value: 0.6 }, { id: "increasedDamage", value: 0.07 }] },
    { primary: { id: "addedToxic", value: 13 }, extras: [{ id: "poisonChance", value: 0.7 }, { id: "increasedDamage", value: 0.1 }, { id: "moreDamage", value: 0.08 }] },
  ],
  bleed: [
    { primary: { id: "addedBleed", value: 3 }, extras: [{ id: "bleedChance", value: 0.3 }] },
    { primary: { id: "addedBleed", value: 5 }, extras: [{ id: "bleedChance", value: 0.4 }] },
    { primary: { id: "addedBleed", value: 7 }, extras: [{ id: "bleedChance", value: 0.5 }, { id: "attackSpeed", value: 0.04 }] },
    { primary: { id: "addedBleed", value: 10 }, extras: [{ id: "bleedChance", value: 0.6 }, { id: "attackSpeed", value: 0.06 }] },
    { primary: { id: "addedBleed", value: 13 }, extras: [{ id: "bleedChance", value: 0.7 }, { id: "attackSpeed", value: 0.08 }, { id: "moreDamage", value: 0.08 }] },
  ],
};

export const GEM_NAMES: Record<GemFamily, string> = {
  attackSpeed: "Attack Speed Gem",
  castSpeed: "Cast Speed Gem",
  critRate: "Critical Rate Gem",
  critMulti: "Critical Multiplier Gem",
  moreDamage: "More Damage Gem",
  fire: "Fire Imbued Gem",
  cold: "Cold Imbued Gem",
  lightning: "Lightning Imbued Gem",
  toxic: "Toxic Imbued Gem",
  bleed: "Bleed Imbued Gem",
};

export const GEM_FAMILIES = Object.keys(GEM_NAMES) as GemFamily[];

export { MAPS, MVP_MAP, mapById } from "./map/maps.js";

export function heroDef(id: string): HeroDef {
  const found = HERO_DEFS.find((h) => h.id === id);
  if (!found) throw new Error(`Unknown hero ${id}`);
  return found;
}

export function itemBase(id: string): ItemBase {
  const found = ITEM_BASES.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown item base ${id}`);
  return found;
}

export function nextRarity(rarity: Rarity): Rarity | null {
  const i = RARITY_ORDER.indexOf(rarity);
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1]! : null;
}

export function basesForSlot(slot: EquipSlot): ItemBase[] {
  return ITEM_BASES.filter((b) => b.slot === slot);
}
