import {
  applyDamage,
  applyEliteModifiers,
  applyOnHit,
  blankResist,
  currentSpeed,
  dist,
  dotElement,
  hitDamage,
  imbuedElements,
  tickDots,
  tickRegen,
  tickStatuses,
  type CombatEnemy,
} from "./combat.js";
import { ENERGY, ENEMY_DEFS, heroDef } from "./data.js";
import { chebyshevTiles, playMap } from "./map/tiles.js";
import { emptyLoot, mergeLoot, rollKillLoot, rollPassBattery } from "./loot.js";
import { createId, Rng } from "./rng.js";
import { computeHeroStats, partyGoldFind, partyItemFind } from "./stats.js";
import type {
  BattleDeployment,
  BattleEvent,
  BattleResult,
  CombatStats,
  EliteModifier,
  EnemyType,
  HeroInstance,
  LootDrop,
  MapDef,
  PlayerState,
} from "./types.js";

export const TICK = 0.05;
const MAX_TIME = 480;

export interface BattleHero {
  instance: HeroInstance;
  stats: CombatStats;
  x: number;
  y: number;
  cooldown: number;
  damageDealt: number;
}

function routeLength(waypoints: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    len += dist(waypoints[i - 1]!.x, waypoints[i - 1]!.y, waypoints[i]!.x, waypoints[i]!.y);
  }
  return len;
}

/** Walk the route polyline from the first waypoint to the last. There is no grid search. */
function advanceAlongRoute(enemy: CombatEnemy, map: MapDef, dt: number): void {
  const route = map.routes[enemy.routeIndex]!;
  const speed = currentSpeed(enemy);
  let remaining = speed * dt;
  while (remaining > 0 && enemy.waypointIndex < route.waypoints.length - 1) {
    const a = route.waypoints[enemy.waypointIndex]!;
    const b = route.waypoints[enemy.waypointIndex + 1]!;
    const seg = dist(a.x, a.y, b.x, b.y);
    const left = (1 - enemy.waypointT) * seg;
    if (remaining >= left) {
      remaining -= left;
      enemy.waypointIndex += 1;
      enemy.waypointT = 0;
      enemy.x = b.x;
      enemy.y = b.y;
    } else {
      enemy.waypointT += remaining / seg;
      remaining = 0;
      enemy.x = a.x + (b.x - a.x) * enemy.waypointT;
      enemy.y = a.y + (b.y - a.y) * enemy.waypointT;
    }
  }
  enemy.pathDist = traveled(enemy, map);
  if (enemy.waypointIndex >= route.waypoints.length - 1) {
    enemy.reached = true;
  }
}

function traveled(enemy: CombatEnemy, map: MapDef): number {
  const route = map.routes[enemy.routeIndex]!;
  let d = 0;
  for (let i = 1; i <= enemy.waypointIndex; i++) {
    d += dist(route.waypoints[i - 1]!.x, route.waypoints[i - 1]!.y, route.waypoints[i]!.x, route.waypoints[i]!.y);
  }
  if (enemy.waypointIndex < route.waypoints.length - 1) {
    const a = route.waypoints[enemy.waypointIndex]!;
    const b = route.waypoints[enemy.waypointIndex + 1]!;
    d += dist(a.x, a.y, b.x, b.y) * enemy.waypointT;
  }
  return d;
}

/**
 * Gates take turns. When that gate's baked walks end at two or more castles,
 * one destination is chosen at random and the stored waypoint list is used.
 * No tile search happens here.
 */
export function choosePathIndex(map: MapDef, rng: Rng, spawnOrdinal: number): number {
  const paths = map.paths;
  if (!paths.length) return spawnOrdinal % map.routes.length;
  const entryIds: string[] = [];
  for (const path of paths) {
    if (!entryIds.includes(path.entryId)) entryIds.push(path.entryId);
  }
  const entryId = entryIds[spawnOrdinal % entryIds.length]!;
  const indexes = paths.map((_, index) => index).filter((index) => paths[index]!.entryId === entryId);
  const dests: string[] = [];
  for (const index of indexes) {
    const dest = paths[index]!.destinationId;
    if (!dests.includes(dest)) dests.push(dest);
  }
  if (dests.length < 2) return indexes[0]!;
  const destId = rng.pick(dests);
  const toDest = indexes.filter((index) => paths[index]!.destinationId === destId);
  return toDest.length === 1 ? toDest[0]! : rng.pick(toDest);
}

