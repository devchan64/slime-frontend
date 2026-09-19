import { useEffect, useRef } from "preact/hooks";
import type { State } from "../client/types";
import { CharacterSettings } from "./CharacterSettings";

type Props = {
  me: State["me"];
  disabled: boolean;
  command: (path: string, body?: Record<string, unknown>) => unknown;
  onClose: () => void;
};

export function CharacterSettingsDialog({ me, disabled, command, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} class="character-dialog" aria-labelledby="character-settings-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header class="character-dialog-header">
      <h2 id="character-settings-title">캐릭터 설정</h2>
      <button class="secondary compact" onClick={onClose} autoFocus>닫기</button>
    </header>
    <p>{me.name}</p>
    <CharacterSettings me={me} disabled={disabled} command={command} expanded />
    {!["LOBBY", "FIELD"].includes(me.mode) && <p>전투·조우 준비 중에는 CP를 분배할 수 없습니다.</p>}
  </dialog>;
}
