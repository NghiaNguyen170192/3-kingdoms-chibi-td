import Phaser from "phaser";
import { worldToScreen } from "../map/tiles.js";
import {
  FEET_ROW,
  FRAME,
  animFrames,
  facingToward,
  frameIndex,
  textureKey,
  type AnimFrame,
  type EnemyLook,
  type Facing,
} from "./manaSeed.js";

const ORIGIN_Y = FEET_ROW / FRAME;

export class EnemyActor {
  readonly root: Phaser.GameObjects.Container;
  private readonly look: EnemyLook;
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly outfit: Phaser.GameObjects.Sprite;
  private readonly hair: Phaser.GameObjects.Sprite;
  private facing: Facing = 2;
  private frames: AnimFrame[];
  private frame = 0;
  private elapsed = 0;
  private wx: number;
  private wy: number;

  constructor(scene: Phaser.Scene, wx: number, wy: number, look: EnemyLook) {
    this.look = look;
    this.wx = wx;
    this.wy = wy;
    const pos = worldToScreen(wx, wy);
    this.root = scene.add.container(pos.x, pos.y).setDepth(pos.y);

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillEllipse(0, 2, 14 * look.scale, 6);

    this.body = layerSprite(scene, textureKey("p1", "0bas", look.body), look);
    this.outfit = layerSprite(scene, textureKey("p1", "1out", look.outfit), look);
    this.hair = layerSprite(scene, textureKey("p1", "4har", look.hair), look);
    this.frames = animFrames(look.gait, this.facing);
    this.root.add([shadow, this.body, this.outfit, this.hair]);
    this.applyFrame();
  }

  setWorld(x: number, y: number): void {
    const dx = x - this.wx;
    const dy = y - this.wy;
    this.wx = x;
    this.wy = y;
    if (dx * dx + dy * dy > 0.0001) {
      const facing = facingToward(0, 0, dx, dy);
      if (facing !== this.facing) {
        this.facing = facing;
        this.frames = animFrames(this.look.gait, facing);
        this.frame = 0;
        this.elapsed = 0;
      }
    }
    const pos = worldToScreen(x, y);
    this.root.setPosition(pos.x, pos.y);
    this.root.setDepth(pos.y);
  }

  tick(delta: number): void {
    const current = this.frames[this.frame];
    if (!current) return;
    this.elapsed += delta;
    if (this.elapsed < current.ms) return;
    this.elapsed -= current.ms;
    this.frame = (this.frame + 1) % this.frames.length;
    this.applyFrame();
  }

  get bodyScale(): number {
    return this.look.scale;
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private applyFrame(): void {
    const cell = this.frames[this.frame]!;
    const index = frameIndex(cell.col, cell.row);
    this.body.setFrame(index);
    this.outfit.setFrame(index);
    this.hair.setFrame(index);
  }
}

function layerSprite(scene: Phaser.Scene, key: string, look: EnemyLook): Phaser.GameObjects.Sprite {
  return scene.add.sprite(0, 0, key, 0).setOrigin(0.5, ORIGIN_Y).setScale(look.scale).setTint(look.tint);
}
