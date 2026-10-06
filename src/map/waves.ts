import type { WaveDef } from "../types.js";

/** Shared 20-wave ladder. Every map uses it until a map needs its own table. */
export const STANDARD_WAVES: WaveDef[] = [
  { wave: 1, delay: 0.5, spawnInterval: 0.7, packs: [{ type: "troop", count: 8 }] },
  { wave: 2, delay: 2, spawnInterval: 0.65, packs: [{ type: "troop", count: 10 }] },
  { wave: 3, delay: 2, spawnInterval: 0.6, packs: [{ type: "troop", count: 8 }, { type: "scout", count: 4 }] },
  { wave: 4, delay: 2.2, spawnInterval: 0.55, packs: [{ type: "troop", count: 8 }, { type: "scout", count: 6 }] },
  { wave: 5, delay: 2.2, spawnInterval: 0.55, packs: [{ type: "troop", count: 8 }, { type: "brute", count: 2 }] },
  { wave: 6, delay: 2.4, spawnInterval: 0.5, packs: [{ type: "troop", count: 8 }, { type: "scout", count: 4 }, { type: "brute", count: 3 }] },
  { wave: 7, delay: 2.4, spawnInterval: 0.5, packs: [{ type: "troop", count: 10 }, { type: "brute", count: 4 }] },
  {
    wave: 8,
    delay: 2.6,
    spawnInterval: 0.7,
    packs: [
      { type: "elite", count: 4, eliteModifiers: ["armoured"] },
      { type: "scout", count: 6 },
    ],
  },
  {
    wave: 9,
    delay: 2.6,
    spawnInterval: 0.5,
    packs: [
      { type: "troop", count: 8 },
      { type: "brute", count: 3 },
      { type: "elite", count: 3, eliteModifiers: ["fast", "regenerating"] },
    ],
  },
  { wave: 10, delay: 2.4, spawnInterval: 0.48, packs: [{ type: "troop", count: 12 }, { type: "scout", count: 6 }] },
  { wave: 11, delay: 2.4, spawnInterval: 0.48, packs: [{ type: "brute", count: 4 }, { type: "scout", count: 6 }] },
  { wave: 12, delay: 2.5, spawnInterval: 0.46, packs: [{ type: "troop", count: 10 }, { type: "elite", count: 2, eliteModifiers: ["fast"] }] },
  { wave: 13, delay: 2.5, spawnInterval: 0.46, packs: [{ type: "brute", count: 3 }, { type: "elite", count: 3, eliteModifiers: ["armoured"] }] },
  { wave: 14, delay: 2.5, spawnInterval: 0.45, packs: [{ type: "scout", count: 8 }, { type: "brute", count: 4 }] },
  { wave: 15, delay: 2.6, spawnInterval: 0.5, packs: [{ type: "elite", count: 4, eliteModifiers: ["regenerating"] }, { type: "troop", count: 8 }] },
  { wave: 16, delay: 2.6, spawnInterval: 0.45, packs: [{ type: "brute", count: 5 }, { type: "elite", count: 2, eliteModifiers: ["fireResistant"] }] },
  { wave: 17, delay: 2.6, spawnInterval: 0.44, packs: [{ type: "scout", count: 8 }, { type: "elite", count: 3, eliteModifiers: ["fast", "armoured"] }] },
  { wave: 18, delay: 2.8, spawnInterval: 0.44, packs: [{ type: "brute", count: 4 }, { type: "elite", count: 4, eliteModifiers: ["criticalResistant"] }] },
  {
    wave: 19,
    delay: 2.8,
    spawnInterval: 0.42,
    packs: [
      { type: "troop", count: 12 },
      { type: "brute", count: 4 },
      { type: "elite", count: 3, eliteModifiers: ["regenerating", "armoured"] },
    ],
  },
  {
    wave: 20,
    delay: 3,
    spawnInterval: 0.8,
    packs: [
      { type: "troop", count: 6 },
      { type: "elite", count: 2, eliteModifiers: ["armoured", "criticalResistant"] },
      { type: "boss", count: 1 },
    ],
  },
];
