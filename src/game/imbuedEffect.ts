/// <reference types="vite/client" />
import Phaser from "phaser";
import type { ImbuedElement } from "../types.js";

export const EFFECT_FRAME = 64;

/**
 * Sheets in assets/effects are 9 color rows, top to bottom:
 * coral, purple, blue, green, gold, white, tan, red, indigo.
 * Cold, toxic, fire, and bleed use the painted row. Lightning tints the
 * white row yellow so it stays distinct from the gold and red rows.
 */
interface EffectDef {
  key: string;
  columns: number;
  frameCount: number;
  row: number;
  tint?: number;
}

export const IMBUED_EFFECTS: Record<ImbuedElement, EffectDef> = {
  lightning: { key: "fx:lightning", columns: 14, frameCount: 14, row: 5, tint: 0xffe84a },
  cold: { key: "fx:cold", columns: 12, frameCount: 12, row: 2 },
  fire: { key: "fx:fire", columns: 12, frameCount: 11, row: 7 },
  toxic: { key: "fx:toxic", columns: 12, frameCount: 12, row: 3 },
  bleed: { key: "fx:bleed", columns: 11, frameCount: 11, row: 7 },
};

const FILES: Record<ImbuedElement, string> = {
  lightning: "195.png",
  cold: "185.png",
  fire: "484.png",
  toxic: "135.png",
  bleed: "506.png",
};

function effectUrls(): Record<string, string> {
  const groups = [
    import.meta.glob("../../assets/effects/Part 4/195.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
    import.meta.glob("../../assets/effects/Part 4/185.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
    import.meta.glob("../../assets/effects/Part 10/484.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
    import.meta.glob("../../assets/effects/Part 3/135.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
    import.meta.glob("../../assets/effects/Part 11/506.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ] as Record<string, string>[];
  const byFile: Record<string, string> = {};
  for (const group of groups) {
    for (const [path, url] of Object.entries(group)) {
      byFile[path.split("/").pop() ?? path] = url;
    }
  }
  return byFile;
}

const urlByFile = effectUrls();

export function queueImbuedEffects(load: Phaser.Loader.LoaderPlugin): void {
  for (const element of Object.keys(FILES) as ImbuedElement[]) {
    const def = IMBUED_EFFECTS[element];
    if (load.scene.textures.exists(def.key)) continue;
    const url = urlByFile[FILES[element]];
    if (!url) throw new Error(`Missing effect sheet ${FILES[element]}`);
    load.spritesheet(def.key, url, { frameWidth: EFFECT_FRAME, frameHeight: EFFECT_FRAME });
  }
}

export function registerImbuedEffects(scene: Phaser.Scene): void {
  for (const def of Object.values(IMBUED_EFFECTS)) {
    if (!scene.textures.exists(def.key)) continue;
    scene.textures.get(def.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (scene.anims.exists(def.key)) continue;
    const start = def.row * def.columns;
    scene.anims.create({
      key: def.key,
      frames: scene.anims.generateFrameNumbers(def.key, {
        start,
        end: start + def.frameCount - 1,
      }),
      frameRate: 20,
      repeat: 0,
    });
  }
}

export function spawnImbuedEffect(
  scene: Phaser.Scene,
  element: ImbuedElement,
  x: number,
  y: number,
  depth: number,
  scale: number,
): Phaser.GameObjects.Sprite {
  const def = IMBUED_EFFECTS[element];
  const sprite = scene.add
    .sprite(x, y, def.key, def.row * def.columns)
    .setOrigin(0.5, 0.5)
    .setScale(scale)
    .setDepth(depth);
  if (def.tint != null) sprite.setTint(def.tint);
  sprite.play(def.key);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  return sprite;
}
