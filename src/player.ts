import {
  ENERGY,
  EQUIPMENT_MERGE,
  GEM_MERGE,
  GEM_SOCKETS_BY_RARITY,
  HERO_DEFS,
  HERO_MERGE,
  heroDef,
  nextRarity,
} from "./data.js";
import { createGem, gemMergeGroups, mergeGems, socketGem, unsocketGem } from "./gems.js";
import { canWearOn, equipItem, generateItem, mergeEquipment, mergeGroups, starterWeapon } from "./items.js";
import { createId } from "./rng.js";
import type { Gem, GemFamily, HeroInstance, Item, LootDrop, PlayerState, Rarity, WornSlot } from "./types.js";
import type { Rng } from "./rng.js";

const IMBUED_GEMS: GemFamily[] = ["lightning", "cold", "fire", "toxic", "bleed"];

export function createHero(defId: string, rarity: Rarity = "mythic"): HeroInstance {
  const weapon = starterWeapon(defId);
  const equipment: HeroInstance["equipment"] = {};
  if (weapon.weaponStyle === "twoHand") {
    equipment.mainHand = weapon;
    equipment.offHand = weapon;
  } else {
    equipment.mainHand = weapon;
  }
  return {
    id: createId("hero"),
    defId,
    rarity,
    favorite: false,
    equipment,
    gems: Array.from({ length: GEM_SOCKETS_BY_RARITY[rarity] }, () => null),
  };
}

function roleGem(defId: string): GemFamily {
  const archetype = heroDef(defId).archetype;
  if (archetype === "speed") return "attackSpeed";
  if (archetype === "damager") return "moreDamage";
  return "castSpeed";
}

export function createNewPlayer(): PlayerState {
  const heroes = HERO_DEFS.map((h) => createHero(h.id));
  for (const hero of heroes) {
    IMBUED_GEMS.forEach((family, index) => socketGem(hero, index, createGem(family)));
    socketGem(hero, IMBUED_GEMS.length, createGem(roleGem(hero.defId)));
  }
  return {
    gold: 20,
    energy: ENERGY.max,
    heroes,
    inventory: [],
    gems: [],
    fragments: {},
  };
}

export function addEnergy(player: PlayerState, amount: number): void {
  player.energy = Math.min(ENERGY.max, player.energy + amount);
}

/** Clear reward: one mergeable set each of items, gems, and a hero. */
export function grantClearReward(player: PlayerState, rng: Rng): void {
  for (let i = 0; i < EQUIPMENT_MERGE.inputCount; i++) {
    player.inventory.push(generateItem(rng, "normal", "dagger"));
  }
  for (let i = 0; i < GEM_MERGE.inputCount; i++) {
    player.gems.push(createGem("attackSpeed"));
  }
  for (const family of IMBUED_GEMS) player.gems.push(createGem(family));
  const defId = rng.pick(HERO_DEFS).id;
  for (let i = 0; i < HERO_MERGE.inputCount; i++) {
    player.heroes.push(createHero(defId, "normal"));
  }
}

export function collectLoot(player: PlayerState, loot: LootDrop): void {
  player.gold += loot.gold;
  addEnergy(player, loot.energy);
  player.inventory.push(...loot.items);
  player.gems.push(...loot.gems);
  for (const [hero, n] of Object.entries(loot.fragments)) {
    player.fragments[hero] = (player.fragments[hero] ?? 0) + n;
  }
}

export function findEquipped(
  player: PlayerState,
  itemId: string,
): { heroId: string; slot: WornSlot } | null {
  for (const hero of player.heroes) {
    for (const [slot, item] of Object.entries(hero.equipment) as Array<[WornSlot, Item | undefined]>) {
      if (item?.id === itemId) return { heroId: hero.id, slot };
    }
  }
  return null;
}

