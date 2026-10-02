export type GuildMembershipSummary = {guildId:'adventurers-guild';characterId:string;certificateStatus:'ISSUED'};
export function validateGuildMembership(currentMembershipValue:unknown,currentCharacterIdentifier:string):GuildMembershipSummary|null|undefined;
