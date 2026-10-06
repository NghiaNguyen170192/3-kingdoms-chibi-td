import type { BakedPath, MapDef, Vec2, WaveDef } from "../types.js";

/** Same scale as `TILE_WORLD` in tiles.ts. Kept local so baking does not import the renderer. */
const TILE_WORLD = 10;

const MAP_COLS = 23;
const MAP_ROWS = 15;
/** Equal-length forks stay; longer detours are dropped so the list stays small. */
const MAX_PATHS_PER_GOAL = 4;

export interface RoadPoint {
  id: string;
  col: number;
  row: number;
}

export interface RoadSketch {
  id: string;
  name: string;
  castleHp: number;
  /**
   * Orthogonal polylines in tile coordinates. A cell shared by two strokes
   * is a junction. Diagonals are rejected so the baked walk matches the paint.
   */
  strokes: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  entries: readonly RoadPoint[];
  destinations: readonly RoadPoint[];
  waves: WaveDef[];
  ground?: MapDef["ground"];
}

interface Cell {
  col: number;
  row: number;
}

/**
 * Turn a fixed road into waypoint lists. Called once per map at module load.
 * Fight code never calls this.
 */
export function bakeMap(sketch: RoadSketch): MapDef {
  const graph = buildGraph(sketch);
  const terminals = new Set(sketch.destinations.map((dest) => key(dest.col, dest.row)));
  const paths: BakedPath[] = [];
  for (const entry of sketch.entries) {
    const start = key(entry.col, entry.row);
    if (!graph.has(start)) {
      throw new Error(`${sketch.id}: entry ${entry.id} is not on the road`);
    }
    for (const dest of sketch.destinations) {
      const goal = key(dest.col, dest.row);
      if (!graph.has(goal)) {
        throw new Error(`${sketch.id}: destination ${dest.id} is not on the road`);
      }
      const found = shortestPaths(graph, start, goal, terminals);
      if (found.length === 0) {
        throw new Error(`${sketch.id}: ${entry.id} cannot reach ${dest.id}`);
      }
      found.forEach((cells, index) => {
        const suffix = found.length > 1 ? `-${index + 1}` : "";
        paths.push({
          id: `${entry.id}-to-${dest.id}${suffix}`,
          entryId: entry.id,
          destinationId: dest.id,
          waypoints: corners(cells),
        });
      });
    }
  }
  return {
    id: sketch.id,
    name: sketch.name,
    castleHp: sketch.castleHp,
    ground: sketch.ground,
    paths,
    routes: paths.map((path) => ({ id: path.id, waypoints: path.waypoints })),
    slots: [],
    waves: sketch.waves,
  };
}

function buildGraph(sketch: RoadSketch): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const add = (cell: Cell) => {
    if (cell.col < 0 || cell.row < 0 || cell.col >= MAP_COLS || cell.row >= MAP_ROWS) {
      throw new Error(`${sketch.id}: tile ${cell.col},${cell.row} is outside the map`);
    }
    const id = key(cell.col, cell.row);
    if (!graph.has(id)) graph.set(id, []);
    return id;
  };
  const link = (a: string, b: string) => {
    if (a === b) return;
    const left = graph.get(a)!;
    const right = graph.get(b)!;
    if (!left.includes(b)) left.push(b);
    if (!right.includes(a)) right.push(a);
  };
  for (const stroke of sketch.strokes) {
    if (stroke.length === 0) throw new Error(`${sketch.id}: empty stroke`);
    let prev = add({ col: stroke[0]![0], row: stroke[0]![1] });
    for (let i = 1; i < stroke.length; i++) {
      const from = parseKey(prev);
      const col = stroke[i]![0];
      const row = stroke[i]![1];
      const dc = col - from.col;
      const dr = row - from.row;
      if (dc !== 0 && dr !== 0) {
        throw new Error(`${sketch.id}: diagonal stroke at ${from.col},${from.row} -> ${col},${row}`);
      }
      const steps = Math.max(Math.abs(dc), Math.abs(dr));
      const sx = Math.sign(dc);
      const sy = Math.sign(dr);
      for (let step = 1; step <= steps; step++) {
        const next = add({ col: from.col + sx * step, row: from.row + sy * step });
        link(prev, next);
        prev = next;
      }
    }
  }
  for (const neighbors of graph.values()) neighbors.sort();
  return graph;
}

/** All shortest paths, capped. Parent links come from one BFS. */
function shortestPaths(
  graph: Map<string, string[]>,
  start: string,
  goal: string,
  terminals: Set<string>,
): Cell[][] {
  const dist = new Map<string, number>([[start, 0]]);
  const parents = new Map<string, string[]>();
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur !== start && terminals.has(cur)) continue;
    const nextDist = dist.get(cur)! + 1;
    for (const neighbor of graph.get(cur) ?? []) {
      const known = dist.get(neighbor);
      if (known === undefined) {
        dist.set(neighbor, nextDist);
        parents.set(neighbor, [cur]);
        queue.push(neighbor);
      } else if (known === nextDist) {
        const list = parents.get(neighbor)!;
        if (!list.includes(cur)) list.push(cur);
      }
    }
  }
  if (!dist.has(goal)) return [];

  const out: Cell[][] = [];
  const stack: Array<{ node: string; path: string[] }> = [{ node: goal, path: [goal] }];
  while (stack.length > 0 && out.length < MAX_PATHS_PER_GOAL) {
    const item = stack.pop()!;
    if (item.node === start) {
      out.push(item.path.reverse().map(parseKey));
      continue;
    }
    for (const parent of parents.get(item.node) ?? []) {
      stack.push({ node: parent, path: [...item.path, parent] });
    }
  }
  return out;
}

function corners(cells: Cell[]): Vec2[] {
  const kept: Cell[] = [cells[0]!];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = cells[i - 1]!;
    const b = cells[i]!;
    const c = cells[i + 1]!;
    if (b.col - a.col !== c.col - b.col || b.row - a.row !== c.row - b.row) kept.push(b);
  }
  if (cells.length > 1) kept.push(cells[cells.length - 1]!);
  return kept.map((cell) => ({ x: cell.col * TILE_WORLD, y: cell.row * TILE_WORLD }));
}

function key(col: number, row: number): string {
  return `${col},${row}`;
}

function parseKey(id: string): Cell {
  const [col, row] = id.split(",").map(Number) as [number, number];
  return { col, row };
}
