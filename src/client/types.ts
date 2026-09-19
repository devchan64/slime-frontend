import type { Surface } from "../game/terrain/elevation";
import type { SkillDefinition } from "./skillText";
export type Position = { column: number; row: number };
export type SizeClass = "small" | "medium" | "large" | "huge";
export type Appearance = { monsterTypeId?: string; monsterInstanceId?: string; sizeClass?: SizeClass; appearance?: "slime" | "beast" | "giant"; heightRatio?: number };
export type Unit = Appearance & {
  id: string;
  name: string;
  owner: string | null;
  side: "ally" | "enemy";
  position: Position;
  /** 적은 서버가 제한한 표시 스케일이며 실제 HP가 아니다. */
  hp: number;
  maxHp: number;
  healthVisibility?: "HIDDEN" | "BANDED";
  /** AP 전투에서 서버가 제공하는 실제 잔고. 이전 전투에서는 생략한다. */
  ap?: number;
  maxAp?: number;
  attack: number;
  defense: number;
  speed: number;
  move: number;
  range: number[];
  guard: boolean;
};
export type Battlefield = Surface & {
  id: string; version: string; name?: string; description?: string; columns: number; rows: number;
  sourceMapId?: string; sourceMapVersion?: string; selection?: "random" | "fixed"; eventId?: string | null;
  environment?: { themeId: string; backdrop: string; terrainPalette: string[] };
  cells?: (Position & { terrain: "grass" | "dew" | "flowers" | "road" | "rock" | "thicket" | "water" })[];
  blocked?: Position[]; allySpawns?: Position[]; enemySpawns?: Position[];
};
export type Battle = {
  ready?: string[];
  participants: string[];
  preparationDeadline?: number;
  chatRoomId?: string;
  field: Battlefield;
  tactics: {
    canAct: boolean;
    moves: { position: Position; path: Position[]; cost: number; attackRange: Position[]; attacks: { targetId: string; damage: number }[] }[];
    attacks: { targetId: string; damage: number }[];
  };
  log: { unitId: string; action: string; turnId: number; at: number;
         damage?: number; targetId?: string; targetHp?: number; path?: Position[]; autoGuard?: boolean }[];
  id: string;
  version: number;
  units: Unit[];
  round: number;
  turnId: number;
  order: string[];
  index: number;
  deadline: number;
  absoluteDeadline: number;
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
    id: string;
    name: string | null;
    version: number;
    mode: string;
    position: Position;
    lastMapId: string;
    lastPosition: Position;
    xp: number;
    coins: number;
    fp?: number;
    fpMax?: number;
    fpNextChargeAt?: number | null;
    cp: number;
    /** SP 미지원 API에서는 생략한다. */
    sp?: number;
    cpGeneral: number;
    cpSeasonal: number;
    skills: Record<string, number>;
    skillGrowthBaselines?: Record<string, number>;
    skillDefinitions?: Record<string, SkillDefinition>;
    attributes: Record<"body" | "intellect" | "spirit", number>;
    requiresStartSpawn: boolean;
    battleId: string | null;
    partyId: string | null;
    lastResult: { result: string; xp: number; coins: number } | null;
  };
  map: Surface & {
    id: string;
    name: string;
    columns: number;
    rows: number;
    startPoint: Position;
    safeRadius: number;
    blocked: Position[];
    connections: (Position & {
      id: string; target: string; name?: string;
      targetName?: string;
      direction?: "west" | "east" | "north" | "south";
      targetWaypointId?: string;
    })[];
  };
  monsters: (Appearance & {
    name?: string;
    id: string;
    position: Position;
    disposition: string;
    movement?: { mode: "STATIONARY" | "ROAM"; interval: number };
    state: string;
  })[];
  members: { id: string; name: string; position: Position; mode: string }[];
  party: { id: string; leader: string; members: string[] } | null;
  invitations: { id: string; from: string }[];
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
