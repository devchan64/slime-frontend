import Phaser from "phaser";
import type { Waypoint } from "./meadow";

const STYLE = {
  tileWidth: 48, tileHeight: 24, radius: 16, lift: 29,
  arrowHalf: 7, arrowRise: 5, arrowGap: 7,
  labelY: -53, labelSize: "12px", line: 2,
  background: 0x123d47, ink: 0xc2fff1, accent: 0x72e8d2,
  depth: 100, labelPadding: 4,
};
const MAP_NAMES: Record<string, string> = {
  meadow: "이슬 초원", grove: "푸른 숲", "mist-lake": "안개 호수", "wind-hills": "바람 구릉",
};

export function waypointMarkerScale(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error("웨이포인트 줌 배율이 유효하지 않습니다.");
  return 1 / zoom;
}

export function drawWaypoint(scene: Phaser.Scene,
  gate: Waypoint, x: number, y: number) {
  const destinationName = gate.targetName ?? MAP_NAMES[gate.target];
  if (!destinationName) throw new Error(`웨이포인트 목적지 이름이 없습니다: ${gate.target}`);
  const ground = scene.add.graphics();
  ground.fillStyle(STYLE.background, 0.85);
  ground.fillEllipse(x, y, STYLE.tileWidth, STYLE.tileHeight);
  ground.lineStyle(STYLE.line, STYLE.ink, 0.9);
  ground.strokeEllipse(x, y, STYLE.tileWidth, STYLE.tileHeight);
  // 전용 이중 화살표 문양은 지면과 화면 고정 크기 마커에 함께 표시한다.
  const symbol = (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => {
    g.lineStyle(STYLE.line, STYLE.ink);
    for (const offset of [-STYLE.arrowGap / 2, STYLE.arrowGap / 2]) {
      g.beginPath();
      g.moveTo(cx - STYLE.arrowHalf, cy + offset + STYLE.arrowRise / 2);
      g.lineTo(cx, cy + offset - STYLE.arrowRise / 2);
      g.lineTo(cx + STYLE.arrowHalf, cy + offset + STYLE.arrowRise / 2);
      g.strokePath();
    }
  };
  symbol(ground, x, y);
  const badge = scene.add.graphics();
  badge.lineStyle(STYLE.line, STYLE.accent);
  badge.lineBetween(0, 0, 0, -STYLE.lift);
  badge.fillStyle(STYLE.background);
  badge.fillCircle(0, -STYLE.lift, STYLE.radius);
  badge.strokeCircle(0, -STYLE.lift, STYLE.radius);
  symbol(badge, 0, -STYLE.lift);
  const label = scene.add.text(0, STYLE.labelY, `→ ${destinationName}`, {
    fontFamily: "sans-serif", fontSize: STYLE.labelSize, color: "#e5fff7",
    backgroundColor: "#123d47ee", padding: { x: STYLE.labelPadding, y: STYLE.labelPadding },
  }).setOrigin(0.5, 1);
  return scene.add.container(x, y, [badge, label]).setDepth(STYLE.depth)
    .setScale(waypointMarkerScale(scene.cameras.main.zoom));
}
