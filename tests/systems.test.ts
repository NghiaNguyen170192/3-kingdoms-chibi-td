import { describe, expect, it } from "vitest";
import { BattleRuntime, simulateBattle, defaultSlots, TICK } from "../src/battle.js";
import { hitDamage, applyDamage, applyOnHit, tickDots, blankResist } from "../src/combat.js";
import { ENEMY_DEFS, EQUIPMENT_MERGE, GEM_MERGE, MVP_MAP, nextRarity } from "../src/data.js";
import { playMap } from "../src/map/tiles.js";
import { createGem, mergeGems, socketGem } from "../src/gems.js";
import { generateItem, mergeEquipment } from "../src/items.js";
import { rollKillLoot } from "../src/loot.js";
import { autoEquipBest, autoSocketGems, collectLoot, createHero, createNewPlayer, unequip, wear } from "../src/player.js";
import { Rng, resetIds } from "../src/rng.js";
import { computeHeroStats } from "../src/stats.js";
import type { CombatEnemy } from "../src/combat.js";
import type { BattleDeployment, HeroInstance } from "../src/types.js";

function dummyEnemy(over: Partial<CombatEnemy> = {}): CombatEnemy {
  return {
    id: "e1",
    type: "troop",
    name: "Troop",
    hp: 100,
    maxHp: 100,
    baseSpeed: 30,
    leakDamage: 1,
    resist: blankResist({}),
    critResist: 0,
    regen: 0,
    routeIndex: 0,
    waypointIndex: 0,
    waypointT: 0,
    x: 0,
    y: 0,
    pathDist: 0,
    statuses: [],
    dots: [],
    alive: true,
    reached: false,
    phase: 1,
    ...over,
  };
}

const CORE_HEROES = ["zhao-yun", "guan-yu", "zhuge-liang"] as const;

function deployStarters(seedHeroes?: HeroInstance[]): BattleDeployment[] {
  const heroes = seedHeroes ?? CORE_HEROES.map((id) => createHero(id));
  const slots = defaultSlots(heroes.length);
  return heroes.map((hero, i) => ({ hero, slotId: slots[i]! }));
}

describe("map data", () => {
  it("has the MVP layout: 2 routes, 1 destination, 10 waves, 1 boss", () => {
    expect(MVP_MAP.routes).toHaveLength(2);
    const ends = MVP_MAP.routes.map((r) => r.waypoints.at(-1));
    expect(ends[0]).toEqual(ends[1]);
    expect(MVP_MAP.waves).toHaveLength(10);
    expect(MVP_MAP.waves.at(-1)?.packs.some((p) => p.type === "boss")).toBe(true);
    expect(playMap().slots.length).toBeGreaterThan(20);
    expect(ENEMY_DEFS.troop.leakDamage).toBe(1);
    expect(ENEMY_DEFS.scout.leakDamage).toBe(1);
    expect(ENEMY_DEFS.brute.leakDamage).toBe(1);
    expect(ENEMY_DEFS.elite.leakDamage).toBe(5);
  });
});

describe("hero stats", () => {
  it("keeps the three archetypes distinct", () => {
    resetIds();
    const speed = computeHeroStats(createHero("zhao-yun"));
    const damager = computeHeroStats(createHero("guan-yu"));
    const mage = computeHeroStats(createHero("zhuge-liang"));
    expect(speed.attackSpeed).toBeGreaterThan(damager.attackSpeed);
    expect(speed.range).toBe(1);
    expect(damager.range).toBe(2);
    expect(mage.range).toBe(3);
    expect(speed.range).toBeLessThan(mage.range);
    expect(damager.cleaveRadius).toBeGreaterThan(0);
    expect(mage.aoeRadius).toBeGreaterThan(0);
    expect(damager.damage).toBeGreaterThan(speed.damage);
  });

  it("lets loot change how a hero performs", () => {
    resetIds();
    const hero = createHero("zhao-yun");
    const before = computeHeroStats(hero);
    const rng = new Rng(9);
    const rare = generateItem(rng, "rare", "blade");
    hero.equipment.offHand = rare;
    hero.gems[0] = createGem("attackSpeed", 3);
    hero.gems[1] = createGem("critRate", 2);
    const after = computeHeroStats(hero);
    expect(after.damage).toBeGreaterThan(before.damage);
    expect(after.attackSpeed).toBeGreaterThan(before.attackSpeed);
    expect(after.critChance).toBeGreaterThan(before.critChance);
  });
});

