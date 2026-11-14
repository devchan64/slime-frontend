import currentDefinitionSource from './actionDefinitions.yaml?raw';
import {parseBattlePresentationDefinition} from './definitionSchema';
export const BATTLE_PRESENTATION_DEFINITION=parseBattlePresentationDefinition(currentDefinitionSource);
