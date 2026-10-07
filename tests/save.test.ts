import { describe, expect, it } from "vitest";
import { createNewPlayer, unequip } from "../src/player.js";
import { createAccount, loadGame, writeGame, type SaveStore } from "../src/save.js";
import type { GameSave } from "../src/save.js";

function memoryStore(): SaveStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    get: (key) => raw.get(key) ?? null,
    set: (key, value) => {
      raw.set(key, value);
    },
  };
}

describe("game save", () => {
  it("starts empty", () => {
    expect(loadGame(memoryStore())).toBeNull();
  });

  it("keeps the account, stash, gems, and map placement", () => {
    const store = memoryStore();
    const player = createNewPlayer();
    const hero = player.heroes[0]!;
    unequip(player, hero.id, "mainHand");
    const gem = hero.gems[0];
    hero.gems[0] = null;
    if (gem) player.gems.push(gem);
    const save: GameSave = {
      version: 1,
      account: createAccount(),
      player,
      mapId: "hulao-pass",
      setups: [{ mapId: "hulao-pass", placements: [{ heroId: player.heroes[1]!.id, slotId: "slot-a" }] }],
      clearedMaps: ["hulao-pass"],
    };
    writeGame(store, save);
    const loaded = loadGame(store);
    expect(loaded?.account.id).toBe(save.account.id);
    expect(loaded?.player.inventory).toHaveLength(1);
    expect(loaded?.player.gems.map((entry) => entry.family)).toEqual(player.gems.map((entry) => entry.family));
    expect(loaded?.player.heroes[0]?.equipment.mainHand).toBeUndefined();
    expect(loaded?.setups[0]?.placements).toEqual(save.setups[0]?.placements);
    expect(loaded?.clearedMaps).toEqual(["hulao-pass"]);
  });

  it("rejoins a two-handed weapon that was stored twice", () => {
    const store = memoryStore();
    const player = createNewPlayer();
    const hero = player.heroes.find((entry) => entry.equipment.mainHand?.weaponStyle === "twoHand");
    expect(hero).toBeTruthy();
    const save: GameSave = {
      version: 1,
      account: createAccount(),
      player,
      mapId: "hulao-pass",
      setups: [],
      clearedMaps: [],
    };
    writeGame(store, save);
    const loaded = loadGame(store);
    const again = loaded?.player.heroes.find((entry) => entry.id === hero!.id);
    expect(again?.equipment.offHand).toBe(again?.equipment.mainHand);
  });

  it("rejects a broken document", () => {
    const store = memoryStore();
    store.set("3k-chibi.player", "{");
    expect(loadGame(store)).toBeNull();
  });
});
