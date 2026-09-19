/** 절전·네트워크 복귀는 사용자 입력과 구분해 세션을 재검증한다. */
export function watchBrowserResume(
  page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>,
  browser: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  resume: () => void,
) {
  let hidden = page.visibilityState === 'hidden';
  const visibility = () => {
    if (page.visibilityState === 'hidden') hidden = true;
    else if (hidden) { hidden = false; resume(); }
  };
  const online = () => { if (page.visibilityState === 'visible') resume(); };
  const shown = (event: Event) => {
    if ((event as PageTransitionEvent).persisted && page.visibilityState === 'visible') {
      hidden = false;
      resume();
    }
  };
  page.addEventListener('visibilitychange', visibility);
  browser.addEventListener('online', online);
  browser.addEventListener('pageshow', shown);
  return () => {
    page.removeEventListener('visibilitychange', visibility);
    browser.removeEventListener('online', online);
    browser.removeEventListener('pageshow', shown);
  };
}
