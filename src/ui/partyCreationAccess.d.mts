import type {State} from '../client/types';
export function readPartyCreationIssue(currentGameState: State | null): 'app.partyCreationFormationRequired' | 'app.partyCreationFieldRequired' | 'app.partyCreationGuildRequired' | 'app.partyCreationCitizenshipRequired' | null;