describe("combat", () => {
  it("rolls crits and respects physical resist", () => {
    const stats = computeHeroStats(createHero("guan-yu"));
    const brute = dummyEnemy({ resist: blankResist({ physical: 0.4 }) });
    const troop = dummyEnemy();
    const vsTroop = hitDamage(new Rng(1), stats, troop);
    const vsBrute = hitDamage(new Rng(1), stats, brute);
    expect(vsTroop.damage).toBeGreaterThan(vsBrute.damage);
  });

  it("applies bleed DoT harder while the target is moving", () => {
    const stats = computeHeroStats(createHero("zhao-yun"));
    stats.bleedChance = 1;
    stats.added.bleed = 10;
    const moving = dummyEnemy({ baseSpeed: 40 });
    const frozen = dummyEnemy({
      baseSpeed: 40,
      statuses: [{ kind: "freeze", remaining: 2, magnitude: 1 }],
    });
    applyOnHit(new Rng(2), stats, moving, "h");
    applyOnHit(new Rng(2), stats, frozen, "h");
    const moveDmg = tickDots(moving, 1);
    const stillDmg = tickDots(frozen, 1);
    expect(moveDmg).toBeGreaterThan(stillDmg);
  });

  it("moves the boss into phase 2 at half health", () => {
    const boss = dummyEnemy({ type: "boss", hp: 100, maxHp: 100, phase: 1 });
    applyDamage(boss, 51);
    expect(boss.phase).toBe(2);
    expect(boss.alive).toBe(true);
  });
});

describe("items and gems", () => {
  it("merges 5 same-base items into the next rarity", () => {
    const rng = new Rng(4);
    const items = Array.from({ length: EQUIPMENT_MERGE.inputCount }, () =>
      generateItem(rng, "normal", "dagger"),
    );
    const out = mergeEquipment(items, rng);
    expect(out.rarity).toBe(nextRarity("normal"));
    expect(out.baseId).toBe("dagger");
    expect(out.modifiers.length).toBeGreaterThan(items[0]!.modifiers.length);
  });

  it("merges 3 identical gems into a stronger gem with extras at milestones", () => {
    const gems = [createGem("attackSpeed", 2), createGem("attackSpeed", 2), createGem("attackSpeed", 2)];
    const out = mergeGems(gems);
    expect(out.level).toBe(3);
    expect(out.modifiers.some((m) => m.id === "attackSpeed")).toBe(true);
    expect(out.modifiers.some((m) => m.id === "critChance")).toBe(true);
    expect(GEM_MERGE.inputCount).toBe(3);
  });

  it("sockets gems onto a hero", () => {
    const hero = createHero("zhuge-liang");
    const gem = createGem("lightning", 1);
    socketGem(hero, 0, gem);
    expect(hero.gems[0]?.family).toBe("lightning");
    expect(computeHeroStats(hero).added.lightning).toBeGreaterThan(0);
    expect(computeHeroStats(hero).chainChance).toBeGreaterThan(0);
  });

  it("two-handed weapons occupy both hands", () => {
    const hero = createHero("guan-yu");
    expect(hero.equipment.mainHand?.weaponStyle).toBe("twoHand");
    expect(hero.equipment.offHand).toBe(hero.equipment.mainHand);
  });
});

describe("loot", () => {
  it("gives bosses far better drops than troops", () => {
    const rngA = new Rng(5);
    const rngB = new Rng(5);
    const troop = Array.from({ length: 40 }, () => rollKillLoot(rngA, "troop"));
    const boss = Array.from({ length: 8 }, () => rollKillLoot(rngB, "boss"));
    const troopItems = troop.reduce((s, l) => s + l.items.length, 0);
    const bossItems = boss.reduce((s, l) => s + l.items.length, 0);
    expect(bossItems / boss.length).toBeGreaterThan(troopItems / troop.length);
    expect(boss.every((l) => l.gold > 10)).toBe(true);
  });
});

