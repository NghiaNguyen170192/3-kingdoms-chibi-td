import Phaser from "phaser";
import { BattleRuntime } from "../battle.js";
import { ENERGY, MVP_MAP, heroDef } from "../data.js";
import { collectLoot, createNewPlayer, grantClearReward } from "../player.js";
import { Rng } from "../rng.js";
import { renderInventory } from "./inventoryPanel.js";
import { EnemyActor } from "./enemyActor.js";
import { HeroActor } from "./heroActor.js";
import { renderHeroSheet } from "./heroSheet.js";
import { queueImbuedEffects, registerImbuedEffects, spawnImbuedEffect } from "./imbuedEffect.js";
import { FOREST_COLS, FOREST_KEY, queueForestSheet } from "./forestSheet.js";
import { characterTextureKeys, queueCharacterSheets } from "./manaSeedLoad.js";
import { enemyLook, facingToward, armedLook } from "./manaSeed.js";
import { bindRosterPanel } from "./rosterPanel.js";
import {
  MAP_COLS,
  MAP_PAD,
  MAP_ROWS,
  SLOT_BORDER,
  TILE_PX,
  generateTiles,
  placeableTiles,
  playMap,
  worldToScreen,
  type MapTile,
} from "../map/tiles.js";
import type { BattleDeployment, BattleEvent, ImbuedElement, MapDef, PlayerState } from "../types.js";

export class PlayScene extends Phaser.Scene {
  private player!: PlayerState;
  private map!: MapDef;
  private tiles: MapTile[][] = [];
  private selectedHeroId: string | null = null;
  private placements = new Map<string, string>();
  private runtime: BattleRuntime | null = null;
  private enemyActors = new Map<string, EnemyActor>();
  private heroActors = new Map<string, HeroActor>();
  private hud!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private fightBtn!: Phaser.GameObjects.Text;
  private seed = 42;
  private autoWaveEl!: HTMLInputElement;
  private nextWaveEl!: HTMLButtonElement;
  private sheetEl!: HTMLElement;
  private rosterRefresh: (() => void) | null = null;
  private bursts = new Map<string, Phaser.GameObjects.Sprite>();
  private rewarded = false;
  private lastHeroTap = { id: "", time: 0 };
  private inventoryEl!: HTMLElement;
  private inventoryBody!: HTMLElement;

  constructor() {
    super("play");
  }

  init(): void {
    this.selectedHeroId = null;
    this.placements.clear();
    this.runtime = null;
    this.heroActors.clear();
    this.enemyActors.clear();
    this.bursts.clear();
    this.rewarded = false;
    this.lastHeroTap = { id: "", time: 0 };
    this.rosterRefresh = null;
    document.querySelector("#inventory")?.classList.remove("open");
  }

  preload(): void {
    queueCharacterSheets(this.load);
    queueImbuedEffects(this.load);
    queueForestSheet(this.load);
  }

  create(): void {
    for (const key of characterTextureKeys()) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.textures.get(FOREST_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    registerImbuedEffects(this);
    this.player = createNewPlayer();
    this.map = playMap();
    this.tiles = generateTiles(this.map);
    this.drawMap();
    this.drawHud();
    this.bindDom();
    this.refreshHeroViews();
    this.refreshSheet();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onClick(pointer));
    if (new URLSearchParams(window.location.search).has("demo")) {
      const demoSlots = pickDemoSlots(this.tiles);
      const demoHeroes = ["zhao-yun", "guan-yu", "zhuge-liang"]
        .map((id) => this.player.heroes.find((h) => h.defId === id))
        .filter((h): h is NonNullable<typeof h> => Boolean(h));
      demoHeroes.forEach((hero, i) => {
        const slot = demoSlots[i];
        if (slot) this.placements.set(hero.id, slot);
      });
      this.refreshHeroViews();
      this.startFight();
      if (this.runtime) {
        const events = this.runtime.step(4);
        this.syncUnits();
        for (const event of events.filter((e) => e.type === "hit").slice(-10)) {
          this.handleEvent(event);
        }
        this.refreshHud();
      }
    }
  }

