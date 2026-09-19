import type { Appearance, SizeClass } from "../../client/types";

export const ACTOR_SIZES = {
  small: { label: "소형", scale: 0.5, tiles: 1 },
  medium: { label: "중형", scale: 1, tiles: 1 },
  large: { label: "대형", scale: 1.5, tiles: 2 },
  huge: { label: "초대형", scale: 2, tiles: 2 },
} as const;
const LEGACY_SIZES: Record<NonNullable<Appearance["appearance"]>, SizeClass> = {
  slime: "small", beast: "medium", giant: "large",
};

export function actorSize(appearance?: Appearance) {
  // 크기 등급 도입 전 저장된 전투는 외형 종류로 새 등급을 결정한다.
  const category = appearance ? appearance.sizeClass ?? LEGACY_SIZES[appearance.appearance ?? "slime"] : "medium";
  const size = ACTOR_SIZES[category];
  if (!size) throw new Error(`지원하지 않는 크기 등급입니다: ${category}`);
  return size;
}