describe("battle simulation", () => {
  it("emits per-target hit events with damage", () => {
    resetIds();
    const runtime = new BattleRuntime(deployStarters(), { seed: 21 });
    const hits: Array<{ damage: number; x: number; y: number }> = [];
    for (let i = 0; i < 800 && !runtime.finished; i++) {
      for (const event of runtime.step(TICK)) {
        if (event.type === "hit") hits.push(event);
      }
    }
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.damage).toBeGreaterThan(0);
  });

  it("runs the 10-wave map to a conclusion", () => {
    resetIds();
    const result = simulateBattle(deployStarters(), { seed: 21 });
    expect(result.time).toBeGreaterThan(10);
    expect(result.kills.troop).toBeGreaterThan(0);
    expect(result.events.some((e) => e.type === "waveStart" && e.wave === 1)).toBe(true);
    expect(result.events.some((e) => e.type === "end")).toBe(true);
    expect(result.castleHp).toBeGreaterThanOrEqual(0);
  });

  it("makes a geared party deal more damage than starters on the same seed", () => {
    resetIds();
    const starters = CORE_HEROES.map((id) => createHero(id));
    const geared = CORE_HEROES.map((id) => createHero(id));
    const rng = new Rng(8);
    for (const hero of geared) {
      const extra = generateItem(rng, "rare", hero.defId === "zhao-yun" ? "blade" : hero.defId === "guan-yu" ? "amulet" : "ring");
      if (extra.slot === "weapon") hero.equipment.offHand = extra;
      else if (extra.slot === "amulet") hero.equipment.amulet = extra;
      else hero.equipment.ring1 = extra;
      socketGem(hero, 0, createGem("moreDamage", 3));
      socketGem(hero, 1, createGem(hero.defId === "zhuge-liang" ? "lightning" : "bleed", 2));
    }
    const a = simulateBattle(deployStarters(starters), { seed: 33 });
    const b = simulateBattle(deployStarters(geared), { seed: 33 });
    const dps = (r: typeof a) =>
      Object.values(r.damageByHero).reduce((x, y) => x + y, 0) / Math.max(r.time, 0.01);
    expect(dps(b)).toBeGreaterThan(dps(a));
    expect(b.leaks).toBeLessThanOrEqual(a.leaks);
    expect(b.castleHp).toBeGreaterThanOrEqual(a.castleHp);
  });
});

describe("player loop", () => {
  it("collects loot and can auto-equip it", () => {
    resetIds();
    const player = createNewPlayer();
    const result = simulateBattle(
      deployStarters(player.heroes.filter((h) => (CORE_HEROES as readonly string[]).includes(h.defId))),
      { seed: 12 },
    );
    collectLoot(player, result.loot);
    const before = player.inventory.length;
    autoEquipBest(player);
    autoSocketGems(player);
    expect(before + result.loot.items.length).toBeGreaterThanOrEqual(player.inventory.length);
    expect(player.gold).toBeGreaterThan(0);
  });

  it("lets only one hero wear a given item at a time", () => {
    resetIds();
    const player = createNewPlayer();
    const a = player.heroes[0]!;
    const b = player.heroes[1]!;
    const ring = generateItem(new Rng(2), "magic", "ring");
    player.inventory.push(ring);
    wear(player, a.id, ring.id, "ring1");
    expect(player.inventory.some((i) => i.id === ring.id)).toBe(false);
    expect(a.equipment.ring1?.id).toBe(ring.id);
    unequip(player, a.id, "ring1");
    wear(player, b.id, ring.id, "ring1");
    expect(a.equipment.ring1).toBeUndefined();
    expect(b.equipment.ring1?.id).toBe(ring.id);
  });

  it("pauses after a cleared wave when auto-next is off", () => {
    resetIds();
    const runtime = new BattleRuntime(deployStarters(), { seed: 21, autoNextWave: false });
    for (let i = 0; i < 4000 && !runtime.finished && !runtime.waitingForNextWave; i++) {
      runtime.step(TICK);
    }
    expect(runtime.waitingForNextWave).toBe(true);
    expect(runtime.wave).toBe(1);
    expect(runtime.finished).toBe(false);
    runtime.startNextWave();
    runtime.step(TICK * 8);
    expect(runtime.waitingForNextWave).toBe(false);
    expect(runtime.wave).toBeGreaterThanOrEqual(2);
  });

  it("does not put a one-handed weapon on a mage", () => {
    resetIds();
    const player = createNewPlayer();
    const mage = player.heroes.find((h) => h.defId === "zhuge-liang")!;
    player.inventory.push(generateItem(new Rng(1), "legendary", "dagger"));
    autoEquipBest(player);
    expect(mage.equipment.mainHand?.weaponStyle).toBe("twoHand");
    expect(mage.equipment.mainHand?.baseId).toBe("staff");
  });
});
