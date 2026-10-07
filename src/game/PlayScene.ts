import Phaser from "phaser";
import { BattleRuntime } from "../battle.js";
import { ENERGY, MAPS, heroDef, mapById } from "../data.js";
import { collectLoot, createNewPlayer, grantClearReward } from "../player.js";
import { browserStore, createAccount, loadGame, writeGame, type GameSave, type PlayerAccount } from "../save.js";
import { Rng } from "../rng.js";
import { renderInventory } from "./inventoryPanel.js";
import { EnemyActor } from "./enemyActor.js";
import { HeroActor } from "./heroActor.js";
import { renderHeroSheet, renderSharedBag } from "./heroSheet.js";
import { queueImbuedEffects, registerImbuedEffects, spawnImbuedEffect } from "./imbuedEffect.js";
import { FOREST_COLS, FOREST_KEY, queueForestSheet } from "./forestSheet.js";
import { characterTextureKeys, queueCharacterSheets } from "./manaSeedLoad.js";
import { enemyLook, facingToward, armedLook } from "./manaSeed.js";
import { bindRosterPanel } from "./rosterPanel.js";
import {
  MAP_COLS,
  MAP_PAD,
  MAP_ROWS,
  UI_ROWS,
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
  private account!: PlayerAccount;
  private map!: MapDef;
  private tiles: MapTile[][] = [];
  private selectedHeroId: string | null = null;
  private placements = new Map<string, string>();
  private runtime: BattleRuntime | null = null;
  private enemyActors = new Map<string, EnemyActor>();
  private heroActors = new Map<string, HeroActor>();
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private legendEl!: HTMLElement;
  private fightBtn!: HTMLButtonElement;
  private seed = 42;
  private autoWaveEl!: HTMLInputElement;
  private sheetEl!: HTMLElement;
  private rosterRefresh: (() => void) | null = null;
  private bursts = new Map<string, Phaser.GameObjects.Sprite>();
  private rewarded = false;
  private lastHeroTap = { id: "", time: 0 };
  private inventoryEl!: HTMLElement;
  private inventoryBody!: HTMLElement;
  private bagEl!: HTMLElement;
  private dockMode: "heroes" | "bag" | "friend" = "heroes";
  private dockButtons = new Map<string, HTMLButtonElement>();
  private dismissSelection?: (ev: PointerEvent) => void;

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
    const save = loadGame(browserStore());
    this.account = save?.account ?? createAccount();
    this.player = save?.player ?? createNewPlayer();
    this.map = playMap(selectedMap(save?.mapId));
    if (!this.demoMode()) this.restoreSetup(save);
    this.tiles = generateTiles(this.map);
    this.drawMap();
    this.drawDock();
    this.bindDom();
    this.refreshHeroViews();
    this.refreshSheet();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onClick(pointer));
    if (!save) this.persist();
    if (this.demoMode()) {
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
    const energyBefore = this.player.energy;
    const events = this.runtime.step(delta / 1000);
    this.syncUnits();
    for (const event of events) this.handleEvent(event);
    const fresh = this.runtime.takeLoot();
    if (fresh.items.length || fresh.gems.length || fresh.gold || fresh.energy) collectLoot(this.player, fresh);
    if (this.player.energy !== energyBefore || fresh.items.length || fresh.gems.length || fresh.gold || fresh.energy) {
      this.persist();
    }
    this.refreshHud();
  }

  private bindDom(): void {
    const auto = document.querySelector("#auto-wave")!;
    this.autoWaveEl = auto.cloneNode(true) as HTMLInputElement;
    auto.replaceWith(this.autoWaveEl);
    this.sheetEl = document.querySelector("#hero-sheet")!;
    this.hud = document.querySelector("#dock-hud")!;
    this.hint = document.querySelector("#dock-hint")!;
    this.legendEl = document.querySelector("#map-legend")!;
    this.legendEl.textContent = `${this.map.name}    dirt = route    green border = place along the path`;
    this.fightBtn = document.querySelector("#fight-btn")!;
    this.fightBtn.textContent = "FIGHT";
    this.fightBtn.disabled = false;
    this.fightBtn.onclick = () => this.onFight();
    this.dockButtons.clear();
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-dock]"))) {
      const key = button.dataset.dock ?? "";
      button.onclick = () => this.onDock(key);
      this.dockButtons.set(key, button);
    }
    if (this.dismissSelection) document.removeEventListener("pointerdown", this.dismissSelection);
    this.dismissSelection = (ev) => this.onDismiss(ev);
    document.addEventListener("pointerdown", this.dismissSelection);
    this.autoWaveEl.addEventListener("change", () => {
      this.runtime?.setAutoNext(this.autoWaveEl.checked);
      this.paintDock();
      this.refreshHud();
    });
    const mapPick = document.querySelector<HTMLSelectElement>("#map-pick");
    if (mapPick) {
      mapPick.replaceChildren(
        ...MAPS.map((map) => {
          const option = document.createElement("option");
          option.value = map.id;
          option.textContent = map.name;
          option.selected = map.id === this.map.id;
          return option;
        }),
      );
      mapPick.addEventListener("change", () => {
        this.persist(mapPick.value);
        const params = new URLSearchParams(window.location.search);
        params.set("map", mapPick.value);
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
        this.scene.restart();
      });
    }
    this.bagEl = document.querySelector<HTMLElement>("#shared-bag")!;
    this.showDock();
    this.refreshHud();
    const dockObserver = new ResizeObserver(() => this.placeOverlays());
    dockObserver.observe(this.game.canvas);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      dockObserver.disconnect();
      if (this.dismissSelection) document.removeEventListener("pointerdown", this.dismissSelection);
    });
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
        this.refreshRoster();
      },
      (heroId) => {
        const hero = this.player.heroes.find((h) => h.id === heroId);
        if (hero) hero.favorite = !hero.favorite;
        this.persist();
        this.refreshRoster();
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
        const image = this.add
          .image(x, y, FOREST_KEY, frame)
          .setOrigin(0, 0)
          .setDisplaySize(TILE_PX, TILE_PX)
          .setDepth(0);
        if (tile.kind === "grass" && this.map.ground === "snow") image.setTint(0xc5d4e8);
        if (tile.kind === "grass" && this.map.ground === "sand") image.setTint(0xe4c888);
        g.lineStyle(1, 0x163016, 0.35);
        g.strokeRect(x, y, TILE_PX, TILE_PX);
        if (tile.placeable) {
          g.lineStyle(3, SLOT_BORDER, 1);
          g.strokeRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
        }
      }
    }

    const seen = new Set<string>();
    for (const path of this.map.paths) {
      if (seen.has(path.destinationId)) continue;
      seen.add(path.destinationId);
      const dest = path.waypoints.at(-1)!;
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
    }
    g.setDepth(1);
  }

  /** Two grass rows under the battlefield. Not placeable. */
  private drawDock(): void {
    const top = MAP_PAD + MAP_ROWS * TILE_PX;
    for (let row = 0; row < UI_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const frame = 5 * FOREST_COLS + ((col + row) % 2 === 0 ? 1 : 2);
        this.add
          .image(MAP_PAD + col * TILE_PX, top + row * TILE_PX, FOREST_KEY, frame)
          .setOrigin(0, 0)
          .setDisplaySize(TILE_PX, TILE_PX)
          .setTint(0x4e5a40)
          .setDepth(3);
      }
    }
  }

  /** Starts the battle, and sends the next wave once a wave is cleared. */
  private onFight(): void {
    if (this.runtime?.finished) {
      this.scene.restart();
      return;
    }
    if (this.runtime?.waitingForNextWave) {
      this.continueWave();
      return;
    }
    if (!this.runtime) this.startFight();
  }

  private onDock(key: string): void {
    if (key === "heroes" || key === "bag" || key === "friend") {
      this.dockMode = key;
      this.showDock();
    }
  }

  private showDock(): void {
    const roster = document.querySelector<HTMLElement>("#roster");
    const friend = document.querySelector<HTMLElement>("#friend-dock");
    if (roster) roster.hidden = this.dockMode !== "heroes";
    if (this.bagEl) this.bagEl.hidden = this.dockMode !== "bag";
    if (friend) friend.hidden = this.dockMode !== "friend";
    if (this.dockMode === "bag") this.refreshBag();
    this.paintDock();
    this.placeOverlays();
  }

  private refreshRoster(): void {
    this.rosterRefresh?.();
    this.placeOverlays();
  }

  private pagePoint(gameX: number, gameY: number): { x: number; y: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: rect.left + (gameX / this.scale.width) * rect.width,
      y: rect.top + (gameY / this.scale.height) * rect.height,
    };
  }

  /** Keep a floating panel on screen. minY stops it from sliding up over the dock buttons. */
  private pin(el: HTMLElement, x: number, y: number, minY = 2): void {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const box = el.getBoundingClientRect();
    if (box.right > window.innerWidth - 2) el.style.left = `${Math.max(2, x - (box.right - window.innerWidth) - 2)}px`;
    if (box.bottom > window.innerHeight - 2) el.style.top = `${Math.max(minY, y - (box.bottom - window.innerHeight) - 2)}px`;
  }

  private demoMode(): boolean {
    return new URLSearchParams(window.location.search).has("demo");
  }

  /** Write the account, stash, and this map's hero placement. Skipped for the demo query. */
  private persist(nextMapId = this.map.id): void {
    if (this.demoMode()) return;
    const previous = loadGame(browserStore());
    const setups = (previous?.setups ?? []).filter((setup) => setup.mapId !== this.map.id);
    setups.push({
      mapId: this.map.id,
      placements: [...this.placements.entries()].map(([heroId, slotId]) => ({ heroId, slotId })),
    });
    const cleared = new Set(previous?.clearedMaps ?? []);
    if (this.rewarded) cleared.add(this.map.id);
    const save: GameSave = {
      version: 1,
      account: this.account,
      player: this.player,
      mapId: nextMapId,
      setups,
      clearedMaps: [...cleared],
    };
    writeGame(browserStore(), save);
  }

  private restoreSetup(save: GameSave | null): void {
    const setup = save?.setups.find((entry) => entry.mapId === this.map.id);
    if (!setup) return;
    const used = new Set<string>();
    for (const placement of setup.placements) {
      const hero = this.player.heroes.some((entry) => entry.id === placement.heroId);
      const slot = this.map.slots.some((entry) => entry.id === placement.slotId);
      if (!hero || !slot || used.has(placement.slotId)) continue;
      used.add(placement.slotId);
      this.placements.set(placement.heroId, placement.slotId);
    }
  }

  /** Two tile rows under the button row, from the Heroes button to the Fight button. */
  private pinStrip(el: HTMLElement, x: number, y: number, width: number): void {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.max(0, Math.round(width))}px`;
  }

  /** Left edge of the Heroes button, just under the button row, out to the Fight button. */
  private stripFrame(): { x: number; y: number; width: number } {
    const heroes = document.querySelector("[data-dock=heroes]");
    const fight = document.querySelector("#fight-btn");
    const buttons = document.querySelector("#dock-buttons");
    if (!heroes || !fight || !buttons) return { x: 8, y: 8, width: 400 };
    const left = heroes.getBoundingClientRect().left;
    const right = fight.getBoundingClientRect().right;
    const y = buttons.getBoundingClientRect().bottom + 2;
    return { x: left, y, width: Math.max(0, right - left) };
  }

  /** Map picker sits in the open dock space above Fight, sharing Fight's right edge. */
  private placeMapPick(): void {
    const mapPick = document.querySelector<HTMLElement>("#map-pick");
    const fight = document.querySelector("#fight-btn");
    const dock = document.querySelector("#dock-bar");
    if (!mapPick || !fight || !dock) return;
    const fightBox = fight.getBoundingClientRect();
    const dockBox = dock.getBoundingClientRect();
    const width = mapPick.offsetWidth;
    mapPick.style.right = "auto";
    mapPick.style.left = `${Math.round(fightBox.right - width)}px`;
    mapPick.style.top = `${Math.round(dockBox.top + 2)}px`;
  }

  private placeOverlays(): void {
    const dock = document.querySelector<HTMLElement>("#dock-bar");
    const legend = this.legendEl;
    if (dock) {
      const origin = this.pagePoint(MAP_PAD, MAP_PAD + MAP_ROWS * TILE_PX);
      const far = this.pagePoint(MAP_PAD + MAP_COLS * TILE_PX, MAP_PAD + (MAP_ROWS + UI_ROWS) * TILE_PX);
      dock.style.left = `${origin.x}px`;
      dock.style.top = `${origin.y}px`;
      dock.style.width = `${Math.max(0, far.x - origin.x)}px`;
      dock.style.height = `${Math.max(0, far.y - origin.y)}px`;
    }
    if (legend) {
      const origin = this.pagePoint(MAP_PAD, 6);
      legend.style.left = `${origin.x}px`;
      legend.style.top = `${origin.y}px`;
    }
    const roster = document.querySelector<HTMLElement>("#roster");
    const friend = document.querySelector<HTMLElement>("#friend-dock");
    const strip = this.stripFrame();
    if (roster && !roster.hidden) {
      this.pinStrip(roster, strip.x, strip.y, strip.width);
      const list = roster.querySelector<HTMLElement>(".roster-list");
      if (list) {
        const room = window.innerHeight - list.getBoundingClientRect().top - 8;
        list.style.maxHeight = `${Math.max(96, Math.min(194, Math.floor(room)))}px`;
      }
    }
    if (this.bagEl && !this.bagEl.hidden) this.pinStrip(this.bagEl, strip.x, strip.y, strip.width);
    if (friend && !friend.hidden) this.pinStrip(friend, strip.x, strip.y, Math.min(strip.width, 240));
    this.placeMapPick();
    this.placeHeroSheet();
  }

  private placeHeroSheet(): void {
    const sheet = this.sheetEl;
    if (!sheet) return;
    if (!this.selectedHeroId || !sheet.innerHTML.trim()) {
      sheet.style.display = "none";
      return;
    }
    sheet.style.display = "block";
    const slotId = this.placements.get(this.selectedHeroId);
    const slot = slotId ? this.map.slots.find((entry) => entry.id === slotId) : undefined;
    if (slot) {
      const pos = worldToScreen(slot.x, slot.y);
      const page = this.pagePoint(pos.x + 22, pos.y - 18);
      this.pin(sheet, page.x, page.y);
      this.keepAboveDock(sheet);
      return;
    }
    const face = document.querySelector<HTMLElement>(`[data-select="${this.selectedHeroId}"]`);
    if (face) {
      const box = face.getBoundingClientRect();
      const height = sheet.getBoundingClientRect().height;
      const dockTop = this.dockTop();
      const above = dockTop == null ? box.top : dockTop - height - 2;
      this.pin(sheet, box.right + 4, above);
      this.keepAboveDock(sheet);
      return;
    }
    this.pin(sheet, 8, 8);
  }

  private dockTop(): number | null {
    const buttons = document.querySelector("#dock-buttons");
    if (!buttons) return null;
    return buttons.getBoundingClientRect().top;
  }

  /** The details card stays above the dock so it does not cover the buttons or the strip. */
  private keepAboveDock(el: HTMLElement): void {
    const top = this.dockTop();
    if (top == null) return;
    const box = el.getBoundingClientRect();
    if (box.bottom > top - 1) el.style.top = `${Math.max(2, top - box.height - 2)}px`;
  }

  private refreshBag(): void {
    if (!this.bagEl) return;
    renderSharedBag(this.bagEl, this.player, this.selectedHeroId, () => {
      this.runtime?.refreshHeroStats();
      this.refreshHeroViews();
      this.refreshSheet();
      this.refreshBag();
      this.refreshRoster();
      this.refreshHud();
      this.persist();
    });
  }

  private paintDock(): void {
    for (const [key, button] of this.dockButtons) {
      button.classList.toggle("on", key === this.dockMode);
    }
    const running = Boolean(this.runtime && !this.runtime.finished && !this.runtime.waitingForNextWave);
    if (this.fightBtn && this.fightBtn.textContent === "FIGHT") this.fightBtn.disabled = running;
  }

  /** Hide the details card unless the click landed on a hero, the roster, or the card itself. */
  private onDismiss(ev: PointerEvent): void {
    const target = ev.target;
    if (!(target instanceof Node)) return;
    if (this.sheetEl?.contains(target)) return;
    if (document.querySelector("#roster")?.contains(target)) return;
    if (this.bagEl?.contains(target)) return;
    if (target instanceof Element && target.closest("#game canvas")) return;
    this.clearSelection();
  }

  private clearSelection(): void {
    if (!this.selectedHeroId) return;
    this.selectedHeroId = null;
    this.refreshHeroViews();
    this.refreshSheet();
    this.refreshRoster();
    this.refreshHud();
  }

  private onClick(pointer: Phaser.Input.Pointer): void {
    if (pointer.y > MAP_PAD + MAP_ROWS * TILE_PX) {
      this.clearSelection();
      return;
    }
    const col = Math.floor((pointer.x - MAP_PAD) / TILE_PX);
    const row = Math.floor((pointer.y - MAP_PAD) / TILE_PX);
    if (row < 0 || col < 0 || row >= MAP_ROWS || col >= MAP_COLS) {
      this.clearSelection();
      return;
    }
    const tile = this.tiles[row]![col]!;
    const occupant = [...this.placements.entries()].find(([, slot]) => slot === tile.slotId);
    if (!tile.placeable || !tile.slotId) {
      if (!occupant) this.clearSelection();
      return;
    }

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
        this.persist();
      } else {
        this.selectedHeroId = heroId;
      }
      this.refreshHeroViews();
      this.refreshSheet();
      this.refreshRoster();
      this.refreshHud();
      return;
    }

    if (!this.canEdit()) {
      this.clearSelection();
      return;
    }
    const heroId = this.selectedHeroId ?? this.nextUnplacedHero();
    if (!heroId) return;
    this.placements.set(heroId, tile.slotId);
    this.runtime?.moveHero(heroId, tile.slotId, this.player.heroes.find((h) => h.id === heroId));
    this.persist();
    this.refreshHeroViews();
    this.refreshSheet();
    this.refreshRoster();
    this.refreshHud();
  }

  private nextUnplacedHero(): string | null {
    return this.player.heroes.find((h) => !this.placements.has(h.id))?.id ?? null;
  }

  private refreshHeroViews(): void {
    for (const actor of this.heroActors.values()) actor.destroy();
    this.heroActors.clear();
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
      actor.setCombat(true);
      this.heroActors.set(heroId, actor);
    }
  }

  private startFight(): void {
    if (this.runtime) return;
    if (this.placements.size === 0) {
      this.hint.textContent = "Place at least one hero on a green-border tile.";
      return;
    }
    if (this.player.energy < ENERGY.perWave) {
      this.hint.textContent = "Need 1 energy to start a wave.";
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
    this.fightBtn.disabled = true;
    this.refreshHud();
  }

  private continueWave(): void {
    if (!this.runtime || this.runtime.finished || !this.runtime.waitingForNextWave) return;
    if (!this.runtime.canAffordNextWave()) {
      this.hint.textContent = "Need 1 energy to start the next wave.";
      return;
    }
    this.runtime.refreshHeroStats();
    this.runtime.startNextWave();
    this.refreshHud();
  }

  private refreshSheet(): void {
    const heroId = this.selectedHeroId;
    renderHeroSheet(this.sheetEl, this.player, heroId, () => {
      this.runtime?.refreshHeroStats();
      this.refreshHeroViews();
      this.refreshSheet();
      if (this.dockMode === "bag") this.refreshBag();
      this.refreshRoster();
      this.refreshHud();
      this.placeOverlays();
      this.persist();
    }, {
      deployed: Boolean(heroId && this.placements.has(heroId) && this.canEdit()),
      onRecall: () => {
        if (!heroId || !this.canEdit()) return;
        this.placements.delete(heroId);
        this.runtime?.removeHero(heroId);
        this.persist();
        this.refreshHeroViews();
        this.refreshSheet();
        this.refreshRoster();
        this.refreshHud();
      },
    });
    this.placeOverlays();
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
      this.refreshSheet();
    }
    if (event.type === "end" && this.runtime?.result) {
      collectLoot(this.player, this.runtime.takeLoot());
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
      this.hud.textContent = `Place heroes  |  ${energy}  |  selected ${name}  |  deployed ${this.placements.size}  |  castle 20`;
      this.hint.textContent = "Pick a hero, then click a green tile. Each wave costs 1 energy.";
      this.paintDock();
      return;
    }
    const r = this.runtime;
    const pause = r.waitingForNextWave ? "  |  PAUSED" : "";
    this.hud.textContent = `Wave ${r.wave || 1}  |  ${energy}  |  castle ${Math.max(0, r.castleHp)}/20  |  time ${r.time.toFixed(1)}s  |  living ${r.living().length}${pause}`;
    this.hint.textContent =
      r.finished
        ? ""
        : r.waitingForNextWave
          ? this.player.energy < ENERGY.perWave
            ? "Out of energy. Each wave costs 1."
            : "Paused. Double-click a hero to take them off the map, then Fight."
          : "Hitbox: Speed 1, Damager 2, Mage 3. Boss leak fails the run. Trash -1, elite -5.";
    this.paintDock();
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
    this.persist();
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
    this.fightBtn.textContent = "RESET";
    this.fightBtn.disabled = false;
    this.fightBtn.onclick = () => this.scene.restart();
  }

  private openInventory(victory: boolean): void {
    this.inventoryEl.classList.add("open");
    const title = document.querySelector("#inventory-title");
    if (title) title.textContent = victory ? "Spoils — 20 waves cleared" : "Spoils";
    renderInventory(this.inventoryBody, this.player, new Rng(this.seed + 99), victory, () => {
      this.openInventory(victory);
      this.refreshSheet();
      this.refreshRoster();
      this.persist();
    });
  }
}

function selectedMap(savedId?: string): MapDef {
  const query = new URLSearchParams(window.location.search).get("map");
  const id = query || savedId;
  if (!id) return MAPS[0]!;
  try {
    return mapById(id);
  } catch {
    return MAPS[0]!;
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
