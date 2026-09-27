import Phaser from "phaser";
import { BattleRuntime } from "../battle.js";
import { MVP_MAP, heroDef } from "../data.js";
import { collectLoot, createNewPlayer } from "../player.js";
import { renderHeroSheet } from "./heroSheet.js";
import { bindRosterPanel } from "./rosterPanel.js";
import { heroColor } from "../roster.js";
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
  worldToTile,
  type MapTile,
} from "../map/tiles.js";
import { computeHeroStats } from "../stats.js";
import type { BattleDeployment, BattleEvent, HeroInstance, MapDef, PlayerState } from "../types.js";

const ENEMY_COLORS: Record<string, number> = {
  troop: 0xd8d0c0,
  scout: 0xf2d14a,
  brute: 0x8a5a32,
  elite: 0xf08a2c,
  boss: 0x6b1020,
};

export class PlayScene extends Phaser.Scene {
  private player!: PlayerState;
  private map!: MapDef;
  private tiles: MapTile[][] = [];
  private selectedHeroId: string | null = null;
  private placements = new Map<string, string>();
  private runtime: BattleRuntime | null = null;
  private enemyViews = new Map<string, Phaser.GameObjects.Container>();
  private heroViews = new Map<string, Phaser.GameObjects.Container>();
  private hud!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private fightBtn!: Phaser.GameObjects.Text;
  private seed = 42;
  private autoWaveEl!: HTMLInputElement;
  private nextWaveEl!: HTMLButtonElement;
  private sheetEl!: HTMLElement;
  private rosterRefresh: (() => void) | null = null;

  constructor() {
    super("play");
  }

  create(): void {
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
        g.fillStyle(tile.color, 1);
        g.fillRect(x, y, TILE_PX, TILE_PX);
        g.lineStyle(1, 0x163016, 0.35);
        g.strokeRect(x, y, TILE_PX, TILE_PX);
        if (tile.placeable) {
          g.lineStyle(3, SLOT_BORDER, 1);
          g.strokeRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
        }
      }
    }

    this.add
      .text(MAP_PAD, 4, `${MVP_MAP.name}    tan = route    green border = place along the path (3 tiles each side)`, {
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
      .setOrigin(0.5);
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
      if (this.selectedHeroId === occupant[0] && !this.runtime) {
        this.placements.delete(occupant[0]);
        this.selectedHeroId = occupant[0];
      } else {
        this.selectedHeroId = occupant[0];
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
    for (const view of this.heroViews.values()) view.destroy();
    this.heroViews.clear();
    for (const [heroId, slotId] of this.placements) {
      const hero = this.player.heroes.find((h) => h.id === heroId);
      const slot = this.map.slots.find((s) => s.id === slotId);
      if (!hero || !slot) continue;
      const color = heroColor(hero.defId);
      const range = Math.max(1, Math.round(computeHeroStats(hero).range));
      this.heroViews.set(heroId, this.makeHero(slot.x, slot.y, color, initials(hero), range));
    }
  }

  private startFight(): void {
    if (this.runtime) return;
    if (this.placements.size === 0) {
      this.hint.setText("Place at least one hero on a green-border tile.");
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
    });
    this.fightBtn.setAlpha(0.35);
    this.refreshHud();
  }

  private continueWave(): void {
    if (!this.runtime || this.runtime.finished || !this.runtime.waitingForNextWave) return;
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
        this.enemyViews.get(enemy.id)?.destroy();
        this.enemyViews.delete(enemy.id);
        continue;
      }
      seen.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);
      if (!view) {
        const size = enemy.type === "boss" ? 20 : enemy.type === "brute" ? 16 : 12;
        view = this.makeUnit(
          enemy.x,
          enemy.y,
          ENEMY_COLORS[enemy.type] ?? 0xffffff,
          enemy.type[0]!.toUpperCase(),
          size,
        );
        this.enemyViews.set(enemy.id, view);
      }
      const pos = worldToScreen(enemy.x, enemy.y);
      view.setPosition(pos.x, pos.y);
    }
    for (const [id, view] of this.enemyViews) {
      if (!seen.has(id)) {
        view.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  private handleEvent(event: BattleEvent): void {
    if (event.type === "hit" && event.damage > 0) {
      this.floatDamage(event.x, event.y, event.damage, event.crit);
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

  private makeHero(wx: number, wy: number, color: number, label: string, rangeTiles: number): Phaser.GameObjects.Container {
    const pos = worldToScreen(wx, wy);
    const { col, row } = worldToTile(wx, wy);
    const box = this.add.graphics();
    const size = (rangeTiles * 2 + 1) * TILE_PX;
    const ox = MAP_PAD + (col - rangeTiles) * TILE_PX - pos.x;
    const oy = MAP_PAD + (row - rangeTiles) * TILE_PX - pos.y;
    box.fillStyle(color, 0.16);
    box.lineStyle(2, color, 0.85);
    box.fillRect(ox, oy, size, size);
    box.strokeRect(ox + 1, oy + 1, size - 2, size - 2);
    const circle = this.add.circle(0, 0, 16, color).setStrokeStyle(2, 0x111111);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    return this.add.container(pos.x, pos.y, [box, circle, text]).setDepth(10);
  }

  private makeUnit(wx: number, wy: number, color: number, label: string, radius: number): Phaser.GameObjects.Container {
    const pos = worldToScreen(wx, wy);
    const circle = this.add.circle(0, 0, radius, color).setStrokeStyle(2, 0x111111);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#111",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    return this.add.container(pos.x, pos.y, [circle, text]).setDepth(10);
  }

  private refreshHud(): void {
    const selected = this.player.heroes.find((h) => h.id === this.selectedHeroId);
    const name = selected ? heroDef(selected.defId).name : "none";
    if (!this.runtime) {
      this.hud.setText(
        `Place heroes  |  selected ${name}  |  deployed ${this.placements.size}  |  castle 20`,
      );
      this.hint.setText("Pick a hero in the roster, then click a green-border tile. Star favorites to pin them.");
      return;
    }
    const r = this.runtime;
    const pause = r.waitingForNextWave ? "  |  PAUSED — rearrange or gear up" : "";
    this.hud.setText(
      `Wave ${r.wave || 1}  |  castle ${Math.max(0, r.castleHp)}/20  |  time ${r.time.toFixed(1)}s  |  living ${r.living().length}${pause}`,
    );
    this.hint.setText(
      r.finished
        ? ""
        : r.waitingForNextWave
          ? "Paused. Move heroes, click one to change items, then Next wave."
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
      `Loot  gold +${result.loot.gold}   items ${result.loot.items.length}   gems ${result.loot.gems.length}`,
      "Click FIGHT after Reset, or refresh to start over.",
    ].join("\n");
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
}

function initials(hero: HeroInstance): string {
  return heroDef(hero.defId)
    .name.split(" ")
    .map((p) => p[0])
    .join("");
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
