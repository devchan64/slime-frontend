import Phaser from "phaser";

const NOTICE_STYLE = {
  fontFamily: "sans-serif",
  fontSize: "32px",
  color: "#e7ecf5",
  align: "center"
} as const;
const CENTER_RATIO = 0.5;

export class MainScene extends Phaser.Scene {
  constructor() {
    super("main-scene");
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(
      width * CENTER_RATIO,
      height * CENTER_RATIO,
      "MMO SRPG 준비 중\n채널 탐색과 조우 전투는 아직 구현되지 않았습니다.",
      NOTICE_STYLE
    ).setOrigin(CENTER_RATIO);
  }
}
