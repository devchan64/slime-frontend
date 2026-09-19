import { useTranslation } from '../i18n';
import { useEffect, useRef, useState } from "preact/hooks";
import type { State } from "../client/types";
import { unallocatedPoints } from "./departurePoints";

type Props = {
  me: State["me"];
  disabled: boolean;
  onEnter: () => unknown;
};

export function CharacterDeparture({ me, disabled, onEnter }: Props) {
  const { t } = useTranslation();
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
      <p>{t('character.ready')}<small>{points ? t('character.remaining', { points }) : t('character.location')}</small></p>
      <button ref={enterButton} disabled={blocked} onClick={() => {
        if (points) setConfirming(true);
        else onEnter();
      }}>{me.battleId ? t('character.pending') : t('character.enter')}</button>
    </div>
    <dialog ref={dialog} class="departure-dialog" aria-labelledby="departure-title" aria-describedby="departure-description"
      onCancel={event => { event.preventDefault(); closeConfirmation(); }}>
      <h2 id="departure-title">{t('character.title')}</h2>
      <p id="departure-description">{points ? t('character.confirm', { points }) : t('character.allocated')}</p>
      <div class="departure-dialog-actions">
        <button class="secondary" autoFocus onClick={closeConfirmation}>{t('character.back')}</button>
        <button disabled={blocked} onClick={() => { closeConfirmation(); onEnter(); }}>{t('character.proceed')}</button>
      </div>
    </dialog>
  </>;
}
