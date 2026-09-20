import type { State } from "../client/types";
import { useTranslation } from "../i18n";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterDeparture } from "./CharacterDeparture";

type CharacterSelectionCardProps = {
  currentPlayerState: State["me"];
  actionsAreDisabled: boolean;
  openCharacterSettings: () => unknown;
  openAccountRewards: () => unknown;
  enterCurrentWorld: () => unknown;
};

export function CharacterSelectionCard({
  currentPlayerState, actionsAreDisabled, openCharacterSettings, openAccountRewards, enterCurrentWorld,
}: CharacterSelectionCardProps) {
  const { t: translateCharacterMessage } = useTranslation();
  return <article class="character-selection-card" aria-label={translateCharacterMessage("app.myCharacter")}>
    <div class="character-selection-identity">
      <CharacterPortrait />
      <div class="character-selection-summary">
        <span class="character-selection-status">{translateCharacterMessage("app.currentCharacter")}</span>
        <h2>{currentPlayerState.name}</h2>
        <p>{translateCharacterMessage("app.continueAdventure")}</p>
      </div>
    </div>
    <nav class="character-selection-actions" aria-label={translateCharacterMessage("app.characterNavigation")}>
      <button class="secondary" disabled={actionsAreDisabled} onClick={openCharacterSettings}>
        {translateCharacterMessage("app.characterSettings")}
      </button>
      <button class="secondary" aria-haspopup="dialog" onClick={openAccountRewards}>
        {translateCharacterMessage("rewards.title")}
      </button>
    </nav>
    <CharacterDeparture me={currentPlayerState} disabled={actionsAreDisabled}
      onSettings={openCharacterSettings} onEnter={enterCurrentWorld} />
  </article>;
}