function spawnEnemy(
  type: EnemyType,
  routeIndex: number,
  map: MapDef,
  eliteMods: CombatEnemy extends never ? never : import("./types.js").EliteModifier[] = [],
): CombatEnemy {
  const def = ENEMY_DEFS[type]!;
  const start = map.routes[routeIndex]!.waypoints[0]!;
  const enemy: CombatEnemy = {
    id: createId("enemy"),
    type: def.type,
    name: def.name,
    hp: def.hp,
    maxHp: def.hp,
    baseSpeed: def.speed,
    leakDamage: def.leakDamage,
    resist: blankResist(def.resist),
    critResist: def.critResist,
    regen: def.regen,
    routeIndex,
    waypointIndex: 0,
    waypointT: 0,
    x: start.x,
    y: start.y,
    pathDist: 0,
    statuses: [],
    dots: [],
    alive: true,
    reached: false,
    phase: 1,
  };
  if (type === "elite") applyEliteModifiers(enemy, eliteMods);
  return enemy;
}

function enemiesInRange(heroesPos: { x: number; y: number }, range: number, enemies: CombatEnemy[]): CombatEnemy[] {
  return enemies.filter(
    (e) => e.alive && !e.reached && chebyshevTiles(heroesPos.x, heroesPos.y, e.x, e.y) <= range,
  );
}

function primaryTarget(candidates: CombatEnemy[]): CombatEnemy | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, e) => (e.pathDist > best.pathDist ? e : best));
}

function fireRate(hero: BattleHero): number {
  const def = heroDef(hero.instance.defId);
  return def.archetype === "mage" ? hero.stats.castSpeed : hero.stats.attackSpeed;
}

function collectTargets(hero: BattleHero, primary: CombatEnemy, living: CombatEnemy[]): CombatEnemy[] {
  const def = heroDef(hero.instance.defId);
  const targets = new Map<string, CombatEnemy>();
  targets.set(primary.id, primary);

  if (def.archetype === "damager" && hero.stats.cleaveRadius > 0) {
    for (const e of living) {
      if (chebyshevTiles(primary.x, primary.y, e.x, e.y) <= hero.stats.cleaveRadius) {
        targets.set(e.id, e);
      }
    }
  }

  if (def.archetype === "mage" && hero.stats.aoeRadius > 0) {
    for (const e of living) {
      if (chebyshevTiles(primary.x, primary.y, e.x, e.y) <= hero.stats.aoeRadius) {
        targets.set(e.id, e);
      }
    }
  }

  return [...targets.values()];
}

function maybeChain(
  rng: Rng,
  stats: CombatStats,
  already: CombatEnemy[],
  living: CombatEnemy[],
): CombatEnemy[] {
  if (stats.chainChance <= 0 || !rng.chance(stats.chainChance)) return already;
  const extra: CombatEnemy[] = [];
  let from = already[already.length - 1]!;
  const used = new Set(already.map((e) => e.id));
  for (let hop = 0; hop < 2; hop++) {
    const next = living
      .filter((e) => !used.has(e.id) && chebyshevTiles(from.x, from.y, e.x, e.y) <= 2)
      .sort((a, b) => dist(from.x, from.y, a.x, a.y) - dist(from.x, from.y, b.x, b.y))[0];
    if (!next) break;
    extra.push(next);
    used.add(next.id);
    from = next;
  }
  return extra;
}

export class BattleRuntime {
  readonly map: MapDef;
  readonly heroes: BattleHero[];
  readonly enemies: CombatEnemy[] = [];
  castleHp: number;
  time = 0;
  wave = 0;
  finished = false;
  result: BattleResult | null = null;
  paused = false;
  waitingForNextWave = false;
  autoNextWave: boolean;

  private readonly rng: Rng;
  /** Path picks stay off the loot rng so a map with one castle does not change drops. */
  private readonly pathRng: Rng;
  private readonly account?: PlayerState;
  private readonly recordAll: boolean;
  private itemFind = 0;
  private goldFind = 0;
  private readonly events: BattleEvent[] = [];
  private readonly loot: LootDrop = emptyLoot();
  private freshLoot: LootDrop = emptyLoot();
  private readonly kills: Record<EnemyType, number> = {
    troop: 0,
    scout: 0,
    brute: 0,
    elite: 0,
    boss: 0,
  };
  private leaks = 0;
  private waveIndex = 0;
  private waveCountdown: number;
  private pending: Array<{ type: EnemyType; eliteMods: EliteModifier[] }> = [];
  private spawnWait = 0;
  private spawnInterval = 0.5;
  private allWavesQueued = false;
  private acc = 0;
  private lastClearedWave = 0;

