/// <reference types="vite/client" />
import type Phaser from "phaser";
import { FRAME, requiredSheets } from "./manaSeed.js";

const sheetUrls = {
  ...import.meta.glob("../../assets/characters/p1/**/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }),
  ...import.meta.glob("../../assets/characters/pONE2/**/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }),
  ...import.meta.glob("../../assets/characters/pONE3/**/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }),
} as Record<string, string>;

const urlByFile = new Map<string, string>();
for (const [path, url] of Object.entries(sheetUrls)) {
  const file = path.split("/").pop() ?? path;
  urlByFile.set(file, url);
}

export function characterTextureKeys(): string[] {
  return requiredSheets().map((sheet) => sheet.key);
}

export function queueCharacterSheets(load: Phaser.Loader.LoaderPlugin): void {
  for (const sheet of requiredSheets()) {
    if (load.scene.textures.exists(sheet.key)) continue;
    const url = urlByFile.get(sheet.file);
    if (!url) throw new Error(`Missing character sheet ${sheet.file}`);
    load.spritesheet(sheet.key, url, { frameWidth: FRAME, frameHeight: FRAME });
  }
}
