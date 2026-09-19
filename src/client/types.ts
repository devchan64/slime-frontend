export type Position = { column: number; row: number };
export type Appearance = { appearance?: "slime" | "beast" | "giant"; heightRatio?: number };
export type Unit = Appearance & {
  id: string;
  name: string;
  owner: string | null;
  side: "ally" | "enemy";
  position: Position;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  move: number;
  range: number[];
  guard: boolean;
};
export type Battle = {
  ready?: string[];
  participants: string[];
  preparationDeadline?: number;
  chatRoomId?: string;
  field: { id: string; version: string; columns: number; rows: number };
  tactics: {
    canAct: boolean;
    moves: { position: Position; path: Position[]; cost: number; attackRange: Position[]; attacks: { targetId: string; damage: number }[] }[];
    attacks: { targetId: string; damage: number }[];
  };
  log: { unitId: string; action: string; turnId: number; at: number;
         damage?: number; targetId?: string; targetHp?: number; path?: Position[] }[];
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
    cp: number;
    attributes: Record<"body" | "intellect" | "spirit", number>;
    requiresStartSpawn: boolean;
    battleId: string | null;
    partyId: string | null;
    lastResult: { result: string; xp: number; coins: number } | null;
  };
  map: {
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
