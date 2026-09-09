export type ServiceId =
  | 'internet'
  | 'route53'
  | 'shield'
  | 'waf'
  | 'cloudfront'
  | 'apigateway'
  | 'alb'
  | 'ec2'
  | 'lambda'
  | 'cache'
  | 'rds'
  | 'dynamodb'
  | 's3'
  | 'sqs'
  | 'cloudwatch';

export type RequestKind =
  | 'static'
  | 'read'
  | 'write'
  | 'upload'
  | 'search'
  | 'malicious'
  | 'ddos';

export type PacketStatus = 'inflight' | 'success' | 'blocked' | 'dropped' | 'breach';

export type Category =
  | 'source'
  | 'edge'
  | 'security'
  | 'compute'
  | 'data'
  | 'integration'
  | 'observe';

export type Screen = 'title' | 'how' | 'missions' | 'briefing' | 'play' | 'debrief';

export type Mode = 'mission' | 'sandbox' | 'live';

export const KINDS: RequestKind[] = [
  'static',
  'read',
  'write',
  'upload',
  'search',
  'malicious',
  'ddos',
];

export const LEGIT: RequestKind[] = ['static', 'read', 'write', 'upload', 'search'];

export interface ServiceDef {
  id: ServiceId;
  name: string;
  short: string;
  aws: string;
  category: Category;
  blurb: string;
  when: string;
  capex: number;
  opexPerMin: number;
  rps: number;
  latency: number;
  color: string;
  placeable: boolean;
  upgradable?: boolean;
  ports: boolean;
}

export type NodeSize = 1 | 2 | 3;

export interface PlacedNode {
  id: string;
  service: ServiceId;
  size: NodeSize;
  x: number;
  y: number;
  degraded: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface Hop {
  nodeId: string;
  service: ServiceId;
  decision: string;
  latency: number;
}

export interface Packet {
  id: string;
  kind: RequestKind;
  path: string[];
  hop: number;
  t: number;
  status: PacketStatus;
  finalStatus: PacketStatus;
  decisions: string[];
  born: number;
}

export interface NodeRuntime {
  emaRps: number;
  processed: number;
  dropped: number;
  blocked: number;
  hits: number;
  misses: number;
  queueDepth: number;
  utilization: number;
  latency: number;
  tokens: number;
  status: 'idle' | 'ok' | 'warm' | 'hot' | 'saturated';
}

export type Mix = Record<RequestKind, number>;

export interface Metrics {
  served: Mix;
  servedTotal: number;
  seen: Mix;
  seenTotal: number;
  failed: number;
  blocked: number;
  breaches: number;
  originBurns: number;
  revenue: number;
  spend: number;
  cacheHits: number;
  cacheMisses: number;
  cdnHits: number;
  legitOkWindow: number;
  legitTotWindow: number;
  slaHold: number;
}

export type EventType =
  | 'ddos'
  | 'flash'
  | 'stampede'
  | 'spike'
  | 'neighbor'
  | 'poison'
  | 'lull';

export interface ActiveEvent {
  type: EventType;
  title: string;
  detail: string;
  remaining: number;
  duration: number;
  rpsMul: number;
  mix?: Mix;
  cacheMul: number;
  degradeNodeId: string | null;
}

export interface CoachMsg {
  id: string;
  title: string;
  body: string;
  lesson: string;
}

export interface LogLine {
  id: string;
  t: number;
  kind: RequestKind;
  status: PacketStatus;
  path: string;
  money: number;
  reason: string;
}

export interface ObjectiveDef {
  id: string;
  label: string;
  type: 'place' | 'count' | 'path' | 'serve' | 'block' | 'sla' | 'wa' | 'survive' | 'profit';
  service?: ServiceId;
  from?: ServiceId;
  to?: ServiceId;
  n?: number;
}

export interface ObjectiveState {
  id: string;
  label: string;
  done: boolean;
}

export interface Mission {
  id: string;
  kicker: string;
  title: string;
  briefing: string;
  stakes: string;
  win: string;
  hint: string;
  startRps: number;
  rpsGrowth: number;
  mix: Mix;
  events: boolean;
  eventDelay?: number;
  objectives: ObjectiveDef[];
  failSla: number;
  recommended: ServiceId[];
}

export interface Pillars {
  operational: number;
  security: number;
  reliability: number;
  performance: number;
  cost: number;
  sustainability: number;
}

export interface WaScore {
  total: number;
  pillars: Pillars;
}

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'warn' | 'good' | 'bad';
  at: number;
}

export interface GameState {
  screen: Screen;
  mode: Mode;
  missionIndex: number;
  completed: string[];
  money: number;
  simTime: number;
  speed: 0 | 1 | 2 | 4;
  seed: number;
  rng: number;
  nodes: PlacedNode[];
  edges: GraphEdge[];
  packets: Packet[];
  runtime: Record<string, NodeRuntime>;
  metrics: Metrics;
  event: ActiveEvent | null;
  nextEventAt: number;
  log: LogLine[];
  coach: CoachMsg | null;
  seenCoach: string[];
  selectedId: string | null;
  placing: ServiceId | null;
  won: boolean;
  loseReason: string | null;
  spawnAcc: Mix;
  usedTick: Record<string, number>;
  nodeSeq: number;
  edgeSeq: number;
  pktSeq: number;
  bankruptFor: number;
  /** Production only: seconds legitimate SLA has been below the collapse line. */
  slaFailFor: number;
  toasts: Toast[];
  moneySeries: number[];
  slaSeries: number[];
  liveStarted: boolean;
  peakMoney: number;
}
