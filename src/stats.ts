import { heroDef } from "./data.js";
import type { CombatStats, DamageType, Gem, HeroInstance, Item, Modifier, WornSlot } from "./types.js";

const DAMAGE_TYPES: DamageType[] = ["physical", "fire", "cold", "lightning", "toxic", "bleed"];

export function emptyStats(): CombatStats {
  return {
    maxHp: 0,
    damage: 0,
    attackSpeed: 0,
    castSpeed: 0,
    range: 0,
    critChance: 0,
    critMultiplier: 0,
    cleaveRadius: 0,
    aoeRadius: 0,
    moreDamage: 1,
    skillDamage: 0,
    bossDamage: 0,
    armour: 0,
    damageReduction: 0,
    regeneration: 0,
    itemFind: 0,
    goldFind: 0,
    added: { physical: 0, fire: 0, cold: 0, lightning: 0, toxic: 0, bleed: 0 },
    resist: { physical: 0, fire: 0, cold: 0, lightning: 0, toxic: 0, bleed: 0 },
    igniteChance: 0,
    chillChance: 0,
    freezeChance: 0,
    shockChance: 0,
    chainChance: 0,
    poisonChance: 0,
    bleedChance: 0,
  };
}

export function itemModifiers(item: Item): Modifier[] {
  return item.modifiers;
}

