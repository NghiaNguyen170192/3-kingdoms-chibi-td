import { bakeMap, type RoadSketch } from "./paths.js";
import { STANDARD_WAVES } from "./waves.js";
import type { MapDef } from "../types.js";

/**
 * Road sketches. `bakeMap` runs once at load and stores the walks on `paths`.
 * Layouts follow the reference screenshots: twin corridors, a stone snake,
 * a snow split, a walled court, and a banner field.
 */
const SKETCHES: RoadSketch[] = [
  {
    id: "hulao-pass",
    name: "Hulao Pass",
    castleHp: 20,
    strokes: [
      [
        [0, 2],
        [8, 2],
        [8, 7],
        [22, 7],
      ],
      [
        [0, 12],
        [8, 12],
        [8, 7],
      ],
    ],
    entries: [
      { id: "north", col: 0, row: 2 },
      { id: "south", col: 0, row: 12 },
    ],
    destinations: [{ id: "gate", col: 22, row: 7 }],
    waves: STANDARD_WAVES,
  },
  {
    id: "red-wall",
    name: "Red Wall",
    castleHp: 20,
    ground: "sand",
    strokes: [
      [
        [6, 0],
        [6, 14],
      ],
      [
        [16, 0],
        [16, 14],
      ],
      [
        [6, 7],
        [16, 7],
      ],
    ],
    entries: [
      { id: "west", col: 6, row: 0 },
      { id: "east", col: 16, row: 0 },
    ],
    destinations: [
      { id: "west-keep", col: 6, row: 14 },
      { id: "east-keep", col: 16, row: 14 },
    ],
    waves: STANDARD_WAVES,
  },
  {
    id: "changban",
    name: "Changban",
    castleHp: 20,
    strokes: [
      [
        [0, 2],
        [8, 2],
        [8, 5],
        [3, 5],
        [3, 8],
        [14, 8],
      ],
      [
        [14, 0],
        [14, 8],
      ],
      [
        [14, 8],
        [22, 8],
        [22, 3],
      ],
      [
        [14, 8],
        [14, 12],
        [22, 12],
      ],
    ],
    entries: [
      { id: "west", col: 0, row: 2 },
      { id: "north", col: 14, row: 0 },
    ],
    destinations: [
      { id: "north-keep", col: 22, row: 3 },
      { id: "south-keep", col: 22, row: 12 },
    ],
    waves: STANDARD_WAVES,
  },
  {
    id: "snow-camp",
    name: "Snow Camp",
    castleHp: 20,
    ground: "snow",
    strokes: [
      [
        [10, 0],
        [10, 4],
      ],
      [
        [0, 7],
        [5, 7],
      ],
      [
        [10, 4],
        [5, 4],
        [5, 9],
        [10, 9],
      ],
      [
        [10, 4],
        [17, 4],
        [17, 9],
        [10, 9],
      ],
      [
        [5, 9],
        [5, 13],
      ],
      [
        [17, 9],
        [21, 9],
        [21, 13],
      ],
    ],
    entries: [
      { id: "top", col: 10, row: 0 },
      { id: "west", col: 0, row: 7 },
    ],
    destinations: [
      { id: "tower", col: 5, row: 13 },
      { id: "castle", col: 21, row: 13 },
    ],
    waves: STANDARD_WAVES,
  },
  {
    id: "luoyang-yard",
    name: "Luoyang Yard",
    castleHp: 20,
    strokes: [
      [
        [11, 0],
        [11, 4],
      ],
      [
        [0, 7],
        [6, 7],
      ],
      [
        [6, 4],
        [16, 4],
      ],
      [
        [6, 4],
        [6, 11],
      ],
      [
        [16, 4],
        [16, 11],
      ],
      [
        [6, 11],
        [16, 11],
      ],
      [
        [16, 11],
        [21, 11],
        [21, 13],
      ],
      [
        [6, 11],
        [2, 11],
        [2, 13],
      ],
    ],
    entries: [
      { id: "north", col: 11, row: 0 },
      { id: "west", col: 0, row: 7 },
    ],
    destinations: [
      { id: "water-keep", col: 21, row: 13 },
      { id: "gate", col: 2, row: 13 },
    ],
    waves: STANDARD_WAVES,
  },
  {
    id: "chibi-sands",
    name: "Chibi Sands",
    castleHp: 20,
    ground: "sand",
    strokes: [
      [
        [1, 2],
        [21, 2],
      ],
      [
        [4, 2],
        [4, 11],
      ],
      [
        [18, 2],
        [18, 11],
      ],
      [
        [4, 11],
        [18, 11],
      ],
      [
        [18, 11],
        [21, 11],
        [21, 13],
      ],
      [
        [4, 11],
        [1, 11],
        [1, 13],
      ],
    ],
    entries: [
      { id: "west", col: 1, row: 2 },
      { id: "east", col: 21, row: 2 },
    ],
    destinations: [
      { id: "east-keep", col: 21, row: 13 },
      { id: "west-keep", col: 1, row: 13 },
    ],
    waves: STANDARD_WAVES,
  },
];

export const MAPS: MapDef[] = SKETCHES.map(bakeMap);

export const MVP_MAP: MapDef = MAPS[0]!;

export function mapById(id: string): MapDef {
  const found = MAPS.find((map) => map.id === id);
  if (!found) throw new Error(`Unknown map ${id}`);
  return found;
}