  constructor(
    deployments: BattleDeployment[],
    options: {
      seed?: number;
      map?: MapDef;
      recordAllEvents?: boolean;
      autoNextWave?: boolean;
      account?: PlayerState;
    } = {},
  ) {
    this.map = options.map ?? playMap();
    this.rng = new Rng(options.seed ?? 1);
    this.pathRng = new Rng((options.seed ?? 1) + 0x51ed);
    this.account = options.account;
    this.recordAll = options.recordAllEvents ?? false;
    this.autoNextWave = options.autoNextWave ?? true;
    this.castleHp = this.map.castleHp;
    this.waveCountdown = this.map.waves[0]?.delay ?? 0;
    this.heroes = deployments.map((d) => {
      const slot = this.map.slots.find((s) => s.id === d.slotId);
      if (!slot) throw new Error(`Unknown slot ${d.slotId}`);
      return {
        instance: d.hero,
        stats: computeHeroStats(d.hero),
        x: slot.x,
        y: slot.y,
        cooldown: 0,
        damageDealt: 0,
      };
    });
    this.recalcFind();
  }

  setAutoNext(on: boolean): void {
    this.autoNextWave = on;
    if (on && this.waitingForNextWave) this.startNextWave();
  }

  startNextWave(): void {
    if (this.finished || this.allWavesQueued) return;
    this.paused = false;
    this.waitingForNextWave = false;
    this.waveCountdown = 0;
  }

  canAffordNextWave(): boolean {
    return !this.account || this.account.energy >= ENERGY.perWave;
  }

  private spendWaveEnergy(): boolean {
    if (!this.account) return true;
    if (this.account.energy < ENERGY.perWave) return false;
    this.account.energy -= ENERGY.perWave;
    return true;
  }

  removeHero(heroId: string): void {
    const index = this.heroes.findIndex((hero) => hero.instance.id === heroId);
    if (index < 0) return;
    this.heroes.splice(index, 1);
    this.recalcFind();
  }

  moveHero(heroId: string, slotId: string, hero?: HeroInstance): void {
    const slot = this.map.slots.find((s) => s.id === slotId);
    if (!slot) throw new Error(`Unknown slot ${slotId}`);
    const existing = this.heroes.find((h) => h.instance.id === heroId);
    if (existing) {
      existing.x = slot.x;
      existing.y = slot.y;
      existing.stats = computeHeroStats(existing.instance);
      return;
    }
    if (!hero) return;
    this.heroes.push({
      instance: hero,
      stats: computeHeroStats(hero),
      x: slot.x,
      y: slot.y,
      cooldown: 0,
      damageDealt: 0,
    });
    this.recalcFind();
  }

  refreshHeroStats(): void {
    for (const hero of this.heroes) hero.stats = computeHeroStats(hero.instance);
    this.recalcFind();
  }

  takeLoot(): LootDrop {
    const taken = this.freshLoot;
    this.freshLoot = emptyLoot();
    return taken;
  }

  private recalcFind(): void {
    const heroes = this.heroes.map((h) => h.instance);
    this.itemFind = partyItemFind(heroes);
    this.goldFind = partyGoldFind(heroes);
  }

  living(): CombatEnemy[] {
    return this.enemies.filter((e) => e.alive && !e.reached);
  }

  step(dt: number): BattleEvent[] {
    const emitted: BattleEvent[] = [];
    if (this.finished || this.paused || this.waitingForNextWave) return emitted;
    this.acc += dt;
    while (this.acc >= TICK && !this.finished && !this.paused && !this.waitingForNextWave) {
      this.acc -= TICK;
      emitted.push(...this.tick());
    }
    return emitted;
  }

  private persist(event: BattleEvent): void {
    if (
      this.recordAll ||
      event.type === "waveStart" ||
      event.type === "waveCleared" ||
      event.type === "phase" ||
      event.type === "leak" ||
      event.type === "end" ||
      (event.type === "death" && event.enemyType === "boss")
    ) {
      this.events.push(event);
    }
  }

  private credit(heroId: string, amount: number): void {
    const hero = this.heroes.find((h) => h.instance.id === heroId);
    if (hero) hero.damageDealt += amount;
  }

