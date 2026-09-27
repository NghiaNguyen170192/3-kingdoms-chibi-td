import { HERO_DEFS, heroDef } from "./data.js";
import { createGem, gemMergeGroups, mergeGems, socketGem } from "./gems.js";
import { canWearOn, equipItem, mergeEquipment, mergeGroups, starterWeapon } from "./items.js";
import { createId } from "./rng.js";
import type { Gem, HeroInstance, Item, LootDrop, PlayerState, WornSlot } from "./types.js";
import type { Rng } from "./rng.js";

export function createHero(defId: string): HeroInstance {
  const def = heroDef(defId);
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
    favorite: false,
    equipment,
    gems: Array.from({ length: def.gemSockets }, () => null),
  };
}

export function createNewPlayer(): PlayerState {
  const heroes = HERO_DEFS.map((h) => createHero(h.id));
  const byDef = (id: string) => heroes.find((h) => h.defId === id);
  const speed = byDef("zhao-yun");
  const damager = byDef("guan-yu");
  const mage = byDef("zhuge-liang");
  if (speed) socketGem(speed, 0, createGem("attackSpeed"));
  if (damager) socketGem(damager, 0, createGem("moreDamage"));
  if (mage) socketGem(mage, 0, createGem("lightning"));
  return {
    gold: 20,
    heroes,
    inventory: [],
    gems: [],
    fragments: {},
  };
}

export function collectLoot(player: PlayerState, loot: LootDrop): void {
  player.gold += loot.gold;
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
