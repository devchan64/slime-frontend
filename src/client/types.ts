import type { WorldFacing } from "../game/animation/facing";
import type { ActionCutinEvent } from '../ui/actionCutins';
import type { Surface } from "../game/terrain/elevation";
import type { SkillDefinition } from "./skillText";
export type ConsumableUseAction = {type: "RESTORE_HP"; restorationHp: number; consumedOnSuccess: number} | {type: "PLACE_MARKER"; markerKind: "ROUTE" | "LIGHT"; validSeconds: number; consumedOnSuccess: number};
export type PersonalFieldMarker = {id: string; mapId: string; kind: "ROUTE" | "LIGHT"; position: Position; createdAt: number; expiresAt: number};
export type CityBuilding = {id:string;name:string;facilityId:string;facilityKind:'guild'|'bookshop'|'inn'|'workshop'|'market';npcs?:{id:string;name:string}[];origin:Position;width:number;height:number;entrance:Position;facing:'north'|'south'|'east'|'west'};
export type Position = { column: number; row: number };
export type SizeClass = "small" | "medium" | "large" | "huge";
export type Appearance = { nameTranslations?: Record<"ko" | "en", string>; monsterTypeId?: string; monsterInstanceId?: string; sizeClass?: SizeClass; appearance?: "slime" | "beast" | "giant"; heightRatio?: number };
export type Unit = Appearance & {
  id: string;
  name: string;
  owner: string | null;
  position: Position;
  facing?: WorldFacing;
  /** 적은 서버가 제한한 표시 스케일이며 실제 HP가 아니다. */
  hp: number;
  healthRecoveryPending?: boolean;
  maxHp: number;
  healthVisibility?: "HIDDEN" | "BANDED";
  /** AP 전투에서 서버가 제공하는 실제 잔고. 이전 전투에서는 생략한다. */
  ap?: number;
  maxAp?: number;
  guard: boolean;
} & ({ side: "ally"; attack: number; defense: number; speed: number; move: number; range: number[] }
  | { side: "enemy"; attack?: number; defense?: number; speed?: number; move?: number; range?: number[] });
