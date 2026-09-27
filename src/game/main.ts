import Phaser from "phaser";
import { PlayScene } from "./PlayScene.js";
import { MAP_COLS, MAP_PAD, MAP_ROWS, TILE_PX } from "../map/tiles.js";

const width = MAP_PAD * 2 + MAP_COLS * TILE_PX;
const height = MAP_PAD * 2 + MAP_ROWS * TILE_PX + 148;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width,
  height,
  backgroundColor: "#141910",
  scene: [PlayScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

void game;
