export type HeroArchetype = "speed" | "damager" | "mage";
export type EnemyType = "troop" | "scout" | "brute" | "elite" | "boss";
export type DamageType = "physical" | "fire" | "cold" | "lightning" | "toxic" | "bleed";
/** Elemental damage from an imbued gem. Order matches the gem list in goals.md. */
export type ImbuedElement = "lightning" | "cold" | "fire" | "toxic" | "bleed";
export type WeaponStyle = "oneHand" | "twoHand";

export type EquipSlot =
  | "helmet"
  | "body"
  | "gloves"
  | "belt"
  | "boots"
  | "ring"
  | "amulet"
  | "weapon";

export type WornSlot =
  | "helmet"
  | "body"
  | "gloves"
  | "belt"
  | "boots"
  | "ring1"
  | "ring2"
  | "amulet"
  | "mainHand"
  | "offHand";

export type Rarity = "normal" | "magic" | "rare" | "unique" | "legendary" | "mythic";

export type GemFamily =
  | "attackSpeed"
  | "castSpeed"
  | "critRate"
  | "critMulti"
  | "moreDamage"
  | "fire"
  | "cold"
  | "lightning"
  | "toxic"
  | "bleed";

export type EliteModifier =
  | "armoured"
  | "fast"
  | "regenerating"
  | "fireResistant"
  | "coldResistant"
  | "lightningResistant"
  | "toxicResistant"
  | "criticalResistant";

export type StatusKind = "chill" | "freeze" | "shock" | "slow";
export type DotKind = "ignite" | "burn" | "poison" | "bleed";

export type StatId =
  | "flatDamage"
  | "increasedDamage"
  | "attackSpeed"
  | "castSpeed"
  | "critChance"
  | "critMultiplier"
  | "areaOfEffect"
  | "attackRange"
  | "skillDamage"
  | "bossDamage"
  | "maxHp"
  | "armour"
  | "damageReduction"
  | "regeneration"
  | "fireResist"
  | "coldResist"
  | "lightningResist"
  | "toxicResist"
  | "energyGeneration"
  | "cooldownRecovery"
  | "itemFind"
  | "goldFind"
  | "addedFire"
  | "addedCold"
  | "addedLightning"
  | "addedToxic"
  | "addedBleed"
  | "moreDamage"
  | "cleaveRadius"
  | "igniteChance"
  | "chillChance"
  | "freezeChance"
  | "shockChance"
  | "chainChance"
  | "poisonChance"
  | "bleedChance";

export interface Modifier {
  id: StatId;
  value: number;
}

export interface ItemBase {
  id: string;
  name: string;
  slot: EquipSlot;
  weaponStyle?: WeaponStyle;
  implicits: Modifier[];
}

export interface Item {
  id: string;
  baseId: string;
  name: string;
  slot: EquipSlot;
  weaponStyle?: WeaponStyle;
  rarity: Rarity;
  modifiers: Modifier[];
}

export interface Gem {
  id: string;
  family: GemFamily;
  name: string;
  level: number;
  modifiers: Modifier[];
}

export interface HeroDef {
  id: string;
  name: string;
  archetype: HeroArchetype;
  rarity: Rarity;
  baseDamage: number;
  attackSpeed: number;
  castSpeed: number;
  range: number;
  critChance: number;
  critMultiplier: number;
  cleaveRadius: number;
  aoeRadius: number;
  gemSockets: number;
}

export interface HeroInstance {
  id: string;
  defId: string;
  /** Socket count follows this rarity. Testing heroes start at mythic. */
  rarity: Rarity;
  favorite: boolean;
  equipment: Partial<Record<WornSlot, Item>>;
  gems: Array<Gem | null>;
}

export interface CombatStats {
  maxHp: number;
  damage: number;
  attackSpeed: number;
  castSpeed: number;
  range: number;
  critChance: number;
  critMultiplier: number;
  cleaveRadius: number;
  aoeRadius: number;
  moreDamage: number;
  skillDamage: number;
  bossDamage: number;
  armour: number;
  damageReduction: number;
  regeneration: number;
  itemFind: number;
  goldFind: number;
  added: Record<DamageType, number>;
  resist: Record<DamageType, number>;
  igniteChance: number;
  chillChance: number;
  freezeChance: number;
  shockChance: number;
  chainChance: number;
  poisonChance: number;
  bleedChance: number;
}

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  leakDamage: number;
  resist: Partial<Record<DamageType, number>>;
  critResist: number;
  regen: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Route {
  id: string;
  waypoints: Vec2[];
}

/** One walk from a gate to a castle, baked when the map module loads. */
export interface BakedPath {
  id: string;
  entryId: string;
  destinationId: string;
  waypoints: Vec2[];
}

export interface DeploySlot {
  id: string;
  x: number;
  y: number;
}

export interface WaveSpawn {
  type: EnemyType;
  count: number;
  eliteModifiers?: EliteModifier[];
}

export interface WaveDef {
  wave: number;
  delay: number;
  spawnInterval: number;
  packs: WaveSpawn[];
}

export interface MapDef {
  id: string;
  name: string;
  castleHp: number;
  /** Same walks as `paths`, kept so movement can follow a waypoint list. */
  routes: Route[];
  /**
   * Every gate-to-castle walk on this road. Built once from the fixed road
   * graph. A fight only picks an index; it does not search tiles.
   */
  paths: BakedPath[];
  slots: DeploySlot[];
  waves: WaveDef[];
  /** Grass tint. The road stays dirt. */
  ground?: "grass" | "snow" | "sand";
}

export interface LootDrop {
  gold: number;
  items: Item[];
  gems: Gem[];
  fragments: Record<string, number>;
  /** Energy battery gained from clearing the pass. */
  energy: number;
}

export interface BattleDeployment {
  hero: HeroInstance;
  slotId: string;
}

export type BattleEvent =
  | { type: "waveStart"; wave: number }
  | { type: "spawn"; enemyId: string; enemyType: EnemyType; routeId: string }
  | { type: "attack"; heroId: string; targetIds: string[]; damage: number; crit: boolean }
  | {
      type: "hit";
      heroId: string;
      enemyId: string;
      damage: number;
      crit: boolean;
      x: number;
      y: number;
      /** Imbued gems that added damage to this hit. */
      elements: ImbuedElement[];
    }
  | {
      type: "dot";
      enemyId: string;
      kind: DotKind;
      damage: number;
      x: number;
      y: number;
      element: ImbuedElement;
    }
  | { type: "status"; enemyId: string; kind: StatusKind }
  | { type: "phase"; enemyId: string; phase: number }
  | { type: "death"; enemyId: string; enemyType: EnemyType }
  | { type: "leak"; enemyId: string; enemyType: EnemyType; castleDamage: number }
  | { type: "waveCleared"; wave: number }
  | { type: "end"; victory: boolean; reason: "cleared" | "castleDestroyed" | "escaped" | "bossReached" };

export interface BattleResult {
  victory: boolean;
  time: number;
  castleHp: number;
  castleMaxHp: number;
  kills: Record<EnemyType, number>;
  leaks: number;
  loot: LootDrop;
  damageByHero: Record<string, number>;
  events: BattleEvent[];
}

export interface PlayerState {
  gold: number;
  /** Spend 1 to start each wave. Capped at ENERGY.max. */
  energy: number;
  heroes: HeroInstance[];
  inventory: Item[];
  gems: Gem[];
  fragments: Record<string, number>;
}
