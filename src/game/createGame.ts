import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";
import type { Position } from "../client/types";
const WIDTH = 1100,
  HEIGHT = 650;
export function createGame(
  parent: HTMLElement,
  onSelect: (p: Position) => void,
  onReady: (location: string) => void,
  onFailure: (message: string) => void,
) {
  const scene = new MainScene(onSelect, onReady, onFailure);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: "#0d1d28",
    width: WIDTH,
    height: HEIGHT,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
    render: { antialias: true },
  });
  return { game, scene };
}