export function unequip(player: PlayerState, heroId: string, slot: WornSlot): Item | null {
  const hero = player.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error("Hero not found");
  const item = hero.equipment[slot];
  if (!item) return null;
  if (item.weaponStyle === "twoHand") {
    delete hero.equipment.mainHand;
    delete hero.equipment.offHand;
  } else {
    delete hero.equipment[slot];
  }
  player.inventory.push(item);
  return item;
}

export function wear(
  player: PlayerState,
  heroId: string,
  itemId: string,
  slot: WornSlot,
): string {
  const hero = player.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error("Hero not found");
  const idx = player.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new Error("Item not in inventory");
  const item = player.inventory[idx]!;
  if (!canWearOn(item, slot)) throw new Error(`Cannot wear ${item.name} on ${slot}`);
  const result = equipItem(hero.equipment, slot, item);
  hero.equipment = result.equipment;
  player.inventory.splice(idx, 1);
  player.inventory.push(...result.unequipped);
  return `Equipped ${item.name} on ${slot}`;
}

export function unsocket(player: PlayerState, heroId: string, socketIndex: number): Gem | null {
  const hero = player.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error("Hero not found");
  const gem = unsocketGem(hero, socketIndex);
  if (gem) player.gems.push(gem);
  return gem;
}

export function socket(player: PlayerState, heroId: string, gemId: string, socketIndex: number): string {
  const hero = player.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error("Hero not found");
  const idx = player.gems.findIndex((g) => g.id === gemId);
  if (idx < 0) throw new Error("Gem not in stash");
  const gem = player.gems[idx]!;
  player.gems.splice(idx, 1);
  const previous = socketGem(hero, socketIndex, gem);
  if (previous) player.gems.push(previous);
  return `Socketed ${gem.name} Lv.${gem.level} into socket ${socketIndex + 1}`;
}

export function mergeItems(player: PlayerState, itemIds: string[], rng: Rng): Item {
  const items: Item[] = [];
  for (const id of itemIds) {
    const idx = player.inventory.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error(`Item ${id} not in inventory`);
    items.push(player.inventory[idx]!);
  }
  const result = mergeEquipment(items, rng);
  player.inventory = player.inventory.filter((i) => !itemIds.includes(i.id));
  player.inventory.push(result);
  return result;
}

export function mergePlayerGems(player: PlayerState, gemIds: string[]): Gem {
  const gems: Gem[] = [];
  for (const id of gemIds) {
    const idx = player.gems.findIndex((g) => g.id === id);
    if (idx < 0) throw new Error(`Gem ${id} not in stash`);
    gems.push(player.gems[idx]!);
  }
  const result = mergeGems(gems);
  player.gems = player.gems.filter((g) => !gemIds.includes(g.id));
  player.gems.push(result);
  return result;
}

export function mergeHeroes(player: PlayerState, heroIds: string[]): HeroInstance {
  if (heroIds.length !== HERO_MERGE.inputCount) {
    throw new Error(`Need ${HERO_MERGE.inputCount} heroes to merge`);
  }
  const heroes = heroIds.map((id) => {
    const hero = player.heroes.find((h) => h.id === id);
    if (!hero) throw new Error("Hero not found");
    return hero;
  });
  const defId = heroes[0]!.defId;
  const rarity = heroes[0]!.rarity;
  if (!heroes.every((h) => h.defId === defId && h.rarity === rarity)) {
    throw new Error("Merge requires 3 copies of the same hero and rarity");
  }
  const upgraded = nextRarity(rarity);
  if (!upgraded) throw new Error("Hero is already at maximum rarity");
  const keeper = heroes[0]!;
  for (const other of heroes.slice(1)) {
    player.inventory.push(...looseGear(other));
    for (const gem of other.gems) if (gem) player.gems.push(gem);
    player.heroes = player.heroes.filter((h) => h.id !== other.id);
  }
  keeper.rarity = upgraded;
  const sockets = GEM_SOCKETS_BY_RARITY[upgraded];
  while (keeper.gems.length < sockets) keeper.gems.push(null);
  if (keeper.gems.length > sockets) {
    for (const gem of keeper.gems.slice(sockets)) if (gem) player.gems.push(gem);
    keeper.gems = keeper.gems.slice(0, sockets);
  }
  return keeper;
}

