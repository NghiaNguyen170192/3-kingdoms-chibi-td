/** Mana Seed character base (free demo). One body, layered paper-doll parts. */

import type { ImbuedElement } from "../types.js";

export const FRAME = 64;
export const SHEET_COLS = 8;
/** Feet sit on this row of the 64px cell. */
export const FEET_ROW = 44;
export const SPRITE_SCALE = 2;

export type Page = "p1" | "pONE2" | "pONE3";
export type Layer = "0bas" | "1out" | "4har" | "6tla";
/** 0 down, 1 left, 2 right, 3 up. Combat sheets store these as rows down, up, right, left. */
export type Facing = 0 | 1 | 2 | 3;

const SHEET_ROW: Record<Facing, number> = {
  0: 0,
  1: 3,
  2: 2,
  3: 1,
};

export function sheetRow(facing: Facing): number {
  return SHEET_ROW[facing];
}

export type AnimName = "stand" | "idle" | "slash" | "walk" | "run";

export interface EnemyLook {
  body: string;
  outfit: string;
  hair: string;
  /** Multiply tint so the type reads as its own color. */
  tint: number;
  scale: number;
  gait: "walk" | "run";
}

/** Same body as the heroes. Color, size, and gait mark the enemy type. */
export const ENEMY_LOOKS: Record<string, EnemyLook> = {
  troop: { body: "humn_v01", outfit: "pfpn_v05", hair: "bob1_v01", tint: 0xc5d4e4, scale: 1.5, gait: "walk" },
  scout: { body: "humn_v03", outfit: "fstr_v04", hair: "bob1_v03", tint: 0xffe14a, scale: 1.2, gait: "run" },
  brute: { body: "humn_v10", outfit: "fstr_v04", hair: "bob1_v11", tint: 0xc4783a, scale: 2.1, gait: "walk" },
  elite: { body: "humn_v06", outfit: "fstr_v01", hair: "dap1_v06", tint: 0xff8a2c, scale: 1.75, gait: "walk" },
  boss: { body: "humn_v07", outfit: "fstr_v03", hair: "dap1_v08", tint: 0xff3a48, scale: 2.5, gait: "walk" },
};

export interface HeroLook {
  body: string;
  outfit: string;
  hair: string;
  weapon: string;
  /** Multiply tint on the weapon. White leaves the sheet colors alone. */
  weaponTint?: number;
}

export interface AnimFrame {
  col: number;
  row: number;
  ms: number;
}

export interface SheetRef {
  key: string;
  file: string;
  page: Page;
  layer: Layer;
  code: string;
}

/**
 * Same human body for every hero. Outfit, hair, and weapon are the only differences.
 * Speed swings a sword, damagers an axe, mages a mace — the demo has no staff.
 */
export const HERO_LOOKS: Record<string, HeroLook> = {
  "zhao-yun": { body: "humn_v01", outfit: "fstr_v01", hair: "bob1_v01", weapon: "sw01_v01" },
  "ma-chao": { body: "humn_v02", outfit: "fstr_v02", hair: "bob1_v06", weapon: "sw01_v02" },
  "gan-ning": { body: "humn_v03", outfit: "fstr_v04", hair: "dap1_v02", weapon: "sw01_v03" },
  "taishi-ci": { body: "humn_v05", outfit: "pfpn_v01", hair: "bob1_v08", weapon: "sw01_v04" },
  "sun-ce": { body: "humn_v08", outfit: "pfpn_v05", hair: "dap1_v05", weapon: "sw01_v05" },
  "guan-yu": { body: "humn_v04", outfit: "fstr_v03", hair: "bob1_v03", weapon: "ax01_v01" },
  "zhang-fei": { body: "humn_v06", outfit: "fstr_v05", hair: "bob1_v11", weapon: "ax01_v02" },
  "lu-bu": { body: "humn_v07", outfit: "fstr_v01", hair: "dap1_v08", weapon: "ax01_v04" },
  "xu-chu": { body: "humn_v09", outfit: "pfpn_v02", hair: "bob1_v13", weapon: "ax01_v03" },
  "dian-wei": { body: "humn_v10", outfit: "pfpn_v04", hair: "dap1_v10", weapon: "ax01_v05" },
  "zhuge-liang": { body: "humn_v01", outfit: "pfpn_v03", hair: "dap1_v01", weapon: "mc01_v01" },
  "sima-yi": { body: "humn_v02", outfit: "fstr_v05", hair: "dap1_v13", weapon: "mc01_v05" },
  "pang-tong": { body: "humn_v05", outfit: "pfpn_v01", hair: "bob1_v04", weapon: "mc01_v02" },
  "guo-jia": { body: "humn_v08", outfit: "fstr_v02", hair: "dap1_v06", weapon: "mc01_v03" },
  "zhou-yu": { body: "humn_v03", outfit: "pfpn_v05", hair: "bob1_v09", weapon: "mc01_v04" },
};

/** "b" = draw the weapon behind the body. Taken from the pack's layer-order guides. */
const WEAPON_FRONT: Record<"pONE2" | "pONE3", string[]> = {
  pONE2: ["ffffffff", "bbbbbbbb", "ffffffff", "ffffffff", "fff", "bbb", "fff", "fff"],
  pONE3: ["bbfbbfbb", "bbbbfbbf", "ffbbbbbf", "bfbbfbbf", "fffbbbbb", "bbbfbbbb", "ffbbffff", "ffbbffff"],
};

const DEFAULT_LOOK = HERO_LOOKS["zhao-yun"]!;

