import { describe, expect, it } from "vitest";
import { BattleRuntime, simulateBattle, defaultSlots, TICK } from "../src/battle.js";
import { hitDamage, applyDamage, applyOnHit, tickDots, blankResist, imbuedElements } from "../src/combat.js";
import { DROP_CHANCE, ENERGY, ENEMY_DEFS, EQUIPMENT_MERGE, GEM_MERGE, GEM_SOCKETS_BY_RARITY, HERO_MERGE, MVP_MAP, nextRarity } from "../src/data.js";
import { playMap } from "../src/map/tiles.js";
import { createGem, mergeGems, socketGem } from "../src/gems.js";
import { generateItem, mergeEquipment } from "../src/items.js";
import { rollKillLoot, rollPassBattery } from "../src/loot.js";
import { addEnergy, autoEquipBest, autoSocketGems, collectLoot, createHero, createNewPlayer, grantClearReward, mergeHeroes, unequip, wear } from "../src/player.js";
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
  it("has the MVP layout: 2 routes, 1 destination, 20 waves, 1 boss", () => {
    expect(MVP_MAP.routes).toHaveLength(2);
    const ends = MVP_MAP.routes.map((r) => r.waypoints.at(-1));
    expect(ends[0]).toEqual(ends[1]);
    expect(MVP_MAP.waves).toHaveLength(20);
    expect(MVP_MAP.waves.at(-1)?.wave).toBe(20);
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

  it("sizes sockets from hero rarity and caps mythic at 6", () => {
    expect(GEM_SOCKETS_BY_RARITY.normal).toBe(1);
    expect(GEM_SOCKETS_BY_RARITY.magic).toBe(2);
    expect(GEM_SOCKETS_BY_RARITY.rare).toBe(3);
    expect(GEM_SOCKETS_BY_RARITY.unique).toBe(4);
    expect(GEM_SOCKETS_BY_RARITY.legendary).toBe(5);
    expect(GEM_SOCKETS_BY_RARITY.mythic).toBe(6);
    const mythic = createHero("zhao-yun");
    expect(mythic.rarity).toBe("mythic");
    expect(mythic.gems).toHaveLength(6);
    expect(createHero("zhao-yun", "normal").gems).toHaveLength(1);
  });

  it("sockets the five imbued gems on a new hero", () => {
    resetIds();
    const hero = createNewPlayer().heroes.find((h) => h.defId === "zhao-yun")!;
    expect(hero.gems.map((gem) => gem?.family)).toEqual([
      "lightning",
      "cold",
      "fire",
      "toxic",
      "bleed",
      "attackSpeed",
    ]);
  });

  it("merges 3 hero copies into the next rarity with more sockets", () => {
    resetIds();
    const player = createNewPlayer();
    const copies = ["normal", "normal", "normal"].map(() => createHero("zhao-yun", "normal"));
    player.heroes.push(...copies);
    const out = mergeHeroes(player, copies.map((hero) => hero.id));
    expect(out.rarity).toBe("magic");
    expect(out.gems).toHaveLength(GEM_SOCKETS_BY_RARITY.magic);
    expect(player.heroes.filter((h) => h.defId === "zhao-yun" && h.rarity === "normal")).toHaveLength(0);
    expect(HERO_MERGE.inputCount).toBe(3);
  });

  it("grants a mergeable clear reward of items, gems, and a hero", () => {
    resetIds();
    const player = createNewPlayer();
    const before = player.heroes.length;
    grantClearReward(player, new Rng(1));
    expect(player.inventory.filter((item) => item.baseId === "dagger" && item.rarity === "normal")).toHaveLength(5);
    expect(player.gems.filter((gem) => gem.family === "attackSpeed" && gem.level === 1)).toHaveLength(3);
    expect(player.heroes.length).toBe(before + 3);
    expect(player.heroes.some((hero) => hero.rarity === "normal")).toBe(true);
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
  it("drops items, gems, and fragments at 5%", () => {
    expect(DROP_CHANCE).toBe(0.05);
    const rng = new Rng(5);
    const drops = Array.from({ length: 800 }, () => rollKillLoot(rng, "boss"));
    const count = (pick: (loot: (typeof drops)[number]) => number) => drops.reduce((sum, loot) => sum + pick(loot), 0);
    for (const total of [
      count((loot) => loot.items.length),
      count((loot) => loot.gems.length),
      count((loot) => Object.values(loot.fragments).reduce((sum, n) => sum + n, 0)),
    ]) {
      expect(total / drops.length).toBeGreaterThan(0.02);
      expect(total / drops.length).toBeLessThan(0.09);
    }
    expect(drops.every((loot) => loot.gold > 10)).toBe(true);
    expect(drops.every((loot) => loot.items.length <= 1 && loot.gems.length <= 1)).toBe(true);
  });

  it("rolls a pass energy battery of 1, 2, or 5", () => {
    const rng = new Rng(4);
    const seen = new Set<number>();
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const battery = rollPassBattery(rng);
      if (battery === 0) continue;
      hits += 1;
      seen.add(battery);
    }
    expect(hits / 2000).toBeGreaterThan(0.03);
    expect(hits / 2000).toBeLessThan(0.08);
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 5]);
  });
});