export function equippedItems(hero: HeroInstance): Item[] {
  const slots: WornSlot[] = [
    "helmet",
    "body",
    "gloves",
    "belt",
    "boots",
    "ring1",
    "ring2",
    "amulet",
    "mainHand",
    "offHand",
  ];
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const slot of slots) {
    const item = hero.equipment[slot];
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

function applyModifier(stats: CombatStats, mod: Modifier): void {
  switch (mod.id) {
    case "flatDamage":
      stats.damage += mod.value;
      break;
    case "increasedDamage":
      (stats as CombatStats & { _inc: number })._inc =
        ((stats as CombatStats & { _inc?: number })._inc ?? 0) + mod.value;
      break;
    case "attackSpeed":
      stats.attackSpeed += mod.value;
      break;
    case "castSpeed":
      stats.castSpeed += mod.value;
      break;
    case "critChance":
      stats.critChance += mod.value;
      break;
    case "critMultiplier":
      stats.critMultiplier += mod.value;
      break;
    case "areaOfEffect":
      stats.aoeRadius += mod.value;
      stats.cleaveRadius += mod.value * 0.4;
      break;
    case "attackRange":
      stats.range += mod.value;
      break;
    case "skillDamage":
      stats.skillDamage += mod.value;
      break;
    case "bossDamage":
      stats.bossDamage += mod.value;
      break;
    case "maxHp":
      stats.maxHp += mod.value;
      break;
    case "armour":
      stats.armour += mod.value;
      break;
    case "damageReduction":
      stats.damageReduction += mod.value;
      break;
    case "regeneration":
      stats.regeneration += mod.value;
      break;
    case "fireResist":
      stats.resist.fire += mod.value;
      break;
    case "coldResist":
      stats.resist.cold += mod.value;
      break;
    case "lightningResist":
      stats.resist.lightning += mod.value;
      break;
    case "toxicResist":
      stats.resist.toxic += mod.value;
      break;
    case "itemFind":
      stats.itemFind += mod.value;
      break;
    case "goldFind":
      stats.goldFind += mod.value;
      break;
    case "addedFire":
      stats.added.fire += mod.value;
      break;
    case "addedCold":
      stats.added.cold += mod.value;
      break;
    case "addedLightning":
      stats.added.lightning += mod.value;
      break;
    case "addedToxic":
      stats.added.toxic += mod.value;
      break;
    case "addedBleed":
      stats.added.bleed += mod.value;
      break;
    case "moreDamage":
      stats.moreDamage *= 1 + mod.value;
      break;
    case "cleaveRadius":
      stats.cleaveRadius += mod.value;
      break;
    case "igniteChance":
      stats.igniteChance += mod.value;
      break;
    case "chillChance":
      stats.chillChance += mod.value;
      break;
    case "freezeChance":
      stats.freezeChance += mod.value;
      break;
    case "shockChance":
      stats.shockChance += mod.value;
      break;
    case "chainChance":
      stats.chainChance += mod.value;
      break;
    case "poisonChance":
      stats.poisonChance += mod.value;
      break;
    case "bleedChance":
      stats.bleedChance += mod.value;
      break;
    default:
      break;
  }
}

export function computeHeroStats(hero: HeroInstance): CombatStats {
  const def = heroDef(hero.defId);
  const stats = emptyStats();
  stats.damage = def.baseDamage;
  stats.attackSpeed = def.attackSpeed;
  stats.castSpeed = def.castSpeed;
  stats.range = def.range;
  stats.critChance = def.critChance;
  stats.critMultiplier = def.critMultiplier;
  stats.cleaveRadius = def.cleaveRadius;
  stats.aoeRadius = def.aoeRadius;
  stats.maxHp = 40;
  stats.moreDamage = 1;

  const extra = stats as CombatStats & { _inc: number };
  extra._inc = 0;

  const mods: Modifier[] = [];
  for (const item of equippedItems(hero)) {
    mods.push(...item.modifiers);
  }
  for (const gem of hero.gems) {
    if (gem) mods.push(...gem.modifiers);
  }
  for (const mod of mods) applyModifier(stats, mod);

  stats.damage *= 1 + extra._inc;
  stats.damage *= stats.moreDamage;
  stats.attackSpeed = Math.max(0.2, stats.attackSpeed);
  stats.castSpeed = Math.max(0.2, stats.castSpeed);
  stats.critChance = Math.min(0.9, Math.max(0, stats.critChance));
  stats.critMultiplier = Math.max(1.2, stats.critMultiplier);
  return stats;
}

export function partyItemFind(heroes: HeroInstance[]): number {
  return heroes.reduce((sum, h) => sum + computeHeroStats(h).itemFind, 0);
}

export function estimatedDps(hero: HeroInstance): number {
  const def = heroDef(hero.defId);
  const stats = computeHeroStats(hero);
  const rate = def.archetype === "mage" ? stats.castSpeed : stats.attackSpeed;
  const crit = 1 + stats.critChance * (stats.critMultiplier - 1);
  return stats.damage * rate * crit;
}

export function partyGoldFind(heroes: HeroInstance[]): number {
  return heroes.reduce((sum, h) => sum + computeHeroStats(h).goldFind, 0);
}

export function formatStats(stats: CombatStats): string {
  const added = DAMAGE_TYPES.filter((t) => stats.added[t] > 0)
    .map((t) => `${t} +${stats.added[t].toFixed(1)}`)
    .join(", ");
  return [
    `dmg ${stats.damage.toFixed(1)}`,
    `as ${stats.attackSpeed.toFixed(2)}/s`,
    `cs ${stats.castSpeed.toFixed(2)}/s`,
    `range ${stats.range.toFixed(0)} tiles`,
    `crit ${(stats.critChance * 100).toFixed(0)}% x${stats.critMultiplier.toFixed(2)}`,
    `more x${stats.moreDamage.toFixed(2)}`,
    added ? `added ${added}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function formatGem(gem: Gem): string {
  const mods = gem.modifiers.map((m) => `${m.id} ${formatModValue(m)}`).join(", ");
  return `${gem.name} Lv.${gem.level} (${mods})`;
}

export function formatItem(item: Item): string {
  const mods = item.modifiers.map((m) => `${m.id} ${formatModValue(m)}`).join(", ");
  return `[${item.rarity}] ${item.name} {${mods}}`;
}

export function formatModValue(mod: Modifier): string {
  const pct = [
    "increasedDamage",
    "attackSpeed",
    "castSpeed",
    "critChance",
    "critMultiplier",
    "skillDamage",
    "bossDamage",
    "itemFind",
    "goldFind",
    "moreDamage",
    "igniteChance",
    "chillChance",
    "freezeChance",
    "shockChance",
    "chainChance",
    "poisonChance",
    "bleedChance",
    "damageReduction",
  ];
  if (pct.includes(mod.id)) return `${(mod.value * 100).toFixed(0)}%`;
  return mod.value.toFixed(1);
}