export function heroLook(defId: string): HeroLook {
  return HERO_LOOKS[defId] ?? DEFAULT_LOOK;
}

/**
 * Sword sheets only ship silver (v01, brightest), purple (v02), dark (v03), blue (v04), and gold (v05).
 * One imbued gem uses the closest sheet, tinted when that sheet is not the gem's color.
 * Two or more imbued gems use the brightest sheet, untinted.
 */
const IMBUED_WEAPON: Record<ImbuedElement, { variant: string; tint: number }> = {
  lightning: { variant: "v05", tint: 0xffffff },
  cold: { variant: "v04", tint: 0xffffff },
  fire: { variant: "v01", tint: 0xff4a32 },
  toxic: { variant: "v01", tint: 0x3ddc6a },
  bleed: { variant: "v01", tint: 0xc41028 },
};

export const BRIGHTEST_WEAPON_VARIANT = "v01";

export function weaponForImbued(baseWeapon: string, elements: readonly ImbuedElement[]): { code: string; tint: number } {
  const stem = baseWeapon.replace(/_v\d+$/, "");
  if (elements.length > 1) return { code: `${stem}_${BRIGHTEST_WEAPON_VARIANT}`, tint: 0xffffff };
  if (elements.length === 1) {
    const match = IMBUED_WEAPON[elements[0]!]!;
    return { code: `${stem}_${match.variant}`, tint: match.tint };
  }
  return { code: baseWeapon, tint: 0xffffff };
}

const IMBUED_FAMILIES = new Set<string>(["lightning", "cold", "fire", "toxic", "bleed"]);

export function socketedImbued(gems: ReadonlyArray<{ family: string } | null>): ImbuedElement[] {
  return gems.flatMap((gem) => (gem && IMBUED_FAMILIES.has(gem.family) ? [gem.family as ImbuedElement] : []));
}

export function armedLook(defId: string, gems: ReadonlyArray<{ family: string } | null>): HeroLook {
  const look = heroLook(defId);
  const weapon = weaponForImbued(look.weapon, socketedImbued(gems));
  return { ...look, weapon: weapon.code, weaponTint: weapon.tint };
}

const DEFAULT_ENEMY = ENEMY_LOOKS.troop!;

export function enemyLook(type: string): EnemyLook {
  return ENEMY_LOOKS[type] ?? DEFAULT_ENEMY;
}

/** Page 1 walk rows are down, left, right, up, starting at row 4. */
export function walkRow(facing: Facing): number {
  return 4 + facing;
}

export function textureKey(page: Page, layer: Layer, code: string): string {
  return `ms:${page}:${layer}:${code}`;
}

export function sheetFilename(page: Page, layer: Layer, code: string): string {
  return `char_a_${page}_${layer}_${code}.png`;
}

export function sheetRelativePath(page: Page, layer: Layer, code: string): string {
  const file = sheetFilename(page, layer, code);
  const folder = `characters/${page}`;
  if (layer === "0bas") return `${folder}/${file}`;
  return `${folder}/${layer}/${file}`;
}

export function frameIndex(col: number, row: number): number {
  return row * SHEET_COLS + col;
}

export function facingToward(fromX: number, fromY: number, toX: number, toY: number): Facing {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 2 : 1;
  return dy >= 0 ? 0 : 3;
}

export function animPage(name: AnimName): Page {
  if (name === "idle") return "pONE2";
  if (name === "slash") return "pONE3";
  return "p1";
}

export function animFrames(name: AnimName, facing: Facing): AnimFrame[] {
  if (name === "walk" || name === "run") {
    const row = walkRow(facing);
    if (name === "run") {
      const cols = [0, 1, 6, 3, 4, 7];
      const ms = [80, 55, 125, 80, 55, 125];
      return cols.map((col, i) => ({ col, row, ms: ms[i]! }));
    }
    return [0, 1, 2, 3, 4, 5].map((col) => ({ col, row, ms: 135 }));
  }
  const row = sheetRow(facing);
  if (name === "stand") return [{ col: 0, row, ms: 1000 }];
  if (name === "idle") {
    return [0, 1, 2, 3].map((col) => ({ col, row, ms: 200 }));
  }
  return [
    { col: 0, row, ms: 160 },
    { col: 1, row, ms: 65 },
    { col: 2, row, ms: 65 },
    { col: 3, row, ms: 200 },
  ];
}

export function weaponInFront(page: "pONE2" | "pONE3", col: number, row: number): boolean {
  return WEAPON_FRONT[page][row]?.[col] !== "b";
}

export function requiredSheets(): SheetRef[] {
  const seen = new Set<string>();
  const out: SheetRef[] = [];
  const add = (page: Page, layer: Layer, code: string) => {
    const key = textureKey(page, layer, code);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, file: sheetFilename(page, layer, code), page, layer, code });
  };
  for (const look of Object.values(HERO_LOOKS)) {
    for (const page of ["p1", "pONE2", "pONE3"] as const) {
      add(page, "0bas", look.body);
      add(page, "1out", look.outfit);
      add(page, "4har", look.hair);
      if (page !== "p1") {
        const stem = look.weapon.replace(/_v\d+$/, "");
        for (const variant of ["v01", "v02", "v03", "v04", "v05"]) add(page, "6tla", `${stem}_${variant}`);
      }
    }
  }
  for (const look of Object.values(ENEMY_LOOKS)) {
    add("p1", "0bas", look.body);
    add("p1", "1out", look.outfit);
    add("p1", "4har", look.hair);
  }
  return out;
}