  update(_time: number, delta: number): void {
    for (const actor of this.heroActors.values()) actor.tick(delta);
    for (const actor of this.enemyActors.values()) actor.tick(delta);
    if (!this.runtime || this.runtime.finished) return;
    if (this.runtime.waitingForNextWave) {
      this.syncUnits();
      this.refreshHud();
      return;
    }
    const events = this.runtime.step(delta / 1000);
    this.syncUnits();
    for (const event of events) this.handleEvent(event);
    const fresh = this.runtime.takeLoot();
    if (fresh.items.length || fresh.gems.length || fresh.gold) collectLoot(this.player, fresh);
    this.refreshHud();
  }

  private bindDom(): void {
    const auto = document.querySelector("#auto-wave")!;
    const next = document.querySelector("#next-wave")!;
    this.autoWaveEl = auto.cloneNode(true) as HTMLInputElement;
    this.nextWaveEl = next.cloneNode(true) as HTMLButtonElement;
    auto.replaceWith(this.autoWaveEl);
    next.replaceWith(this.nextWaveEl);
    this.sheetEl = document.querySelector("#hero-sheet")!;
    this.autoWaveEl.addEventListener("change", () => {
      this.runtime?.setAutoNext(this.autoWaveEl.checked);
      this.refreshHud();
    });
    this.nextWaveEl.addEventListener("click", () => this.continueWave());
    this.inventoryEl = document.querySelector("#inventory")!;
    this.inventoryBody = document.querySelector("#inventory-body")!;
    const close = document.querySelector<HTMLButtonElement>("#inventory-close")!;
    const freshClose = close.cloneNode(true) as HTMLButtonElement;
    close.replaceWith(freshClose);
    freshClose.addEventListener("click", () => this.inventoryEl.classList.remove("open"));
    const rosterRoot = document.querySelector<HTMLElement>("#roster")!;
    this.rosterRefresh = bindRosterPanel(
      rosterRoot,
      this.player,
      () => this.selectedHeroId,
      (heroId) => {
        this.selectedHeroId = heroId;
        this.refreshSheet();
        this.refreshHud();
        this.rosterRefresh?.();
      },
      (heroId) => {
        const hero = this.player.heroes.find((h) => h.id === heroId);
        if (hero) hero.favorite = !hero.favorite;
        this.rosterRefresh?.();
      },
      (heroId) => this.placements.has(heroId),
    ).refresh;
  }

  private canEdit(): boolean {
    return !this.runtime || this.runtime.waitingForNextWave;
  }

  private drawMap(): void {
    const g = this.add.graphics();
    for (const row of this.tiles) {
      for (const tile of row) {
        const x = MAP_PAD + tile.col * TILE_PX;
        const y = MAP_PAD + tile.row * TILE_PX;
        const frame = tile.sheetRow * FOREST_COLS + tile.sheetCol;
        this.add
          .image(x, y, FOREST_KEY, frame)
          .setOrigin(0, 0)
          .setDisplaySize(TILE_PX, TILE_PX)
          .setDepth(0);
        g.lineStyle(1, 0x163016, 0.35);
        g.strokeRect(x, y, TILE_PX, TILE_PX);
        if (tile.placeable) {
          g.lineStyle(3, SLOT_BORDER, 1);
          g.strokeRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
        }
      }
    }

    this.add
      .text(MAP_PAD, 4, `${MVP_MAP.name}    dirt = route    green border = place along the path`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#e8e2c8",
      })
      .setOrigin(0, 0);

    const dest = MVP_MAP.routes[0]!.waypoints.at(-1)!;
    const castle = worldToScreen(dest.x, dest.y);
    this.add
      .text(castle.x, castle.y, "CASTLE", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#ffe6e6",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(2);
    g.setDepth(1);
  }

