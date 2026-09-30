import Phaser from "phaser";
import { worldToScreen } from "../map/tiles.js";
import {
  FEET_ROW,
  FRAME,
  SPRITE_SCALE,
  animFrames,
  animPage,
  frameIndex,
  textureKey,
  weaponInFront,
  type AnimName,
  type Facing,
  type HeroLook,
  type Page,
} from "./manaSeed.js";

const ORIGIN_Y = FEET_ROW / FRAME;

export class HeroActor {
  readonly root: Phaser.GameObjects.Container;
  private readonly look: HeroLook;
  private readonly weaponTint: number;
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly outfit: Phaser.GameObjects.Sprite;
  private readonly hair: Phaser.GameObjects.Sprite;
  private readonly weapon: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private combat = false;
  private facing: Facing = 0;
  private anim: AnimName = "stand";
  private page: Page = "p1";
  private frames = animFrames("stand", 0);
  private frame = 0;
  private elapsed = 0;

  constructor(
    scene: Phaser.Scene,
    wx: number,
    wy: number,
    look: HeroLook,
    name: string,
    selected: boolean,
    weaponTint = 0xffffff,
  ) {
    const pos = worldToScreen(wx, wy);
    this.look = look;
    this.weaponTint = weaponTint;
    this.root = scene.add.container(pos.x, pos.y).setDepth(pos.y);

    const shadow = scene.add.graphics().setDepth(1);
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillEllipse(0, 2, 22, 8);

    this.body = layerSprite(scene, textureKey("p1", "0bas", look.body)).setDepth(3);
    this.outfit = layerSprite(scene, textureKey("p1", "1out", look.outfit)).setDepth(4);
    this.hair = layerSprite(scene, textureKey("p1", "4har", look.hair)).setDepth(5);
    this.weapon = layerSprite(scene, textureKey("pONE2", "6tla", look.weapon)).setDepth(2);
    this.weapon.setVisible(false);

    this.label = scene.add
      .text(0, 8, name, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: selected ? "#d6ff9a" : "#f4ecd2",
        fontStyle: "bold",
        stroke: "#111111",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(6)
      .setVisible(selected);

    this.root.add([shadow, this.weapon, this.body, this.outfit, this.hair, this.label]);
    this.applyFrame();
  }

  setCombat(on: boolean): void {
    this.combat = on;
    if (this.anim === "slash") return;
    this.play(on ? "idle" : "stand");
  }

  face(facing: Facing): void {
    this.facing = facing;
    if (this.anim === "slash") return;
    this.play(this.combat ? "idle" : "stand");
  }

  attack(facing: Facing): void {
    this.facing = facing;
    this.play("slash");
  }

  tick(delta: number): void {
    const current = this.frames[this.frame];
    if (!current) return;
    this.elapsed += delta;
    if (this.elapsed < current.ms) return;
    this.elapsed -= current.ms;
    this.frame += 1;
    if (this.frame >= this.frames.length) {
      if (this.anim === "slash") {
        this.facing = 0;
        this.play(this.combat ? "idle" : "stand");
        return;
      }
      this.frame = 0;
    }
    this.applyFrame();
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private play(name: AnimName): void {
    this.anim = name;
    this.frames = animFrames(name, this.facing);
    this.frame = 0;
    this.elapsed = 0;
    this.applyFrame();
  }

  private applyFrame(): void {
    const page = animPage(this.anim);
    const cell = this.frames[this.frame]!;
    const index = frameIndex(cell.col, cell.row);
    const pageChanged = page !== this.page;
    this.page = page;
    bind(this.body, page, "0bas", this.look.body, index, pageChanged);
    bind(this.outfit, page, "1out", this.look.outfit, index, pageChanged);
    bind(this.hair, page, "4har", this.look.hair, index, pageChanged);
    if (page === "p1") {
      this.weapon.setVisible(false);
      return;
    }
    this.weapon.setVisible(true);
    bind(this.weapon, page, "6tla", this.look.weapon, index, pageChanged);
    this.weapon.setTint(this.weaponTint);
    this.weapon.setDepth(weaponInFront(page, cell.col, cell.row) ? 6 : 2);
    this.body.setDepth(3);
    this.outfit.setDepth(4);
    this.hair.setDepth(5);
    this.root.sort("depth");
  }
}

function layerSprite(scene: Phaser.Scene, key: string): Phaser.GameObjects.Sprite {
  return scene.add.sprite(0, 0, key, 0).setOrigin(0.5, ORIGIN_Y).setScale(SPRITE_SCALE);
}

function bind(
  sprite: Phaser.GameObjects.Sprite,
  page: Page,
  layer: "0bas" | "1out" | "4har" | "6tla",
  code: string,
  index: number,
  pageChanged: boolean,
): void {
  const key = textureKey(page, layer, code);
  if (pageChanged || sprite.texture.key !== key) sprite.setTexture(key);
  sprite.setFrame(index);
}

