import type { Rng } from "./rng.js";
import type {
  CombatStats,
  DamageType,
  DotKind,
  EliteModifier,
  EnemyType,
  ImbuedElement,
  StatusKind,
} from "./types.js";

export interface StatusInstance {
  kind: StatusKind;
  remaining: number;
  magnitude: number;
}

export interface DotInstance {
  kind: DotKind;
  remaining: number;
  dps: number;
  sourceHeroId: string;
}

export interface CombatEnemy {
  id: string;
  type: EnemyType;
  name: string;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  leakDamage: number;
  resist: Record<DamageType, number>;
  critResist: number;
  regen: number;
  routeIndex: number;
  waypointIndex: number;
  waypointT: number;
  x: number;
  y: number;
  pathDist: number;
  statuses: StatusInstance[];
  dots: DotInstance[];
  alive: boolean;
  reached: boolean;
  phase: number;
}

export interface HitResult {
  damage: number;
  crit: boolean;
  targetIds: string[];
}

const ZERO_RESIST: Record<DamageType, number> = {
  physical: 0,
  fire: 0,
  cold: 0,
  lightning: 0,
  toxic: 0,
  bleed: 0,
};

export function applyEliteModifiers(enemy: CombatEnemy, mods: EliteModifier[]): void {
  for (const mod of mods) {
    switch (mod) {
      case "armoured":
        enemy.resist.physical += 0.25;
        enemy.name = `Armoured ${enemy.name}`;
        break;
      case "fast":
        enemy.baseSpeed *= 1.35;
        enemy.name = `Fast ${enemy.name}`;
        break;
      case "regenerating":
        enemy.regen += 4;
        enemy.name = `Regenerating ${enemy.name}`;
        break;
      case "fireResistant":
        enemy.resist.fire += 0.5;
        break;
      case "coldResistant":
        enemy.resist.cold += 0.5;
        break;
      case "lightningResistant":
        enemy.resist.lightning += 0.5;
        break;
      case "toxicResistant":
        enemy.resist.toxic += 0.5;
        break;
      case "criticalResistant":
        enemy.critResist += 0.4;
        enemy.name = `Hardened ${enemy.name}`;
        break;
    }
  }
}

export function currentSpeed(enemy: CombatEnemy): number {
  if (!enemy.alive || enemy.reached) return 0;
  if (enemy.statuses.some((s) => s.kind === "freeze" && s.remaining > 0)) return 0;
  let speed = enemy.baseSpeed;
  for (const s of enemy.statuses) {
    if ((s.kind === "chill" || s.kind === "slow") && s.remaining > 0) {
      speed *= 1 - s.magnitude;
    }
  }
  if (enemy.type === "boss" && enemy.phase >= 2) speed *= 1.25;
  return Math.max(4, speed);
}

export function isMoving(enemy: CombatEnemy): boolean {
  return currentSpeed(enemy) > 0;
}

function resistFactor(enemy: CombatEnemy, type: DamageType): number {
  return Math.max(0.15, 1 - (enemy.resist[type] ?? 0));
}

function shockAmp(enemy: CombatEnemy): number {
  return enemy.statuses.some((s) => s.kind === "shock" && s.remaining > 0) ? 1.2 : 1;
}

export function hitDamage(
  rng: Rng,
  stats: CombatStats,
  enemy: CombatEnemy,
  skill = false,
): { damage: number; crit: boolean } {
  let amount = stats.damage;
  if (skill) amount *= 1 + stats.skillDamage;
  if (enemy.type === "boss") amount *= 1 + stats.bossDamage;

  amount *= resistFactor(enemy, "physical");
  for (const type of ["fire", "cold", "lightning", "toxic", "bleed"] as DamageType[]) {
    if (stats.added[type] > 0) {
      amount += stats.added[type] * resistFactor(enemy, type);
    }
  }

  const critChance = Math.max(0, stats.critChance * (1 - enemy.critResist));
  const crit = rng.chance(critChance);
  if (crit) amount *= stats.critMultiplier;

  amount *= shockAmp(enemy);
  return { damage: Math.max(1, amount), crit };
}

export function applyDamage(enemy: CombatEnemy, amount: number): number {
  if (!enemy.alive) return 0;
  const dealt = Math.min(enemy.hp, amount);
  enemy.hp -= dealt;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
  }
  if (enemy.type === "boss" && enemy.phase < 2 && enemy.hp <= enemy.maxHp * 0.5) {
    enemy.phase = 2;
    enemy.regen += 3;
    enemy.resist = {
      ...enemy.resist,
      physical: enemy.resist.physical + 0.1,
    };
  }
  return dealt;
}

