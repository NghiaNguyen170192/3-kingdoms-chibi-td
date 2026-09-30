import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HERO_DEFS } from "../src/data.js";
import {
  animFrames,
  enemyLook,
  facingToward,
  frameIndex,
  heroLook,
  requiredSheets,
  weaponForImbued,
  sheetRelativePath,
  weaponInFront,
} from "../src/game/manaSeed.js";

describe("mana seed looks", () => {
  it("gives every hero a body, outfit, hair, and weapon sheet that exists", () => {
    const root = join(process.cwd(), "assets");
    for (const def of HERO_DEFS) {
      const look = heroLook(def.id);
      expect(look.body.startsWith("humn_")).toBe(true);
      expect(look.outfit.length).toBeGreaterThan(0);
      expect(look.hair.length).toBeGreaterThan(0);
      expect(look.weapon.length).toBeGreaterThan(0);
    }
    for (const sheet of requiredSheets()) {
      const path = join(root, sheetRelativePath(sheet.page, sheet.layer, sheet.code));
      expect(existsSync(path), path).toBe(true);
    }
  });

  it("matches one imbued gem to a weapon color and uses the brightest sheet for several", () => {
    expect(weaponForImbued("sw01_v02", ["lightning"])).toEqual({ code: "sw01_v05", tint: 0xffffff });
    expect(weaponForImbued("sw01_v02", ["cold"])).toEqual({ code: "sw01_v04", tint: 0xffffff });
    expect(weaponForImbued("ax01_v03", ["fire"]).tint).toBe(0xff4a32);
    expect(weaponForImbued("sw01_v05", ["lightning", "cold"])).toEqual({ code: "sw01_v01", tint: 0xffffff });
    expect(weaponForImbued("mc01_v04", []).code).toBe("mc01_v04");
  });

  it("maps directions and attack frames the way the sheets are laid out", () => {
    expect(facingToward(0, 0, 0, 4)).toBe(0);
    expect(facingToward(0, 0, -4, 0)).toBe(1);
    expect(facingToward(0, 0, 4, 1)).toBe(2);
    expect(facingToward(0, 0, 0, -4)).toBe(3);
    expect(frameIndex(3, 2)).toBe(19);
    expect(animFrames("stand", 0)).toHaveLength(1);
    expect(animFrames("idle", 1).map((f) => f.col)).toEqual([0, 1, 2, 3]);
    expect(animFrames("idle", 0).every((f) => f.row === 0)).toBe(true);
    expect(animFrames("slash", 1).every((f) => f.row === 3)).toBe(true);
    expect(animFrames("slash", 2).every((f) => f.row === 2)).toBe(true);
    expect(animFrames("slash", 3).every((f) => f.row === 1)).toBe(true);
    expect(animFrames("slash", 0).map((f) => f.ms)).toEqual([160, 65, 65, 200]);
    expect(animFrames("walk", 0).map((f) => f.col)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(animFrames("walk", 0)[0]?.row).toBe(4);
    expect(animFrames("walk", 1)[0]?.row).toBe(5);
    expect(animFrames("walk", 2)[0]?.row).toBe(6);
    expect(animFrames("walk", 3)[0]?.row).toBe(7);
    expect(animFrames("run", 2).map((f) => f.col)).toEqual([0, 1, 6, 3, 4, 7]);
    const tints = ["troop", "scout", "brute", "elite", "boss"].map((type) => enemyLook(type).tint);
    expect(new Set(tints).size).toBe(5);
    expect(weaponInFront("pONE3", 2, 0)).toBe(true);
    expect(weaponInFront("pONE3", 0, 0)).toBe(false);
    expect(weaponInFront("pONE2", 1, 1)).toBe(false);
    expect(weaponInFront("pONE2", 0, 0)).toBe(true);
  });
});
