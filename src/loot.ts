import { DROP_CHANCE, ENERGY, HERO_DEFS } from "./data.js";
import { generateItem } from "./items.js";
import { randomGem } from "./gems.js";
import type { Rng } from "./rng.js";
import type { EnemyType, LootDrop, Rarity } from "./types.js";

interface DropChances {
  gold: [number, number];
  rarityWeights: Array<[Rarity, number]>;
}

const TABLES: Record<EnemyType, DropChances> = {
  troop: {
    gold: [1, 4],
    rarityWeights: [
      ["normal", 70],
      ["magic", 25],
      ["rare", 5],
    ],
  },
  scout: {
    gold: [1, 3],
    rarityWeights: [
      ["normal", 65],
      ["magic", 30],
      ["rare", 5],
    ],
  },
  brute: {
    gold: [3, 8],
    rarityWeights: [
      ["normal", 40],
      ["magic", 45],
      ["rare", 15],
    ],
  },
  elite: {
    gold: [6, 14],
    rarityWeights: [
      ["magic", 50],
      ["rare", 40],
      ["unique", 10],
    ],
  },
  boss: {
    gold: [30, 50],
    rarityWeights: [
      ["rare", 45],
      ["unique", 35],
      ["legendary", 15],
      ["mythic", 5],
    ],
  },
};

const FRAGMENT_HEROES = HERO_DEFS.map((h) => h.id);

export function emptyLoot(): LootDrop {
  return { gold: 0, items: [], gems: [], fragments: {}, energy: 0 };
}

export function mergeLoot(into: LootDrop, add: LootDrop): LootDrop {
  into.gold += add.gold;
  into.energy += add.energy;
  into.items.push(...add.items);
  into.gems.push(...add.gems);
  for (const [hero, n] of Object.entries(add.fragments)) {
    into.fragments[hero] = (into.fragments[hero] ?? 0) + n;
  }
  return into;
}

/** 5% chance of an energy battery worth 1, 2, or 5 when a pass is cleared. */
export function rollPassBattery(rng: Rng): number {
  if (!rng.chance(DROP_CHANCE)) return 0;
  return rng.pick(ENERGY.batteryValues);
}

/** Item, gem, and fragment each roll once at DROP_CHANCE. Item find does not raise that rate. */
export function rollKillLoot(
  rng: Rng,
  type: EnemyType,
  _itemFind = 0,
  goldFind = 0,
): LootDrop {
  const table = TABLES[type];
  const loot = emptyLoot();
  loot.gold = Math.round(rng.int(table.gold[0], table.gold[1]) * (1 + goldFind));

  if (rng.chance(DROP_CHANCE)) {
    loot.items.push(generateItem(rng, rollRarity(rng, table.rarityWeights)));
  }
  if (rng.chance(DROP_CHANCE)) {
    loot.gems.push(randomGem(rng, type === "boss" ? rng.int(1, 2) : 1));
  }
  if (rng.chance(DROP_CHANCE)) {
    const hero = rng.pick(FRAGMENT_HEROES);
    loot.fragments[hero] = 1;
  }
  return loot;
}

function rollRarity(rng: Rng, weights: Array<[Rarity, number]>): Rarity {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng.float(0, total);
  for (const [rarity, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return weights[0]![0];
}
