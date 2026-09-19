import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

export const MINIMUM_LOADING_MS = 1500;

// 하나의 연속 로딩 표시마다 첫 화면 프레임 이후 최소 대기를 보장한다.
export function useMinimumLoading(requested: boolean) {
  const [holding, setHolding] = useState(false);
  const cycle = useRef(false);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    if (requested && !cycle.current) {
      cycle.current = true;
      setHolding(true);
      frame.current = requestAnimationFrame(() => {
        timer.current = setTimeout(() => setHolding(false), MINIMUM_LOADING_MS);
      });
    }
    if (!requested && !holding) cycle.current = false;
  }, [requested, holding]);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  return { loading: requested || holding, minimumElapsed: cycle.current && !holding };
}