  private killEnemy(enemy: CombatEnemy, stepEvents: BattleEvent[]): void {
    if (enemy.alive) return;
    this.kills[enemy.type] += 1;
    const drop = rollKillLoot(this.rng, enemy.type, this.itemFind, this.goldFind);
    mergeLoot(this.loot, drop);
    mergeLoot(this.freshLoot, drop);
    const event: BattleEvent = { type: "death", enemyId: enemy.id, enemyType: enemy.type };
    stepEvents.push(event);
    this.persist(event);
  }

  private tick(): BattleEvent[] {
    const map = this.map;
    const stepEvents: BattleEvent[] = [];
    const emit = (event: BattleEvent) => {
      stepEvents.push(event);
      this.persist(event);
    };

    if (
      this.pending.length === 0 &&
      this.living().length === 0 &&
      this.waveIndex < map.waves.length &&
      !this.waitingForNextWave
    ) {
      this.waveCountdown -= TICK;
      if (this.waveCountdown <= 0) {
        if (!this.spendWaveEnergy()) {
          this.waitingForNextWave = true;
          this.paused = true;
          return stepEvents;
        }
        const wave = map.waves[this.waveIndex]!;
        this.wave = wave.wave;
        emit({ type: "waveStart", wave: wave.wave });
        this.pending = flattenWave(wave);
        this.spawnInterval = wave.spawnInterval;
        this.spawnWait = 0;
        this.waveIndex += 1;
        if (this.waveIndex >= map.waves.length) this.allWavesQueued = true;
        else this.waveCountdown = map.waves[this.waveIndex]!.delay;
      }
    }

    if (this.pending.length > 0) {
      this.spawnWait -= TICK;
      if (this.spawnWait <= 0) {
        const next = this.pending.shift()!;
        const enemy = spawnEnemy(next.type, choosePathIndex(map, this.pathRng, this.enemies.length), map, next.eliteMods);
        this.enemies.push(enemy);
        emit({
          type: "spawn",
          enemyId: enemy.id,
          enemyType: enemy.type,
          routeId: map.routes[enemy.routeIndex]!.id,
        });
        this.spawnWait = this.spawnInterval;
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.reached) continue;
      const phaseBefore = enemy.phase;
      tickRegen(enemy, TICK);
      tickStatuses(enemy, TICK);
      tickDots(enemy, TICK, (kind, damage, sourceHeroId) => {
        this.credit(sourceHeroId, damage);
        emit({
          type: "dot",
          enemyId: enemy.id,
          kind,
          damage,
          x: enemy.x,
          y: enemy.y,
          element: dotElement(kind),
        });
      });
      if (enemy.phase !== phaseBefore) emit({ type: "phase", enemyId: enemy.id, phase: enemy.phase });
      if (!enemy.alive) {
        this.killEnemy(enemy, stepEvents);
        continue;
      }
      advanceAlongRoute(enemy, map, TICK);
      if (enemy.reached) {
        enemy.alive = false;
        this.leaks += 1;
        if (enemy.type === "boss") {
          emit({
            type: "leak",
            enemyId: enemy.id,
            enemyType: enemy.type,
            castleDamage: this.castleHp,
          });
          this.castleHp = 0;
          this.finish("bossReached");
          const end = this.events.find((e) => e.type === "end");
          if (end) stepEvents.push(end);
          return stepEvents;
        }
        this.castleHp -= enemy.leakDamage;
        emit({
          type: "leak",
          enemyId: enemy.id,
          enemyType: enemy.type,
          castleDamage: enemy.leakDamage,
        });
      }
    }

    for (const hero of this.heroes) {
      hero.cooldown -= TICK;
      if (hero.cooldown > 0) continue;
      const inRange = enemiesInRange(hero, hero.stats.range, this.living());
      const primary = primaryTarget(inRange);
      if (!primary) continue;

      const group = collectTargets(hero, primary, this.living());
      const chained = maybeChain(this.rng, hero.stats, group, this.living());
      const all = [...group, ...chained];
      const skill = heroDef(hero.instance.defId).archetype === "mage";
      let swing = 0;
      let anyCrit = false;
      const targetIds: string[] = [];

      for (const [i, target] of all.entries()) {
        if (!target.alive) continue;
        const phaseBefore = target.phase;
        const hit = hitDamage(this.rng, hero.stats, target, skill);
        const chainPenalty = i >= group.length ? 0.7 : 1;
        const dealt = applyDamage(target, hit.damage * chainPenalty);
        swing += dealt;
        if (hit.crit) anyCrit = true;
        targetIds.push(target.id);
        applyOnHit(this.rng, hero.stats, target, hero.instance.id);
        emit({
          type: "hit",
          heroId: hero.instance.id,
          enemyId: target.id,
          damage: dealt,
          crit: hit.crit,
          x: target.x,
          y: target.y,
          elements: imbuedElements(hero.stats),
        });
        if (target.phase !== phaseBefore) emit({ type: "phase", enemyId: target.id, phase: target.phase });
        if (!target.alive) this.killEnemy(target, stepEvents);
      }

      hero.damageDealt += swing;
      hero.cooldown = 1 / fireRate(hero);
      if (swing > 0) {
        emit({
          type: "attack",
          heroId: hero.instance.id,
          targetIds,
          damage: swing,
          crit: anyCrit,
        });
      }
    }

    this.time += TICK;
    const active = this.enemies.some((e) => e.alive && !e.reached);
    const timedOut = this.time >= MAX_TIME;
    if (this.castleHp <= 0 || timedOut) {
      this.finish(this.castleHp <= 0 ? "castleDestroyed" : "escaped");
      const end = this.events.find((e) => e.type === "end");
      if (end) stepEvents.push(end);
      return stepEvents;
    }
    if (!active && this.pending.length === 0 && this.wave > 0 && this.lastClearedWave !== this.wave) {
      this.lastClearedWave = this.wave;
      if (this.allWavesQueued) {
        this.finish(this.kills.boss > 0 ? "cleared" : "escaped");
        const end = this.events.find((e) => e.type === "end");
        if (end) stepEvents.push(end);
      } else {
        emit({ type: "waveCleared", wave: this.wave });
        if (this.autoNextWave) {
          this.waveCountdown = 0.35;
        } else {
          this.waitingForNextWave = true;
          this.paused = true;
        }
      }
    }
    return stepEvents;
  }

