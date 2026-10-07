import { heroDef } from "./data.js";
import type { PlayerState } from "./types.js";

/** Bump when the saved document shape changes. */
export const SAVE_VERSION = 1;

/**
 * One row per player. A later login screen will bind credentials to this id;
 * the save itself stays the same document the server would store.
 */
export const SAVE_KEY = "3k-chibi.player";

export interface PlayerAccount {
  id: string;
  createdAt: string;
}

export interface MapSetup {
  mapId: string;
  placements: Array<{ heroId: string; slotId: string }>;
}

export interface GameSave {
  version: typeof SAVE_VERSION;
  account: PlayerAccount;
  player: PlayerState;
  mapId: string;
  setups: MapSetup[];
  clearedMaps: string[];
}

export interface SaveStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function browserStore(): SaveStore {
  return {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
  };
}

export function createAccount(): PlayerAccount {
  const id = globalThis.crypto?.randomUUID?.() ?? `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return { id, createdAt: new Date().toISOString() };
}

export function loadGame(store: SaveStore): GameSave | null {
  const raw = store.get(SAVE_KEY);
  if (!raw) return null;
  try {
    return normalizeSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeGame(store: SaveStore, save: GameSave): void {
  store.set(SAVE_KEY, JSON.stringify(save));
}

function normalizeSave(value: unknown): GameSave | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Partial<GameSave>;
  if (doc.version !== SAVE_VERSION) return null;
  if (!doc.account || typeof doc.account.id !== "string" || !doc.account.id) return null;
  const player = normalizePlayer(doc.player);
  if (!player) return null;
  const setups = Array.isArray(doc.setups)
    ? doc.setups.flatMap((setup) => {
        if (!setup || typeof setup.mapId !== "string") return [];
        const placements = Array.isArray(setup.placements)
          ? setup.placements.filter(
              (entry): entry is { heroId: string; slotId: string } =>
                Boolean(entry) &&
                typeof entry.heroId === "string" &&
                typeof entry.slotId === "string" &&
                player.heroes.some((hero) => hero.id === entry.heroId),
            )
          : [];
        return [{ mapId: setup.mapId, placements }];
      })
    : [];
  return {
    version: SAVE_VERSION,
    account: { id: doc.account.id, createdAt: typeof doc.account.createdAt === "string" ? doc.account.createdAt : "" },
    player,
    mapId: typeof doc.mapId === "string" ? doc.mapId : "",
    setups,
    clearedMaps: Array.isArray(doc.clearedMaps) ? doc.clearedMaps.filter((id): id is string => typeof id === "string") : [],
  };
}

function normalizePlayer(value: unknown): PlayerState | null {
  if (!value || typeof value !== "object") return null;
  const player = value as Partial<PlayerState>;
  if (!Array.isArray(player.heroes) || player.heroes.length === 0) return null;
  const heroes = player.heroes.filter((hero) => {
    if (!hero || typeof hero.id !== "string" || typeof hero.defId !== "string") return false;
    try {
      heroDef(hero.defId);
    } catch {
      return false;
    }
    hero.equipment ??= {};
    hero.gems ??= [];
    const main = hero.equipment.mainHand;
    const off = hero.equipment.offHand;
    if (main && off && main.id === off.id) hero.equipment.offHand = main;
    return true;
  });
  if (heroes.length === 0) return null;
  return {
    gold: numberOr(player.gold, 0),
    energy: numberOr(player.energy, 0),
    heroes,
    inventory: Array.isArray(player.inventory) ? player.inventory : [],
    gems: Array.isArray(player.gems) ? player.gems : [],
    fragments: player.fragments && typeof player.fragments === "object" ? player.fragments : {},
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