function looseGear(hero: HeroInstance): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const item of Object.values(hero.equipment)) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function autoMergeAll(player: PlayerState, rng: Rng): { items: number; gems: number } {
  let items = 0;
  let gems = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const groups = mergeGroups(player.inventory);
    if (groups.length > 0) {
      const group = groups[0]!.slice(0, 5);
      mergeItems(
        player,
        group.map((i) => i.id),
        rng,
      );
      items += 1;
      changed = true;
    }
    const ggroups = gemMergeGroups(player.gems);
    if (ggroups.length > 0) {
      const group = ggroups[0]!.slice(0, 3);
      mergePlayerGems(
        player,
        group.map((g) => g.id),
      );
      gems += 1;
      changed = true;
    }
  }
  return { items, gems };
}

export function itemScore(item: Item): number {
  const rarityBonus: Record<string, number> = {
    normal: 0,
    magic: 8,
    rare: 18,
    unique: 30,
    legendary: 45,
    mythic: 65,
  };
  const mods = item.modifiers.reduce((s, m) => s + Math.abs(m.value) * 10, 0);
  return (rarityBonus[item.rarity] ?? 0) + mods;
}

/** Equip the strongest unused item into an empty or weaker matching slot. */
export function autoEquipBest(player: PlayerState): number {
  let equipped = 0;
  const used = new Set<string>();
  for (const hero of player.heroes) {
    for (const item of [...player.inventory].sort((a, b) => itemScore(b) - itemScore(a))) {
      if (used.has(item.id)) continue;
      const slot = suggestSlot(hero, item);
      if (!slot) continue;
      const current = hero.equipment[slot];
      if (current && itemScore(current) >= itemScore(item)) continue;
      wear(player, hero.id, item.id, slot);
      used.add(item.id);
      equipped += 1;
    }
  }
  return equipped;
}

export function autoSocketGems(player: PlayerState): number {
  let n = 0;
  const unused = [...player.gems];
  for (const hero of player.heroes) {
    const def = heroDef(hero.defId);
    const prefer = preferredGems(def.archetype);
    for (let i = 0; i < hero.gems.length; i++) {
      if (hero.gems[i]) continue;
      const pick =
        unused.find((g) => prefer.includes(g.family)) ?? unused[0];
      if (!pick) return n;
      unused.splice(unused.indexOf(pick), 1);
      socket(player, hero.id, pick.id, i);
      n += 1;
    }
  }
  return n;
}

function preferredGems(archetype: string): string[] {
  if (archetype === "speed") return ["attackSpeed", "critRate", "critMulti", "bleed"];
  if (archetype === "damager") return ["moreDamage", "critMulti", "fire", "bleed"];
  return ["castSpeed", "lightning", "moreDamage", "critRate"];
}

function preferredWeaponStyle(defId: string): "oneHand" | "twoHand" {
  return heroDef(defId).archetype === "speed" ? "oneHand" : "twoHand";
}

export function suggestSlot(hero: HeroInstance, item: Item): WornSlot | null {
  if (item.slot === "weapon") {
    const style = preferredWeaponStyle(hero.defId);
    if (item.weaponStyle !== style) return null;
    if (item.weaponStyle === "twoHand") return "mainHand";
    if (!hero.equipment.mainHand) return "mainHand";
    if (hero.equipment.mainHand.weaponStyle === "oneHand" && !hero.equipment.offHand) {
      return "offHand";
    }
    return "mainHand";
  }
  if (item.slot === "ring") {
    if (!hero.equipment.ring1) return "ring1";
    if (!hero.equipment.ring2) return "ring2";
    return itemScore(hero.equipment.ring1) < itemScore(hero.equipment.ring2) ? "ring1" : "ring2";
  }
  return item.slot as WornSlot;
}
