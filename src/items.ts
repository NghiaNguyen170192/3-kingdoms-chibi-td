import {
  EQUIPMENT_MERGE,
  ITEM_BASES,
  MODIFIER_POOL,
  RARITY_AFFIX_COUNT,
  heroDef,
  itemBase,
  nextRarity,
} from "./data.js";
import { createId, type Rng } from "./rng.js";
import type { EquipSlot, Item, Rarity, WornSlot } from "./types.js";

export function generateItem(rng: Rng, rarity: Rarity, baseId?: string): Item {
  const base = baseId ? itemBase(baseId) : rng.pick(ITEM_BASES);
  const affixCount = RARITY_AFFIX_COUNT[rarity];
  const rolled = rng.pickN(MODIFIER_POOL, affixCount).map((pool) => ({
    id: pool.id,
    value: round(rng.float(pool.min, pool.max), 3),
  }));
  return {
    id: createId("item"),
    baseId: base.id,
    name: base.name,
    slot: base.slot,
    weaponStyle: base.weaponStyle,
    rarity,
    modifiers: [...base.implicits.map((m) => ({ ...m })), ...rolled],
  };
}

export function starterWeapon(heroDefId: string): Item {
  const def = heroDef(heroDefId);
  const baseId = def.archetype === "speed" ? "dagger" : def.archetype === "damager" ? "polearm" : "staff";
  const base = itemBase(baseId);
  return {
    id: createId("item"),
    baseId: base.id,
    name: `Worn ${base.name}`,
    slot: base.slot,
    weaponStyle: base.weaponStyle,
    rarity: "normal",
    modifiers: base.implicits.map((m) => ({ ...m })),
  };
}

export function canWearOn(item: Item, slot: WornSlot): boolean {
  if (slot === "mainHand" || slot === "offHand") {
    if (item.slot !== "weapon") return false;
    if (slot === "offHand") return item.weaponStyle === "oneHand";
    return true;
  }
  if (slot === "ring1" || slot === "ring2") return item.slot === "ring";
  return item.slot === (slot as EquipSlot);
}

export function equipItem(
  equipment: Item["slot"] extends never ? never : Partial<Record<WornSlot, Item>>,
  slot: WornSlot,
  item: Item,
): { equipment: Partial<Record<WornSlot, Item>>; unequipped: Item[] } {
  if (!canWearOn(item, slot)) {
    throw new Error(`Cannot wear ${item.name} in ${slot}`);
  }

  const next = { ...equipment };
  const unequipped: Item[] = [];
  const take = (s: WornSlot) => {
    const existing = next[s];
    if (existing) {
      unequipped.push(existing);
      delete next[s];
    }
  };

  if (item.weaponStyle === "twoHand") {
    take("mainHand");
    take("offHand");
    next.mainHand = item;
    next.offHand = item;
    return { equipment: next, unequipped: uniqueItems(unequipped) };
  }

  if (slot === "mainHand" || slot === "offHand") {
    const other = slot === "mainHand" ? next.offHand : next.mainHand;
    if (other?.weaponStyle === "twoHand") {
      take("mainHand");
      take("offHand");
    }
    take(slot);
    next[slot] = item;
    return { equipment: next, unequipped: uniqueItems(unequipped) };
  }

  take(slot);
  next[slot] = item;
  return { equipment: next, unequipped: uniqueItems(unequipped) };
}

export function mergeEquipment(items: Item[], rng: Rng): Item {
  if (items.length !== EQUIPMENT_MERGE.inputCount) {
    throw new Error(`Need ${EQUIPMENT_MERGE.inputCount} items to merge`);
  }
  const rarity = items[0]!.rarity;
  const baseId = items[0]!.baseId;
  if (!items.every((i) => i.rarity === rarity && i.baseId === baseId)) {
    throw new Error("Merge requires 5 items of the same base and rarity");
  }
  const upgraded = nextRarity(rarity);
  if (!upgraded) throw new Error("Already at maximum rarity");
  return generateItem(rng, upgraded, baseId);
}

export function mergeGroups(items: Item[]): Item[][] {
  const buckets = new Map<string, Item[]>();
  for (const item of items) {
    const key = `${item.baseId}:${item.rarity}`;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return [...buckets.values()].filter((g) => g.length >= EQUIPMENT_MERGE.inputCount);
}

function uniqueItems(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
