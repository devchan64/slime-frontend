import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: "#0e1320",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    scale: {
      mode: Phaser.Scale.FIT,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [new MainScene()]
  });
}