export type Battlefield = Surface & {
  id: string; version: string; name?: string; description?: string; columns: number; rows: number;
  sourceMapId?: string; sourceMapVersion?: string; selection?: "random" | "fixed"; eventId?: string | null;
  environment?: { themeId: string; backdrop: string; terrainPalette: string[] };
  cells?: (Position & { terrain: "grass" | "dew" | "flowers" | "road" | "rock" | "thicket" | "water" })[];
  blocked?: Position[]; allySpawns?: Position[]; enemySpawns?: Position[];
};
export type Battle = {
  visualVersion?: 1;
  rulesVersion?: string;
  ready?: string[];
  participants: string[];
  preparationDeadline?: number;
  chatRoomId?: string;
  field: Battlefield;
  tactics: {
    canAct: boolean;
    skillActions?: {actionId: string; skillId: string; name: string; apCost: number; targets: {targetId: string; damage: number}[]}[];
    moves: { position: Position; path: Position[]; cost: number; apCost?: number; apAfter?: number; expectedApCost?: number; maximumApCost?: number; attackRange: Position[]; attacks: { targetId: string; damage: number; apCost?: number }[] }[];
    attacks: { targetId: string; damage: number; apCost?: number }[];
  };
  log: { unitId: string; action: string; turnId: number; at: number; stillshot?: ActionCutinEvent;
         damage?: number; targetId?: string; targetHp?: number; path?: Position[]; origin?: Position; position?: Position; facing?: WorldFacing; pathFacings?: WorldFacing[]; autoGuard?: boolean; apCost?: number; apAfter?: number; movementStopped?: boolean }[];
  id: string;
  version: number;
  units: Unit[];
  round: number;
  turnId: number;
  order: string[];
  index: number;
  deadline: number | null;
  absoluteDeadline: number | null;
  status: string;
  moved: boolean;
  acted: boolean;
  blocked: Position[];
};
export type State = {
  location: { id: string; kind: "FIELD" | "BATTLE"; mapId: string; chatRoomId: string; roomReady: boolean };
  protocolVersion: number;
  serverTime: number;
  generation: number;
  epoch: number;
  cursor: number;
  me: {
    citizenshipSummary?: import("./citizenshipSummary").CitizenshipSummary;
    id: string;
    name: string | null;
    version: number;
    mode: string;
    position: Position;
    fieldFacing?: WorldFacing;
    lastMapId: string;
    lastPosition: Position;
    xp: number;
    coins: number;
    borrowedPartyLoanIds?: string[];
    skillUseLocks?: Record<string, {reason: "book_sold"; bookId: string; sourceId: string}>;
    bag?: {capacityG: number; knownWeightG: number; unknownWeightQuantity: number; items: Array<{id: string; kind: "material" | "consumable"; name: string; nameTranslations: Record<"ko" | "en", string>; description: string; quantity: number; weightG: number | null; valueP: number | null; useAction?: ConsumableUseAction}>};
    personalMarkers?: PersonalFieldMarker[];
    scouting?: {minimumUseLevel:number;literacyRequired:number;fpCost:number;ranges:{minimumLevel:number;tiles:number}[]};
    firstAid?: {version: number; minimumUseLevel: number; literacyRequired: number; restorationHp: number; consumableId: string; consumedOnSuccess: number};
    fp?: number;
    fpMax?: number;
    fieldRest?: { active: boolean; startedAt: number | null; recoveryPerMinute: number; nextRecoveryAt: number | null };
    hp?: number;
    healthRecoveryPending?: boolean;
    maxHp?: number;
    fpNextChargeAt?: number | null;
    cp: number;
    /** SP 미지원 API에서는 생략한다. */
    sp?: number;
    cpGeneral: number;
    cpSeasonal: number;
    skills: Record<string, number>;
    skillGrowthBaselines?: Record<string, number>;
    battleSkillLoadout?: string[];
    battleSkillSlotLimit?: number;
    skillDefinitions?: Record<string, SkillDefinition>;
    attributes: Record<"body" | "intellect" | "spirit", number>;
    requiresStartSpawn: boolean;
    battleId: string | null;
    lastFieldInterruption?: { reason: 'AGGRO'; battleId: string; monsterId: string; mapId: string; position: Position; at: number };
    partyId: string | null;
    lastResult: { rewardDistribution?: PartyRewardReportData; stillshots?: ActionCutinEvent[]; battleId?: string; result: string; xp: number; coins: number; lostMaterials?: Array<{materialId: string; name: string; nameTranslations: Record<"ko" | "en", string>; quantity: number; valueP: number | null; useAction?: ConsumableUseAction}>; materials?: Array<{materialId: string; name: string; nameTranslations: Record<"ko" | "en", string>; quantity: number; valueP: number | null; useAction?: ConsumableUseAction}> } | null;
  };
  map: Surface & {
    safeTown?: boolean;
    buildings?: CityBuilding[];
    id: string;
    name: string;
    nameTranslations?: Record<'ko' | 'en', string>;
    columns: number;
    rows: number;
    startPoint: Position;
    safeRadius: number;
    terrainRows?: string[];
    terrainCodes?: Record<string, string>;
    movementCosts?: {version:number;rows:Array<{tileId:string;fp:{baseCost:number;extraChanceBasisPoints:number;extraCost:number}|null}>};
    blocked: Position[];
    connections: (Position & {
      id: string; target: string; name?: string;
      targetName?: string;
      targetSafeTown?: boolean;
      targetNameTranslations?: Record<'ko' | 'en', string>;
      direction?: "west" | "east" | "north" | "south";
      targetWaypointId?: string;
    })[];
  };
  monsters: (Appearance & {
    name?: string;
    id: string;
    position: Position;
    facing?: WorldFacing;
    disposition: string;
    movement?: { mode: "STATIONARY" | "ROAM"; interval: number };
    state: string;
  })[];
  members: { id: string; name: string; position: Position; facing?: WorldFacing; mode: string; fieldRestActive?: boolean; partyCpEligible?: boolean }[];
  party: { id: string; leader: string; members: string[] } | null;
  invitations: { id: string; from: string; partyCpEligible?: boolean }[];
  reservation: {
    id: string;
    members: string[];
    ready: string[];
    deadline: number;
  } | null;
  battle: Battle | null;
  messages: { id: string; name: string; text: string; at: number }[];
};
export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
};
export interface PartyRewardReportData {
  materials: Array<{
    materialId: string; nameTranslations: Record<'ko' | 'en', string>;
    quantity: number; mineQuantity: number;
    recipients: Array<{ id: string; name: string; role: 'initiator' | 'supporter'; isMine: boolean; quantity: number }>;
    allocations: Array<{ itemSequence: number; diceFace: number; recipientId: string }>;
  }>;
}
