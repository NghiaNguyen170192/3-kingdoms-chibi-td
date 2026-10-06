import { describe, expect, it } from "vitest";
import { BattleRuntime, choosePathIndex } from "../src/battle.js";
import { MAPS, MVP_MAP } from "../src/data.js";
import { generateTiles, playMap } from "../src/map/tiles.js";
import { createHero } from "../src/player.js";
import { Rng } from "../src/rng.js";
import type { MapDef } from "../src/types.js";

function destsOf(map: MapDef, entryId: string): string[] {
  return [...new Set(map.paths.filter((path) => path.entryId === entryId).map((path) => path.destinationId))];
}

describe("baked npc paths", () => {
  it("keeps Hulao as two gates into one castle", () => {
    expect(MVP_MAP.paths).toHaveLength(2);
    expect(new Set(MVP_MAP.paths.map((path) => path.destinationId)).size).toBe(1);
    expect(MVP_MAP.routes.map((route) => route.waypoints)).toEqual(MVP_MAP.paths.map((path) => path.waypoints));
    const ends = MVP_MAP.paths.map((path) => path.waypoints.at(-1));
    expect(ends[0]).toEqual(ends[1]);
    expect(ends[0]).toEqual({ x: 220, y: 70 });
  });

  it("bakes every map once, with each gate able to reach every castle", () => {
    expect(MAPS.map((map) => map.id)).toEqual([
      "hulao-pass",
      "red-wall",
      "changban",
      "snow-camp",
      "luoyang-yard",
      "chibi-sands",
    ]);
    for (const map of MAPS) {
      const entries = [...new Set(map.paths.map((path) => path.entryId))];
      const dests = [...new Set(map.paths.map((path) => path.destinationId))];
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.length).toBeLessThanOrEqual(3);
      expect(dests.length).toBeGreaterThanOrEqual(1);
      expect(dests.length).toBeLessThanOrEqual(2);
      for (const entry of entries) {
        expect(destsOf(map, entry).sort()).toEqual([...dests].sort());
      }
      const castles = generateTiles(map).flat().filter((tile) => tile.kind === "castle");
      expect(castles).toHaveLength(dests.length);
    }
  });

  it("gives a forked map two castles and randomizes the stored walk", () => {
    const map = MAPS.find((item) => item.id === "red-wall")!;
    expect(map.paths).toHaveLength(4);
    const rng = new Rng(4);
    const chosen = Array.from({ length: 40 }, (_, spawn) => map.paths[choosePathIndex(map, rng, spawn)]!);
    const west = chosen.filter((path) => path.entryId === "west");
    const east = chosen.filter((path) => path.entryId === "east");
    expect(new Set(west.map((path) => path.destinationId)).size).toBe(2);
    expect(new Set(east.map((path) => path.destinationId)).size).toBe(2);

    const again = new Rng(4);
    const repeat = Array.from({ length: 40 }, (_, spawn) => choosePathIndex(map, again, spawn));
    expect(repeat).toEqual(chosen.map((path) => map.paths.indexOf(path)));
  });

  it("does not roll a path when the gate has one castle", () => {
    const rng = new Rng(1);
    expect(choosePathIndex(MVP_MAP, rng, 0)).toBe(0);
    expect(choosePathIndex(MVP_MAP, rng, 1)).toBe(1);
    expect(choosePathIndex(MVP_MAP, rng, 2)).toBe(0);
    expect(rng.next()).toBe(new Rng(1).next());
  });

  it("sends spawned troops down different baked walks on a forked map", () => {
    const map = playMap(MAPS.find((item) => item.id === "changban")!);
    const runtime = new BattleRuntime([{ hero: createHero("zhao-yun"), slotId: map.slots[0]!.id }], {
      seed: 9,
      map,
      autoNextWave: true,
    });
    runtime.step(8);
    const dests = new Set(runtime.enemies.map((enemy) => map.paths[enemy.routeIndex]!.destinationId));
    expect(runtime.enemies.length).toBeGreaterThan(4);
    expect(dests.size).toBe(2);
  });
});
