import type {BorrowedParticipation} from './borrowedParticipation';
export const BORROWED_EXCLUSION_LABELS: {
  EXPIRED: 'battle.supportExpired', OUT_OF_RANGE: 'battle.supportCpMismatch',
  MIGRATION_REQUIRED: 'battle.supportMigration', RECOVERY_PENDING: 'battle.supportRecovering', IN_BATTLE: 'battle.supportBusy',
};
export function parseBorrowedParticipation(currentResponseValue:unknown):BorrowedParticipation;
