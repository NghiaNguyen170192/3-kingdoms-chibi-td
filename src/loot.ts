import { HERO_DEFS } from "./data.js";
import { generateItem } from "./items.js";
import { randomGem } from "./gems.js";
import type { Rng } from "./rng.js";
import type { EnemyType, LootDrop, Rarity } from "./types.js";

interface DropChances {
  gold: [number, number];
  item: number;
  gem: number;
  fragment: number;
  rarityWeights: Array<[Rarity, number]>;
}

const TABLES: Record<EnemyType, DropChances> = {
  troop: {
    gold: [1, 4],
    item: 0.06,
    gem: 0.03,
    fragment: 0.04,
    rarityWeights: [
      ["normal", 70],
      ["magic", 25],
      ["rare", 5],
    ],
  },
  scout: {
    gold: [1, 3],
    item: 0.05,
    gem: 0.04,
    fragment: 0.03,
    rarityWeights: [
      ["normal", 65],
      ["magic", 30],
      ["rare", 5],
    ],
  },
  brute: {
    gold: [3, 8],
    item: 0.12,
    gem: 0.06,
    fragment: 0.06,
    rarityWeights: [
      ["normal", 40],
      ["magic", 45],
      ["rare", 15],
    ],
  },
  elite: {
    gold: [6, 14],
    item: 0.28,
    gem: 0.16,
    fragment: 0.1,
    rarityWeights: [
      ["magic", 50],
      ["rare", 40],
      ["unique", 10],
    ],
  },
  boss: {
    gold: [30, 50],
    item: 1,
    gem: 1,
    fragment: 0.5,
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
  return { gold: 0, items: [], gems: [], fragments: {} };
}

export function mergeLoot(into: LootDrop, add: LootDrop): LootDrop {
  into.gold += add.gold;
  into.items.push(...add.items);
  into.gems.push(...add.gems);
  for (const [hero, n] of Object.entries(add.fragments)) {
    into.fragments[hero] = (into.fragments[hero] ?? 0) + n;
  }
  return into;
}

export function rollKillLoot(
  rng: Rng,
  type: EnemyType,
  itemFind = 0,
  goldFind = 0,
): LootDrop {
  const table = TABLES[type];
  const loot = emptyLoot();
  loot.gold = Math.round(rng.int(table.gold[0], table.gold[1]) * (1 + goldFind));

  const itemRolls = type === "boss" ? rng.int(2, 4) : 1;
  for (let i = 0; i < itemRolls; i++) {
    if (rng.chance(Math.min(0.95, table.item * (1 + itemFind)))) {
      loot.items.push(generateItem(rng, rollRarity(rng, table.rarityWeights)));
    }
  }

  const gemRolls = type === "boss" ? rng.int(1, 2) : 1;
  for (let i = 0; i < gemRolls; i++) {
    if (rng.chance(Math.min(0.9, table.gem * (1 + itemFind * 0.5)))) {
      loot.gems.push(randomGem(rng, type === "boss" ? rng.int(1, 2) : 1));
    }
  }

  if (rng.chance(table.fragment)) {
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
