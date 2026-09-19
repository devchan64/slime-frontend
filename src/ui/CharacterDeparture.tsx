import { useEffect, useRef, useState } from "preact/hooks";
import type { State } from "../client/types";
import { unallocatedPoints } from "./departurePoints";

type Props = {
  me: State["me"];
  disabled: boolean;
  onEnter: () => unknown;
};

export function CharacterDeparture({ me, disabled, onEnter }: Props) {
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const points = unallocatedPoints(me);
  const blocked = disabled || !!me.battleId;
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirming]);
  function closeConfirmation() {
    setConfirming(false);
    enterButton.current?.focus();
  }
  return <>
    <div class="character-departure">
      <p>모험을 시작할 준비가 되었나요?<small>{points ? `미배분 ${points}` : "마지막 맵의 시작점으로 이동합니다."}</small></p>
      <button ref={enterButton} disabled={blocked} onClick={() => {
        if (points) setConfirming(true);
        else onEnter();
      }}>{me.battleId ? "진행 중 전투 정산 대기" : "게임으로 가기 →"}</button>
    </div>
    <dialog ref={dialog} class="departure-dialog" aria-labelledby="departure-title" aria-describedby="departure-description"
      onCancel={event => { event.preventDefault(); closeConfirmation(); }}>
      <h2 id="departure-title">아직 배분하지 않은 포인트가 있어요</h2>
      <p id="departure-description">{points ? `${points}가 남아 있습니다. ` : "포인트 배분이 완료되었습니다. "}게임으로 이동할까요?</p>
      <div class="departure-dialog-actions">
        <button class="secondary" autoFocus onClick={closeConfirmation}>설정으로 돌아가기</button>
        <button disabled={blocked} onClick={() => { closeConfirmation(); onEnter(); }}>게임으로 이동</button>
      </div>
    </dialog>
  </>;
}