describe("battle simulation", () => {
  it("emits per-target hit events with damage", () => {
    resetIds();
    const runtime = new BattleRuntime(deployStarters(), { seed: 21 });
    const hits: Array<{ damage: number; x: number; y: number; elements: string[] }> = [];
    for (let i = 0; i < 800 && !runtime.finished; i++) {
      for (const event of runtime.step(TICK)) {
        if (event.type === "hit") hits.push(event);
      }
    }
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.damage).toBeGreaterThan(0);
    expect(hits[0]!.elements).toEqual([]);
  });

  it("stamps socketed imbued gems onto each hit", () => {
    resetIds();
    const mage = createHero("zhuge-liang");
    socketGem(mage, 0, createGem("lightning"));
    socketGem(mage, 1, createGem("fire"));
    expect(imbuedElements(computeHeroStats(mage))).toEqual(["lightning", "fire"]);
    const runtime = new BattleRuntime(deployStarters([mage]), { seed: 3 });
    const hits: Array<{ elements: string[] }> = [];
    for (let i = 0; i < 400 && hits.length === 0 && !runtime.finished; i++) {
      for (const event of runtime.step(TICK)) {
        if (event.type === "hit") hits.push(event);
      }
    }
    expect(hits[0]?.elements).toEqual(["lightning", "fire"]);
  });

  it("runs the 20-wave map to a conclusion", () => {
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
  it("starts at 100 energy, spends 1 per wave, and caps batteries at 100", () => {
    resetIds();
    const player = createNewPlayer();
    expect(player.energy).toBe(ENERGY.max);
    const blocked = new BattleRuntime(deployStarters(), { seed: 1, account: player, autoNextWave: false });
    player.energy = 0;
    for (let i = 0; i < 20; i++) blocked.step(TICK);
    expect(blocked.wave).toBe(0);
    expect(blocked.waitingForNextWave).toBe(true);
    expect(player.energy).toBe(0);

    player.energy = ENERGY.max;
    const runtime = new BattleRuntime(deployStarters(), { seed: 1, account: player, autoNextWave: false });
    for (let i = 0; i < 40 && runtime.wave === 0; i++) runtime.step(TICK);
    expect(runtime.wave).toBe(1);
    expect(player.energy).toBe(99);
    const id = runtime.heroes[0]!.instance.id;
    runtime.removeHero(id);
    expect(runtime.heroes.some((hero) => hero.instance.id === id)).toBe(false);

    player.energy = 99;
    addEnergy(player, 5);
    expect(player.energy).toBe(100);
    collectLoot(player, { gold: 0, items: [], gems: [], fragments: {}, energy: 2 });
    expect(player.energy).toBe(100);
  });

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
