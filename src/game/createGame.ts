import type {Notice} from '../client/notice';
import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";
import type { Position } from "../client/types";
export function createGame(
  parent: HTMLElement,
  onSelect: (p: Position) => void,
  onReady: (location: string) => void,
  onFailure: (failureNoticeValue: Notice) => void,
) {
  if (parent.clientWidth <= 0 || parent.clientHeight <= 0) throw new Error("맵 표시 영역의 크기가 올바르지 않습니다.");
  const scene = new MainScene(onSelect, onReady, onFailure);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: "#0d1d28",
    width: parent.clientWidth,
    height: parent.clientHeight,
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
    render: { antialias: true },
  });
  return { game, scene };
}
