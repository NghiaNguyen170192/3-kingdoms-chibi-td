import { describe, expect, it } from "vitest";
import { HERO_DEFS } from "../src/data.js";
import { createHero } from "../src/player.js";
import { queryRoster } from "../src/roster.js";
import { estimatedDps } from "../src/stats.js";
import { resetIds } from "../src/rng.js";

describe("roster", () => {
  it("has five heroes of each archetype", () => {
    expect(HERO_DEFS.filter((h) => h.archetype === "speed")).toHaveLength(5);
    expect(HERO_DEFS.filter((h) => h.archetype === "damager")).toHaveLength(5);
    expect(HERO_DEFS.filter((h) => h.archetype === "mage")).toHaveLength(5);
  });

  it("filters by type and search text", () => {
    resetIds();
    const heroes = HERO_DEFS.map((h) => createHero(h.id));
    const mages = queryRoster(heroes, { type: "mage", sort: "dps-desc" });
    expect(mages.every((h) => HERO_DEFS.find((d) => d.id === h.defId)?.archetype === "mage")).toBe(true);
    expect(mages).toHaveLength(5);
    const named = queryRoster(heroes, { search: "lu bu" });
    expect(named.map((h) => h.defId)).toContain("lu-bu");
  });

  it("sorts DPS high to low by default and can reverse", () => {
    resetIds();
    const heroes = HERO_DEFS.map((h) => createHero(h.id));
    const high = queryRoster(heroes, { sort: "dps-desc" });
    const low = queryRoster(heroes, { sort: "dps-asc" });
    expect(estimatedDps(high[0]!)).toBeGreaterThanOrEqual(estimatedDps(high.at(-1)!));
    expect(low[0]!.defId).toBe(high.at(-1)!.defId);
  });

  it("sorts favorites first", () => {
    resetIds();
    const heroes = HERO_DEFS.map((h) => createHero(h.id));
    const guo = heroes.find((h) => h.defId === "guo-jia")!;
    guo.favorite = true;
    const sorted = queryRoster(heroes, { sort: "favorite" });
    expect(sorted[0]!.defId).toBe("guo-jia");
  });

  it("sorts by rarity with mythic first", () => {
    resetIds();
    const heroes = HERO_DEFS.map((h) => createHero(h.id));
    const sorted = queryRoster(heroes, { sort: "rarity" });
    expect(sorted[0]!.defId).toBe("lu-bu");
  });
});
