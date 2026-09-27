import { describe, expect, it } from "vitest";
import { MVP_MAP } from "../src/data.js";
import {
  PLACEABLE_SIDE_DEPTH,
  ROUTE_COLOR,
  chebyshevTiles,
  generateTiles,
  placeableTiles,
  tileCenter,
} from "../src/map/tiles.js";

describe("tile map", () => {
  it("colors every tile and uses one color for all route tiles", () => {
    const grid = generateTiles(MVP_MAP);
    const tiles = grid.flat();
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => typeof t.color === "number")).toBe(true);

    const routes = tiles.filter((t) => t.kind === "route");
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.every((t) => t.color === ROUTE_COLOR)).toBe(true);
  });

  it("makes a 3-tile band on each side of the route placeable, not the road itself", () => {
    const grid = generateTiles(MVP_MAP);
    const slots = placeableTiles(grid);
    expect(slots.length).toBeGreaterThan(20);
    expect(slots.every((t) => t.kind === "grass")).toBe(true);
    expect(slots.every((t) => t.slotId)).toBe(true);
    expect(grid.flat().filter((t) => t.kind === "route").every((t) => !t.placeable)).toBe(true);

    const route = grid.flat().find((t) => t.kind === "route" && t.row === 2)!;
    for (let d = 1; d <= PLACEABLE_SIDE_DEPTH; d++) {
      expect(grid[route.row + d]![route.col]!.placeable).toBe(true);
    }
    expect(grid[route.row]![route.col]!.placeable).toBe(false);
  });

  it("treats adjacent tiles as distance 1", () => {
    const a = tileCenter(5, 5);
    expect(chebyshevTiles(a.x, a.y, tileCenter(6, 5).x, tileCenter(6, 5).y)).toBe(1);
    expect(chebyshevTiles(a.x, a.y, tileCenter(6, 6).x, tileCenter(6, 6).y)).toBe(1);
    expect(chebyshevTiles(a.x, a.y, tileCenter(7, 5).x, tileCenter(7, 5).y)).toBe(2);
    expect(chebyshevTiles(a.x, a.y, tileCenter(8, 5).x, tileCenter(8, 5).y)).toBe(3);
  });

  it("has a castle tile at the shared destination", () => {
    const tiles = generateTiles(MVP_MAP).flat();
    expect(tiles.filter((t) => t.kind === "castle")).toHaveLength(1);
    expect(tiles.find((t) => t.kind === "castle")!.placeable).toBe(false);
  });
});
