import { GEM_FAMILIES, GEM_MERGE, GEM_NAMES, GEM_PROGRESSION } from "./data.js";
import { createId, type Rng } from "./rng.js";
import type { Gem, GemFamily, HeroInstance } from "./types.js";

export function createGem(family: GemFamily, level = 1): Gem {
  const ranks = GEM_PROGRESSION[family];
  const rank = Math.min(Math.max(level, 1), ranks.length);
  const def = ranks[rank - 1]!;
  return {
    id: createId("gem"),
    family,
    name: GEM_NAMES[family],
    level: rank,
    modifiers: [def.primary, ...def.extras].map((m) => ({ ...m })),
  };
}

export function randomGem(rng: Rng, level = 1): Gem {
  return createGem(rng.pick(GEM_FAMILIES), level);
}

export function mergeGems(gems: Gem[]): Gem {
  if (gems.length !== GEM_MERGE.inputCount) {
    throw new Error(`Need ${GEM_MERGE.inputCount} gems to merge`);
  }
  const family = gems[0]!.family;
  const level = gems[0]!.level;
  if (!gems.every((g) => g.family === family && g.level === level)) {
    throw new Error("Merge requires 3 identical gems (same family and level)");
  }
  const max = GEM_PROGRESSION[family].length;
  if (level >= max) throw new Error("Gem is already at maximum level");
  return createGem(family, level + 1);
}

export function gemMergeGroups(gems: Gem[]): Gem[][] {
  const buckets = new Map<string, Gem[]>();
  for (const gem of gems) {
    const key = `${gem.family}:${gem.level}`;
    const list = buckets.get(key) ?? [];
    list.push(gem);
    buckets.set(key, list);
  }
  return [...buckets.values()].filter((g) => g.length >= GEM_MERGE.inputCount);
}

export function socketGem(hero: HeroInstance, socketIndex: number, gem: Gem): Gem | null {
  if (socketIndex < 0 || socketIndex >= hero.gems.length) {
    throw new Error("Invalid gem socket");
  }
  const previous = hero.gems[socketIndex] ?? null;
  hero.gems[socketIndex] = gem;
  return previous;
}

export function unsocketGem(hero: HeroInstance, socketIndex: number): Gem | null {
  const previous = hero.gems[socketIndex] ?? null;
  hero.gems[socketIndex] = null;
  return previous;
}

export function maxGemLevel(family: GemFamily): number {
  return GEM_PROGRESSION[family].length;
}
