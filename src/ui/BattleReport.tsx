import { useEffect, useRef, useState } from "preact/hooks";
import type { State } from "../client/types";

export const BATTLE_REPORT_SECONDS = 5;
const RESULT_LABELS: Record<string, string> = {
  WIN: "승리", LOSE: "패배", TIMEOUT: "시간 초과", SURRENDER: "기권",
  PREPARATION_FAILED: "전투 준비 실패",
};

export function BattleReport({ result, onReturn }: {
  result: NonNullable<State["me"]["lastResult"]>;
  onReturn: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returned = useRef(false);
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;
  const [seconds, setSeconds] = useState(BATTLE_REPORT_SECONDS);
  const finish = () => {
    if (returned.current) return;
    returned.current = true;
    onReturnRef.current();
  };
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const deadline = Date.now() + BATTLE_REPORT_SECONDS * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) finish();
    }, 100);
    return () => { clearInterval(timer); element.close(); };
  }, []);
  return <dialog ref={dialog} class="battle-report" aria-labelledby="battle-report-title"
    onCancel={event => { event.preventDefault(); finish(); }}>
    <h2 id="battle-report-title">전투 리포트</h2>
    <p class="battle-report-result">{RESULT_LABELS[result.result] ?? result.result}</p>
    <dl><div><dt>획득 재화</dt><dd>+{result.coins}</dd></div></dl>
    <p role="status">{seconds}초 후 맵으로 이동합니다.</p>
    <button autoFocus onClick={finish}>확인</button>
  </dialog>;
}
