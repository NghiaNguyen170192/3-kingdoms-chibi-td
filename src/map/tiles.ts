import { MVP_MAP } from "../data.js";
import type { DeploySlot, MapDef } from "../types.js";

export const TILE_WORLD = 10;
export const TILE_PX = 40;
export const MAP_PAD = 24;
export const MAP_COLS = 23;
export const MAP_ROWS = 15;
/** Bottom band for the dock. These cells are not part of the battlefield. */
export const UI_ROWS = 2;

/** Every path tile uses this fill so both routes read as one road. */
export const ROUTE_COLOR = 0xc9a66b;
export const GRASS_A = 0x2f6a32;
export const GRASS_B = 0x4f8a3c;
export const CASTLE_COLOR = 0x8e3434;
export const SLOT_BORDER = 0x3dff6a;
/** How far off the road a hero can stand, on each side. */
export const PLACEABLE_SIDE_DEPTH = 3;

export interface MapTile {
  col: number;
  row: number;
  kind: "grass" | "route" | "castle";
  placeable: boolean;
  slotId?: string;
  color: number;
  /** Cell on the Gentle Forest sheet (`gentle forest v01.png`, 16px). */
  sheetCol: number;
  sheetRow: number;
}

/** Chebyshev tile distance — adjacent including diagonals is 1. */
export function chebyshevTiles(ax: number, ay: number, bx: number, by: number): number {
  const a = worldToTile(ax, ay);
  const b = worldToTile(bx, by);
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function worldToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.round(x / TILE_WORLD),
    row: Math.round(y / TILE_WORLD),
  };
}

export function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_WORLD, y: row * TILE_WORLD };
}

export function worldToScreen(x: number, y: number): { x: number; y: number } {
  return {
    x: MAP_PAD + (x / TILE_WORLD) * TILE_PX + TILE_PX / 2,
    y: MAP_PAD + (y / TILE_WORLD) * TILE_PX + TILE_PX / 2,
  };
}

export function tileToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: MAP_PAD + col * TILE_PX + TILE_PX / 2,
    y: MAP_PAD + row * TILE_PX + TILE_PX / 2,
  };
}

export function generateTiles(map: MapDef = MVP_MAP): MapTile[][] {
  const grid: MapTile[][] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line: MapTile[] = [];
    for (let col = 0; col < MAP_COLS; col++) {
      line.push({
        col,
        row,
        kind: "grass",
        placeable: false,
        color: (col + row) % 2 === 0 ? GRASS_A : GRASS_B,
        sheetCol: (col + row) % 2 === 0 ? 1 : 2,
        sheetRow: 5,
      });
    }
    grid.push(line);
  }

  const center = new Set<string>();
  for (const route of map.routes) {
    for (let i = 1; i < route.waypoints.length; i++) {
      const a = worldToTile(route.waypoints[i - 1]!.x, route.waypoints[i - 1]!.y);
      const b = worldToTile(route.waypoints[i]!.x, route.waypoints[i]!.y);
      for (const [col, row] of bresenham(a.col, a.row, b.col, b.row)) center.add(`${col},${row}`);
    }
  }
  for (const key of center) {
    const [col, row] = key.split(",").map(Number) as [number, number];
    const tile = getTile(grid, col, row);
    if (!tile) continue;
    tile.kind = "route";
    tile.color = ROUTE_COLOR;
  }

  const ends = map.paths?.length
    ? map.paths.map((path) => path.waypoints.at(-1))
    : map.routes.map((route) => route.waypoints.at(-1));
  for (const dest of ends) {
    if (!dest) continue;
    const { col, row } = worldToTile(dest.x, dest.y);
    const tile = getTile(grid, col, row);
    if (tile) {
      tile.kind = "castle";
      tile.color = CASTLE_COLOR;
    }
  }

  paintRoad(grid);
  markPlaceableSides(grid);
  return grid;
}

/** Solid dirt on the walk line only. Tiles beside the route stay grass, including placeable ones. */
function paintRoad(grid: MapTile[][]): void {
  for (const tile of grid.flat()) {
    if (tile.kind !== "route" && tile.kind !== "castle") continue;
    tile.sheetCol = 2;
    tile.sheetRow = 1;
  }
}

/** Grass beside the road: up to 3 tiles on each cardinal side of every route tile. */
function markPlaceableSides(grid: MapTile[][]): void {
  const routeCells = grid.flat().filter((t) => t.kind === "route" || t.kind === "castle");
  const dirs: Array<[number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (const route of routeCells) {
    for (const [dc, dr] of dirs) {
      for (let dist = 1; dist <= PLACEABLE_SIDE_DEPTH; dist++) {
        const tile = getTile(grid, route.col + dc * dist, route.row + dr * dist);
        if (!tile || tile.kind === "route" || tile.kind === "castle") break;
        tile.placeable = true;
        tile.slotId = `slot-${tile.col}-${tile.row}`;
      }
    }
  }
}

export function slotsFromTiles(grid: MapTile[][]): DeploySlot[] {
  const roads = grid.flat().filter((t) => t.kind === "route" || t.kind === "castle");
  return placeableTiles(grid)
    .map((t) => {
      const center = tileCenter(t.col, t.row);
      const roadDist = Math.min(
        ...roads.map((r) => Math.max(Math.abs(r.col - t.col), Math.abs(r.row - t.row))),
      );
      return { id: t.slotId ?? `slot-${t.col}-${t.row}`, x: center.x, y: center.y, roadDist, row: t.row };
    })
    .sort((a, b) => a.roadDist - b.roadDist || a.row - b.row || a.x - b.x)
    .map(({ id, x, y }) => ({ id, x, y }));
}

export function playMap(base: MapDef = MVP_MAP): MapDef {
  return { ...base, slots: slotsFromTiles(generateTiles(base)) };
}

export function placeableTiles(grid: MapTile[][]): MapTile[] {
  return grid.flat().filter((t) => t.placeable);
}

function getTile(grid: MapTile[][], col: number, row: number): MapTile | null {
  if (row < 0 || col < 0 || row >= grid.length || col >= (grid[0]?.length ?? 0)) return null;
  return grid[row]![col]!;
}

function bresenham(c0: number, r0: number, c1: number, r1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let x = c0;
  let y = r0;
  const dx = Math.abs(c1 - c0);
  const dy = Math.abs(r1 - r0);
  const sx = c0 < c1 ? 1 : -1;
  const sy = r0 < r1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    out.push([x, y]);
    if (x === c1 && y === r1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
