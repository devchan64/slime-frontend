/** 실제 사용자 입력을 병합한다. 마우스 이동·자동 상태 갱신은 활동이 아니다. */
export const ACTIVITY_INTERVAL_MS = 5000;
export function watchUserActivity(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  notify: () => void,
  now = () => Date.now(),
  schedule: typeof setTimeout = setTimeout,
  cancel: typeof clearTimeout = clearTimeout,
) {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const send = () => {
    timer = undefined;
    if (stopped) return;
    last = now(); notify();
  };
  const input = (event: Event) => {
    if (!event.isTrusted || stopped) return;
    if (timer !== undefined) return;
    const wait = ACTIVITY_INTERVAL_MS - (now() - last);
    if (wait <= 0) send();
    else timer = schedule(send, wait);
  };
  const events = ['pointerdown', 'keydown', 'input'];
  for (const type of events) target.addEventListener(type, input);
  return () => {
    stopped = true;
    if (timer !== undefined) cancel(timer);
    for (const type of events) target.removeEventListener(type, input);
  };
}