  private drawHud(): void {
    const y = MAP_PAD + MAP_ROWS * TILE_PX + 8;
    this.hud = this.add.text(MAP_PAD, y, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#f4ecd2",
    });
    this.hint = this.add.text(MAP_PAD, y + 44, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#c8d6a3",
    });
    this.fightBtn = this.add
      .text(MAP_PAD + MAP_COLS * TILE_PX - 8, y, "  FIGHT  ", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#14200f",
        backgroundColor: "#7CFF7C",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.startFight());
    this.refreshHud();
  }

  private onClick(pointer: Phaser.Input.Pointer): void {
    if (!this.canEdit()) return;
    if (pointer.y > MAP_PAD + MAP_ROWS * TILE_PX) return;
    const col = Math.floor((pointer.x - MAP_PAD) / TILE_PX);
    const row = Math.floor((pointer.y - MAP_PAD) / TILE_PX);
    if (row < 0 || col < 0 || row >= MAP_ROWS || col >= MAP_COLS) return;
    const tile = this.tiles[row]![col]!;
    if (!tile.placeable || !tile.slotId) return;

    const occupant = [...this.placements.entries()].find(([, slot]) => slot === tile.slotId);
    if (occupant) {
      const heroId = occupant[0];
      const paused = Boolean(this.runtime?.waitingForNextWave);
      const double =
        paused && this.lastHeroTap.id === heroId && pointer.downTime - this.lastHeroTap.time < 350;
      this.lastHeroTap = { id: heroId, time: pointer.downTime };
      if ((this.selectedHeroId === heroId && !this.runtime) || double) {
        this.placements.delete(heroId);
        this.runtime?.removeHero(heroId);
        this.selectedHeroId = heroId;
      } else {
        this.selectedHeroId = heroId;
      }
      this.refreshHeroViews();
      this.refreshSheet();
      this.rosterRefresh?.();
      this.refreshHud();
      return;
    }

    const heroId = this.selectedHeroId ?? this.nextUnplacedHero();
    if (!heroId) return;
    this.placements.set(heroId, tile.slotId);
    this.runtime?.moveHero(heroId, tile.slotId, this.player.heroes.find((h) => h.id === heroId));
    this.refreshHeroViews();
    this.refreshSheet();
    this.rosterRefresh?.();
    this.refreshHud();
  }

  private nextUnplacedHero(): string | null {
    return this.player.heroes.find((h) => !this.placements.has(h.id))?.id ?? null;
  }

  private refreshHeroViews(): void {
    for (const actor of this.heroActors.values()) actor.destroy();
    this.heroActors.clear();
    const armed = Boolean(this.runtime);
    for (const [heroId, slotId] of this.placements) {
      const hero = this.player.heroes.find((h) => h.id === heroId);
      const slot = this.map.slots.find((s) => s.id === slotId);
      if (!hero || !slot) continue;
      const look = armedLook(hero.defId, hero.gems);
      const actor = new HeroActor(
        this,
        slot.x,
        slot.y,
        look,
        heroDef(hero.defId).name,
        heroId === this.selectedHeroId,
        look.weaponTint ?? 0xffffff,
      );
      if (armed) actor.setCombat(true);
      this.heroActors.set(heroId, actor);
    }
  }

  private startFight(): void {
    if (this.runtime) return;
    if (this.placements.size === 0) {
      this.hint.setText("Place at least one hero on a green-border tile.");
      return;
    }
    if (this.player.energy < ENERGY.perWave) {
      this.hint.setText("Need 1 energy to start a wave.");
      return;
    }
    const deployments: BattleDeployment[] = [...this.placements.entries()].map(([heroId, slotId]) => ({
      hero: this.player.heroes.find((h) => h.id === heroId)!,
      slotId,
    }));
    this.runtime = new BattleRuntime(deployments, {
      seed: this.seed,
      map: this.map,
      autoNextWave: this.autoWaveEl.checked,
      account: this.player,
    });
    for (const actor of this.heroActors.values()) actor.setCombat(true);
    this.fightBtn.setAlpha(0.35);
    this.refreshHud();
  }

  private continueWave(): void {
    if (!this.runtime || this.runtime.finished || !this.runtime.waitingForNextWave) return;
    if (!this.runtime.canAffordNextWave()) {
      this.hint.setText("Need 1 energy to start the next wave.");
      return;
    }
    this.runtime.refreshHeroStats();
    this.runtime.startNextWave();
    this.nextWaveEl.classList.remove("visible");
    this.refreshHud();
  }

  private refreshSheet(): void {
    renderHeroSheet(this.sheetEl, this.player, this.selectedHeroId, () => {
      this.runtime?.refreshHeroStats();
      this.refreshHeroViews();
      this.refreshSheet();
      this.rosterRefresh?.();
      this.refreshHud();
    });
  }

  private syncUnits(): void {
    if (!this.runtime) return;
    const seen = new Set<string>();
    for (const enemy of this.runtime.enemies) {
      if (!enemy.alive || enemy.reached) {
        this.enemyActors.get(enemy.id)?.destroy();
        this.enemyActors.delete(enemy.id);
        continue;
      }
      seen.add(enemy.id);
      let actor = this.enemyActors.get(enemy.id);
      if (!actor) {
        actor = new EnemyActor(this, enemy.x, enemy.y, enemyLook(enemy.type));
        this.enemyActors.set(enemy.id, actor);
      }
      actor.setWorld(enemy.x, enemy.y);
    }
    for (const [id, actor] of this.enemyActors) {
      if (!seen.has(id)) {
        actor.destroy();
        this.enemyActors.delete(id);
      }
    }
  }

  private handleEvent(event: BattleEvent): void {
    if (event.type === "attack") this.playAttack(event.heroId, event.targetIds[0]);
    if (event.type === "hit" && event.damage > 0) {
      this.floatDamage(event.x, event.y, event.damage, event.crit);
      this.playImpacts(event.enemyId, event.elements, event.x, event.y, true, event.crit);
    }
    if (event.type === "dot" && event.damage > 0) {
      this.playImpacts(event.enemyId, [event.element], event.x, event.y, false, false);
    }
    if (event.type === "waveCleared") {
      collectLoot(this.player, this.runtime!.takeLoot());
      if (this.runtime?.waitingForNextWave) this.nextWaveEl.classList.add("visible");
      this.refreshSheet();
    }
    if (event.type === "end" && this.runtime?.result) {
      collectLoot(this.player, this.runtime.takeLoot());
      this.nextWaveEl.classList.remove("visible");
      this.showResult();
    }
  }

  private playImpacts(
    enemyId: string,
    elements: ImbuedElement[],
    wx: number,
    wy: number,
    restart: boolean,
    crit: boolean,
  ): void {
    if (elements.length === 0) return;
    const actor = this.enemyActors.get(enemyId);
    const bodyScale = actor?.bodyScale ?? 1.6;
    const scale = bodyScale * 1.35 * (crit ? 1 : 0.5);
    const pos = worldToScreen(wx, wy);
    elements.forEach((element, index) => {
      const key = `${enemyId}:${element}`;
      const existing = this.bursts.get(key);
      if (existing?.active && !restart) return;
      existing?.destroy();
      const spread = (index - (elements.length - 1) / 2) * 8 * bodyScale;
      const lift = 16 * bodyScale;
      const sprite = actor
        ? spawnImbuedEffect(this, element, spread, -lift, 10, scale)
        : spawnImbuedEffect(this, element, pos.x + spread, pos.y - lift, pos.y + 4, scale);
      if (actor) actor.root.add(sprite);
      this.bursts.set(key, sprite);
      sprite.once("destroy", () => {
        if (this.bursts.get(key) === sprite) this.bursts.delete(key);
      });
    });
  }

  private floatDamage(wx: number, wy: number, amount: number, crit: boolean): void {
    const pos = worldToScreen(wx, wy);
    const label = this.add
      .text(pos.x, pos.y - 12, crit ? `${Math.round(amount)}!` : `${Math.round(amount)}`, {
        fontFamily: "Arial",
        fontSize: crit ? "20px" : "15px",
        color: crit ? "#ffe27a" : "#fff4d2",
        fontStyle: "bold",
        stroke: "#111",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: label,
      y: pos.y - 46,
      alpha: 0,
      duration: 650,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private playAttack(heroId: string, targetId: string | undefined): void {
    const actor = this.heroActors.get(heroId);
    const hero = this.runtime?.heroes.find((h) => h.instance.id === heroId);
    const target = targetId ? this.runtime?.enemies.find((e) => e.id === targetId) : undefined;
    if (!actor || !hero || !target) return;
    actor.attack(facingToward(hero.x, hero.y, target.x, target.y));
  }

  private refreshHud(): void {
    const selected = this.player.heroes.find((h) => h.id === this.selectedHeroId);
    const name = selected ? heroDef(selected.defId).name : "none";
    const energy = `energy ${this.player.energy}/${ENERGY.max}`;
    if (!this.runtime) {
      this.hud.setText(
        `Place heroes  |  ${energy}  |  selected ${name}  |  deployed ${this.placements.size}  |  castle 20`,
      );
      this.hint.setText("Pick a hero in the roster, then click a green-border tile. Each wave costs 1 energy.");
      return;
    }
    const r = this.runtime;
    const pause = r.waitingForNextWave ? "  |  PAUSED" : "";
    this.hud.setText(
      `Wave ${r.wave || 1}  |  ${energy}  |  castle ${Math.max(0, r.castleHp)}/20  |  time ${r.time.toFixed(1)}s  |  living ${r.living().length}${pause}`,
    );
    this.hint.setText(
      r.finished
        ? ""
        : r.waitingForNextWave
          ? this.player.energy < ENERGY.perWave
            ? "Out of energy. Each wave costs 1."
            : "Paused. Double-click a hero to take them off the map, then Next wave."
          : "Hitbox: Speed 1, Damager 2, Mage 3. Boss leak fails the run. Trash -1, elite -5.",
    );
    this.nextWaveEl.classList.toggle("visible", Boolean(r.waitingForNextWave));
  }

  private showResult(): void {
    const result = this.runtime?.result;
    if (!result) return;
    const title = result.victory
      ? "VICTORY"
      : result.events.some((e) => e.type === "end" && e.reason === "bossReached")
        ? "DEFEAT — the boss reached the castle"
        : result.castleHp <= 0
          ? "DEFEAT — castle fell"
          : "DEFEAT — the boss escaped";
    const body = [
      title,
      `Castle ${result.castleHp}/${result.castleMaxHp}   leaks ${result.leaks}`,
      `Loot  gold +${result.loot.gold}   items ${result.loot.items.length}   gems ${result.loot.gems.length}${result.loot.energy ? `   energy battery +${result.loot.energy}` : ""}`,
      result.victory ? "Spoils are open — merge items, gems, and heroes." : "Open spoils to merge what you kept.",
    ].join("\n");
    if (result.victory && !this.rewarded) {
      this.rewarded = true;
      grantClearReward(this.player, new Rng(this.seed + 99));
    }
    this.openInventory(result.victory);
    this.add
      .text(this.scale.width / 2, 220, body, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#fff8dc",
        backgroundColor: "#000000aa",
        align: "center",
        padding: { x: 18, y: 14 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.fightBtn.setText("RESET").setAlpha(1).removeAllListeners("pointerdown").on("pointerdown", () => this.scene.restart());
  }

  private openInventory(victory: boolean): void {
    this.inventoryEl.classList.add("open");
    const title = document.querySelector("#inventory-title");
    if (title) title.textContent = victory ? "Spoils — 20 waves cleared" : "Spoils";
    renderInventory(this.inventoryBody, this.player, new Rng(this.seed + 99), victory, () => {
      this.openInventory(victory);
      this.refreshSheet();
      this.rosterRefresh?.();
    });
  }
}

function pickDemoSlots(tiles: MapTile[][]): string[] {
  const adjacent = placeableTiles(tiles).filter((t) =>
    [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ].some(([dc, dr]) => {
      const n = tiles[t.row + dr]?.[t.col + dc];
      return n && (n.kind === "route" || n.kind === "castle");
    }),
  );
  const north = adjacent.find((t) => t.row <= 4);
  const south = adjacent.find((t) => t.row >= 10);
  const mid = adjacent.find((t) => t !== north && t !== south);
  return [north, south, mid].map((t) => t?.slotId).filter((id): id is string => Boolean(id));
}