function addStatus(enemy: CombatEnemy, kind: StatusKind, duration: number, magnitude: number): void {
  const existing = enemy.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, duration);
    existing.magnitude = Math.max(existing.magnitude, magnitude);
    return;
  }
  enemy.statuses.push({ kind, remaining: duration, magnitude });
}

function addDot(
  enemy: CombatEnemy,
  kind: DotKind,
  duration: number,
  dps: number,
  sourceHeroId: string,
): void {
  if (kind === "bleed" || kind === "poison") {
    enemy.dots.push({ kind, remaining: duration, dps, sourceHeroId });
    return;
  }
  const existing = enemy.dots.find((d) => d.kind === kind && d.sourceHeroId === sourceHeroId);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, duration);
    existing.dps = Math.max(existing.dps, dps);
    return;
  }
  enemy.dots.push({ kind, remaining: duration, dps, sourceHeroId });
}

export function applyOnHit(
  rng: Rng,
  stats: CombatStats,
  enemy: CombatEnemy,
  sourceHeroId: string,
): StatusKind[] {
  const applied: StatusKind[] = [];
  if (stats.igniteChance > 0 && rng.chance(stats.igniteChance)) {
    addDot(enemy, "ignite", 3, 6 + stats.added.fire * 0.4, sourceHeroId);
  }
  if (stats.added.fire > 8 && rng.chance(0.15)) {
    addDot(enemy, "burn", 2, 4 + stats.added.fire * 0.2, sourceHeroId);
  }
  if (stats.chillChance > 0 && rng.chance(stats.chillChance)) {
    addStatus(enemy, "chill", 2.5, 0.3);
    applied.push("chill");
  }
  if (stats.freezeChance > 0 && rng.chance(stats.freezeChance)) {
    addStatus(enemy, "freeze", 1.2, 1);
    applied.push("freeze");
  }
  if (stats.shockChance > 0 && rng.chance(stats.shockChance)) {
    addStatus(enemy, "shock", 3, 0.2);
    applied.push("shock");
  }
  if (stats.poisonChance > 0 && rng.chance(stats.poisonChance)) {
    addDot(enemy, "poison", 4, 5 + stats.added.toxic * 0.5, sourceHeroId);
  }
  if (stats.bleedChance > 0 && rng.chance(stats.bleedChance)) {
    addDot(enemy, "bleed", 3.5, 4 + stats.added.bleed * 0.5, sourceHeroId);
  }
  return applied;
}

export function tickDots(
  enemy: CombatEnemy,
  dt: number,
  onDot?: (kind: DotKind, damage: number, sourceHeroId: string) => void,
): number {
  let total = 0;
  for (const dot of enemy.dots) {
    if (!enemy.alive) break;
    let dps = dot.dps;
    if (dot.kind === "bleed" && isMoving(enemy)) dps *= 1.5;
    const dmg = dps * dt * resistFactor(enemy, dotType(dot.kind)) * shockAmp(enemy);
    const dealt = applyDamage(enemy, dmg);
    total += dealt;
    if (dealt > 0) onDot?.(dot.kind, dealt, dot.sourceHeroId);
    dot.remaining -= dt;
  }
  enemy.dots = enemy.dots.filter((d) => d.remaining > 0);
  return total;
}

export function tickStatuses(enemy: CombatEnemy, dt: number): void {
  for (const s of enemy.statuses) s.remaining -= dt;
  enemy.statuses = enemy.statuses.filter((s) => s.remaining > 0);
}

export function tickRegen(enemy: CombatEnemy, dt: number): void {
  if (!enemy.alive || enemy.regen <= 0) return;
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen * dt);
}

function dotType(kind: DotKind): DamageType {
  return dotElement(kind);
}

export const IMBUED_ELEMENTS: ImbuedElement[] = ["lightning", "cold", "fire", "toxic", "bleed"];

/** Imbued gems currently adding damage on this hero. */
export function imbuedElements(stats: CombatStats): ImbuedElement[] {
  return IMBUED_ELEMENTS.filter((element) => stats.added[element] > 0);
}

export function dotElement(kind: DotKind): ImbuedElement {
  if (kind === "poison") return "toxic";
  if (kind === "bleed") return "bleed";
  return "fire";
}

export function blankResist(partial: Partial<Record<DamageType, number>>): Record<DamageType, number> {
  return { ...ZERO_RESIST, ...partial };
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}
