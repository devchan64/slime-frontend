import type { Position, State } from '../client/types';
import { heightAt } from '../game/terrain/elevation';
import { useTranslation } from '../i18n';
import { FieldLocationHelp } from './FieldPanel';
import { sameCell } from './fieldNavigation';
import { TerrainLegend } from './TerrainLegend';

export function FieldMapHelp({ currentFieldState, selectedFieldPosition }: {
  currentFieldState: State; selectedFieldPosition: Position | null;
}) {
  const { t: translateHelpMessage } = useTranslation();
  const selectedMonsterPresent = selectedFieldPosition !== null && currentFieldState.monsters.some(
    currentMonsterEntry => currentMonsterEntry.state !== 'COOLDOWN' && sameCell(currentMonsterEntry.position, selectedFieldPosition),
  );
  return <section class="card field-help-card" aria-label={translateHelpMessage('app.fieldHelp')}>
    <div class="field-help-context" aria-live="polite">
      {!selectedFieldPosition ? <p>{translateHelpMessage('app.fieldHelpSelect')}</p>
        : selectedMonsterPresent ? <>
          <p class="field-help-coordinates">{translateHelpMessage('field.compactCoordinates', {
            column: selectedFieldPosition.column, row: selectedFieldPosition.row,
            height: heightAt(selectedFieldPosition, currentFieldState.map),
          })}</p>
          <p>{translateHelpMessage('app.fieldHelpEncounter')}</p>
        </> : <FieldLocationHelp state={currentFieldState} selected={selectedFieldPosition} />}
    </div>
    <ul class="field-help-controls" aria-label={translateHelpMessage('app.cameraControls')}>
      <li>{translateHelpMessage('app.fieldHelpSelection')}</li>
      <li>{translateHelpMessage('app.fieldHelpCamera')}</li>
      <li>{translateHelpMessage('app.fieldHelpReset')}</li>
    </ul>
    <TerrainLegend />
    <p class="field-help-position">{translateHelpMessage('app.position', {
      column: currentFieldState.me.position.column, row: currentFieldState.me.position.row,
      status: translateHelpMessage(currentFieldState.me.mode === 'RESERVED' ? 'app.reserved' : 'app.exploring'),
    })}</p>
  </section>;
}