  private finish(forced?: "cleared" | "castleDestroyed" | "escaped" | "bossReached"): void {
    if (this.finished) return;
    this.finished = true;
    this.paused = false;
    this.waitingForNextWave = false;
    const victory =
      (forced ?? (this.castleHp > 0 && this.kills.boss > 0 ? "cleared" : "escaped")) === "cleared";
    if (victory) {
      const battery = rollPassBattery(this.rng);
      this.loot.energy += battery;
      this.freshLoot.energy += battery;
    }
    const reason =
      forced ??
      (this.castleHp <= 0 ? "castleDestroyed" : this.kills.boss > 0 ? "cleared" : "escaped");
    const end: BattleEvent = { type: "end", victory, reason };
    this.persist(end);
    const damageByHero: Record<string, number> = {};
    for (const hero of this.heroes) damageByHero[hero.instance.id] = hero.damageDealt;
    this.result = {
      victory,
      time: this.time,
      castleHp: Math.max(0, this.castleHp),
      castleMaxHp: this.map.castleHp,
      kills: { ...this.kills },
      leaks: this.leaks,
      loot: this.loot,
      damageByHero,
      events: this.events,
    };
  }

  finalize(): BattleResult {
    if (!this.result) this.finish();
    return this.result!;
  }
}

export function simulateBattle(
  deployments: BattleDeployment[],
  options: { seed?: number; map?: MapDef; recordAllEvents?: boolean; account?: PlayerState } = {},
): BattleResult {
  const runtime = new BattleRuntime(deployments, { ...options, autoNextWave: true });
  while (!runtime.finished) {
    runtime.step(TICK);
    if (runtime.waitingForNextWave) {
      if (!runtime.canAffordNextWave()) break;
      runtime.startNextWave();
    }
  }
  return runtime.finalize();
}

function flattenWave(
  wave: MapDef["waves"][number],
): Array<{ type: EnemyType; eliteMods: EliteModifier[] }> {
  const list: Array<{ type: EnemyType; eliteMods: EliteModifier[] }> = [];
  for (const pack of wave.packs) {
    for (let i = 0; i < pack.count; i++) {
      list.push({ type: pack.type, eliteMods: pack.eliteModifiers ?? [] });
    }
  }
  return list;
}

export function defaultSlots(heroCount: number, map: MapDef = playMap()): string[] {
  return map.slots.slice(0, heroCount).map((s) => s.id);
}

export function pathLength(map: MapDef = playMap()): number {
  return Math.max(...map.routes.map((r) => routeLength(r.waypoints)));
}
