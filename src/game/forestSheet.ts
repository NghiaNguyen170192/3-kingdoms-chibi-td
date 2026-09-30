/// <reference types="vite/client" />
import type Phaser from "phaser";

const urls = import.meta.glob("../../assets/maps/gentle sheets/gentle forest v01.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const FOREST_KEY = "forest";
export const FOREST_TILE = 16;
export const FOREST_COLS = 16;

const FOREST_URL = Object.values(urls)[0];

export function queueForestSheet(loader: Phaser.Loader.LoaderPlugin): void {
  if (!FOREST_URL) throw new Error("Gentle Forest sheet is missing");
  loader.spritesheet(FOREST_KEY, FOREST_URL, { frameWidth: FOREST_TILE, frameHeight: FOREST_TILE });
}
