// 무입력 알림은 표시만 갱신한다. 전투 명령은 생성하지 않는다.
export const TURN_IDLE_NOTICE_MS = 5000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'input'] as const;

export function watchTurnIdle(
  target: Pick<Document, 'addEventListener' | 'removeEventListener'>,
  notify: (idle: boolean) => void,
  schedule = setTimeout,
  cancel = clearTimeout,
) {
  let timer: ReturnType<typeof setTimeout>;
  let disposed = false;
  const reset = () => {
    if (disposed) return;
    cancel(timer);
    notify(false);
    timer = schedule(() => { if (!disposed) notify(true); }, TURN_IDLE_NOTICE_MS);
  };
  reset();
  for (const event of ACTIVITY_EVENTS) target.addEventListener(event, reset, true);
  return () => {
    disposed = true;
    cancel(timer);
    for (const event of ACTIVITY_EVENTS) target.removeEventListener(event, reset, true);
  };
}
