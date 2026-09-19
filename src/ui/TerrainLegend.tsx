const TYPES = [
  { kind: "grass", icon: "⋎", name: "풀밭" },
  { kind: "dew", icon: "≈", name: "이슬 지면" },
  { kind: "flowers", icon: "✿", name: "꽃밭" },
  { kind: "road", icon: "─", name: "흙길" },
] as const;

export function TerrainLegend() {
  return <div class="terrain-legend" aria-label="통행 가능한 지형 범례">
    {TYPES.map(({ kind, icon, name }) => <span key={kind}><b class={`legend-${kind}`} aria-hidden="true">{icon}</b>{name}</span>)}
    <small>계단으로 높이 이동 · 절벽·바위·수풀·호수는 통행 불가</small>
  </div>;
}
