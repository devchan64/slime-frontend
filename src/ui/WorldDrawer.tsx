import { useTranslation } from "../i18n";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

// 보조 메뉴는 맵의 카메라와 선택 상태를 유지한 채 열고 닫는다.
export function WorldDrawer({ title, onClose, children }: {
  title: string; onClose: () => void; children: ComponentChildren;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} class="world-drawer" aria-labelledby="world-drawer-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div class="drawer-heading"><h2 id="world-drawer-title">{title}</h2>
      <button class="secondary compact" autoFocus onClick={onClose}>{t("common.close")}</button></div>
    {children}
  </dialog>;
}
