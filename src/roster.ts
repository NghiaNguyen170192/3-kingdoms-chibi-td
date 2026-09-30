import { RARITY_ORDER, heroDef } from "./data.js";
import { estimatedDps } from "./stats.js";
import type { HeroArchetype, HeroInstance } from "./types.js";

export type RosterSort = "dps-desc" | "dps-asc" | "rarity" | "favorite";

export interface RosterQuery {
  search?: string;
  type?: HeroArchetype | "";
  sort?: RosterSort;
}

export function queryRoster(heroes: HeroInstance[], query: RosterQuery = {}): HeroInstance[] {
  const search = (query.search ?? "").trim().toLowerCase();
  const type = query.type ?? "";
  const sort = query.sort ?? "dps-desc";

  let list = heroes.filter((hero) => {
    const def = heroDef(hero.defId);
    if (type && def.archetype !== type) return false;
    if (!search) return true;
    const hay = [def.id, def.name, def.archetype, hero.rarity].map(normalize).join(" ");
    return hay.includes(normalize(search));
  });

  list = [...list].sort((a, b) => {
    const da = heroDef(a.defId);
    const db = heroDef(b.defId);
    if (sort === "dps-asc") return estimatedDps(a) - estimatedDps(b);
    if (sort === "dps-desc") return estimatedDps(b) - estimatedDps(a);
    if (sort === "rarity") return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
    if (sort === "favorite") {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return estimatedDps(b) - estimatedDps(a);
    }
    return 0;
  });
  return list;
}

export const ARCHETYPE_COLORS: Record<HeroArchetype, number> = {
  speed: 0x4aa3ff,
  damager: 0xe24b4b,
  mage: 0xb56bff,
};

export function heroColor(defId: string): number {
  return ARCHETYPE_COLORS[heroDef(defId).archetype];
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}
