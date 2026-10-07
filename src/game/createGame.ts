import {GAME_INTERNAL_RESOLUTION_SCALE} from './renderQuality';
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
    width: parent.clientWidth * GAME_INTERNAL_RESOLUTION_SCALE,
    height: parent.clientHeight * GAME_INTERNAL_RESOLUTION_SCALE,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / GAME_INTERNAL_RESOLUTION_SCALE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
    render: { antialias: true, pixelArt: false, roundPixels: false },
    callbacks: { postBoot: (currentGameInstance: Phaser.Game) => {
      // NONE의 resize는 표시 배율과 포인터 좌표 변환을 함께 갱신한다.
      const currentViewportObserver = new ResizeObserver(() => {
        if (parent.clientWidth <= 0 || parent.clientHeight <= 0) return;
        const currentBufferWidth = parent.clientWidth * GAME_INTERNAL_RESOLUTION_SCALE;
        const currentBufferHeight = parent.clientHeight * GAME_INTERNAL_RESOLUTION_SCALE;
        if (currentGameInstance.scale.width !== currentBufferWidth || currentGameInstance.scale.height !== currentBufferHeight)
          currentGameInstance.scale.resize(currentBufferWidth, currentBufferHeight);
      });
      currentViewportObserver.observe(parent);
      currentGameInstance.events.once(Phaser.Core.Events.DESTROY, () => currentViewportObserver.disconnect());
    } },
  });
  return { game, scene };
}
