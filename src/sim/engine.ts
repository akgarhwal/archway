import {
  CATALOG,
  DEFAULT_MIX,
  KIND_META,
  LIVE_MIX,
  LIVE_START_RPS,
  START_GRANT,
  SIZE_CAP,
  SIZE_OPEX,
  UPGRADE_COST,
} from '../data/catalog';
import { eventOrder, LIVE_FIRST_EVENT, makeEvent } from '../data/events';
import { MISSIONS } from '../data/missions';
import type {
  CoachMsg,
  GameState,
  LogLine,
  Mix,
  NodeRuntime,
  ObjectiveState,
  Packet,
  PacketStatus,
  PlacedNode,
  RequestKind,
  ServiceId,
} from '../types';
import { KINDS, LEGIT } from '../types';
import { pick, rand } from './rng';
import {
  burnPerMin,
  countService,
  hasPath,
  hasService,
  internetNode,
  neighbors,
  publicDataStore,
  sla,
  SLA_WINDOW,
  wellArchitected,
} from './score';

const SAVE_SERIES = 48;
const MAX_PACKETS = 90;
const MAX_LOG = 42;
const MAX_QUEUE = 80;
const TRAVERSE = 0.38;

const ORIGIN: ServiceId[] = [
  'apigateway',
  'alb',
  'ec2',
  'lambda',
  'cache',
  'rds',
  'dynamodb',
  's3',
  'sqs',
];
const COMPUTE: ServiceId[] = ['ec2', 'lambda'];
const DATA: ServiceId[] = ['rds', 'dynamodb'];

function emptyMix(): Mix {
  return { static: 0, read: 0, write: 0, upload: 0, search: 0, malicious: 0, ddos: 0 };
}

function emptyRuntime(): NodeRuntime {
  return {
    emaRps: 0,
    processed: 0,
    dropped: 0,
    blocked: 0,
    hits: 0,
    misses: 0,
    queueDepth: 0,
    utilization: 0,
    latency: 0,
    tokens: 0,
    status: 'idle',
  };
}

function emptyMetrics(): GameState['metrics'] {
  return {
    served: emptyMix(),
    servedTotal: 0,
    seen: emptyMix(),
    seenTotal: 0,
    failed: 0,
    blocked: 0,
    breaches: 0,
    originBurns: 0,
    revenue: 0,
    spend: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cdnHits: 0,
    legitOkWindow: 0,
    legitTotWindow: 0,
    slaHold: 0,
  };
}

export function normalize(mix: Mix): Mix {
  let t = 0;
  for (const k of KINDS) t += mix[k] || 0;
  if (t <= 0) return { ...DEFAULT_MIX };
  const out = emptyMix();
  for (const k of KINDS) out[k] = (mix[k] || 0) / t;
  return out;
}

export function capacityRps(node: PlacedNode): number {
  const d = CATALOG[node.service];
  const sizeMul = d.upgradable ? SIZE_CAP[node.size] : 1;
  let rps = d.rps * sizeMul;
  if (node.service === 'lambda') rps = 18 * sizeMul + 42;
  if (node.degraded) rps *= 0.55;
  return Math.max(0.4, rps);
}

export function opexPerMin(node: PlacedNode): number {
  const d = CATALOG[node.service];
  const mul = d.upgradable ? SIZE_OPEX[node.size] : 1;
  return d.opexPerMin * mul;
}

/** Capex + size upgrades actually paid for this box. */
export function investedIn(node: PlacedNode): number {
  const d = CATALOG[node.service];
  let paid = d.capex;
  if (d.upgradable) {
    if (node.size >= 2) paid += UPGRADE_COST[2];
    if (node.size >= 3) paid += UPGRADE_COST[3];
  }
  return paid;
}

export function saleRefund(node: PlacedNode): number {
  return investedIn(node) * 0.5;
}

function rt(state: GameState, id: string): NodeRuntime {
  if (!state.runtime[id]) state.runtime[id] = emptyRuntime();
  if (typeof state.runtime[id].tokens !== 'number') state.runtime[id].tokens = 0;
  return state.runtime[id];
}

export function createInitialState(mode: ModeLike, missionIndex: number, seed?: number): GameState {
  const s = seed ?? (Date.now() % 1_000_000_007);
  const live = mode === 'live';
  const grant = START_GRANT;
  return {
    screen: 'play',
    mode,
    missionIndex,
    completed: [],
    money: grant,
    simTime: 0,
    speed: live ? 0 : 1,
    seed: s,
    rng: s,
    nodes: [
      {
        id: 'n_internet',
        service: 'internet',
        size: 1,
        x: 48,
        y: 240,
        degraded: false,
      },
    ],
    edges: [],
    packets: [],
    runtime: { n_internet: emptyRuntime() },
    metrics: emptyMetrics(),
    event: null,
    nextEventAt: live ? LIVE_FIRST_EVENT : mode === 'sandbox' ? 18 : (MISSIONS[missionIndex]?.eventDelay ?? 22),
    log: [],
    coach: {
      id: 'welcome',
      title: live ? 'Design first. Then open the wire.' : mode === 'sandbox' ? 'Sandbox is live' : 'Wire the first hop',
      body: live
        ? 'You have $7,200 — exactly ten EC2s, which is the trap. A real path is WAF and CloudFront before more compute. Once you go live you cannot pause. Traffic will rise, fall, and attack. Idle boxes still bill. Only an architecture that belongs in production prints money.'
        : mode === 'sandbox'
          ? 'Users are already on the wire. Buy components, drag handles to connect them, and watch packets choose a path. Bad traffic is mixed in from the start.'
          : 'Drag EC2 from the catalog onto the canvas, then connect Internet → EC2. Packets only travel on wires you draw.',
      lesson: live
        ? 'Edge before origin. Two targets behind the ALB. Cache the reads. Queue the writes. Right-size the rest.'
        : 'A system design is a request path plus a bill. Everything else is commentary.',
    },
    seenCoach: ['welcome'],
    selectedId: null,
    placing: null,
    won: false,
    loseReason: null,
    spawnAcc: emptyMix(),
    usedTick: {},
    nodeSeq: 1,
    edgeSeq: 1,
    pktSeq: 1,
    bankruptFor: 0,
    toasts: [],
    moneySeries: [grant],
    slaSeries: [100],
    liveStarted: !live,
    peakMoney: grant,
  };
}

export function goLive(state: GameState): GameState {
  const already = state.mode === 'live' && state.liveStarted && state.speed > 0;
  if (already) return state;
  return {
    ...state,
    mode: 'live',
    screen: 'play',
    liveStarted: true,
    speed: 1,
    simTime: state.liveStarted ? state.simTime : 0,
    loseReason: null,
    won: false,
    coach: {
      id: 'live-go',
      title: 'You are in production',
      body: 'The wire is open. You cannot pause. Keep buying and rewiring under fire. Quiet minutes still invoice. DDoS is a bill attack.',
      lesson: 'Production does not wait for the diagram to feel finished.',
    },
    seenCoach: state.seenCoach.includes('live-go') ? state.seenCoach : [...state.seenCoach, 'live-go'],
    toasts: [{ id: 'go', text: 'Live traffic is on the wire', tone: 'warn' as const, at: 0 }],
  };
}

type ModeLike = GameState['mode'];

export function titleState(completed: string[]): GameState {
  const s = createInitialState('sandbox', 0, 1);
  s.screen = 'title';
  s.speed = 0;
  s.completed = completed;
  s.coach = null;
  return s;
}

interface HopResult {
  status: PacketStatus | 'forward';
  next?: string;
  decision: string;
  latency: number;
  money: number;
  reason: string;
}

function take(state: GameState): number {
  const [n, r] = rand(state.rng);
  state.rng = n;
  return r;
}

function takePick<T>(state: GameState, arr: T[]): T {
  const [n, v] = pick(state.rng, arr);
  state.rng = n;
  return v;
}

function cacheFactor(state: GameState): number {
  return state.event?.cacheMul ?? 1;
}

function hasWatch(state: GameState): boolean {
  return hasService(state.nodes, 'cloudwatch');
}

function isOrigin(s: ServiceId): boolean {
  return ORIGIN.includes(s);
}

function capTick(node: PlacedNode, dt: number): number {
  return capacityRps(node) * dt;
}

function refillTokens(state: GameState, dt: number) {
  for (const n of state.nodes) {
    const r = rt(state, n.id);
    const cap = capacityRps(n);
    r.tokens = Math.min(cap * 1.6, r.tokens + cap * dt);
  }
}

function tryUse(state: GameState, node: PlacedNode, _dt: number, weight = 1): boolean {
  const r = rt(state, node.id);
  if (r.tokens < weight) return false;
  r.tokens -= weight;
  state.usedTick[node.id] = (state.usedTick[node.id] ?? 0) + weight;
  r.processed += 1;
  return true;
}

function hopLatency(node: PlacedNode, util: number): number {
  const base = CATALOG[node.service].latency;
  return base * (1 + 2.4 * Math.max(0, util - 0.7));
}

function utilNow(state: GameState, node: PlacedNode, dt: number): number {
  const cap = Math.max(0.001, capTick(node, dt));
  const used = state.usedTick[node.id] ?? 0;
  return used / cap;
}

function outs(state: GameState, id: string): PlacedNode[] {
  return neighbors(state.nodes, state.edges, id);
}

function prefer(
  cands: PlacedNode[],
  order: ServiceId[],
): PlacedNode[] {
  const ranked = [...cands].sort((a, b) => {
    const ia = order.indexOf(a.service);
    const ib = order.indexOf(b.service);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return ranked;
}

function splitOrPrefer(
  state: GameState,
  cands: PlacedNode[],
  order: ServiceId[],
  equalSplit: boolean,
): PlacedNode | undefined {
  if (!cands.length) return undefined;
  if (equalSplit) return takePick(state, cands);
  const ranked = prefer(cands, order);
  const bestRank = order.indexOf(ranked[0].service);
  const top = ranked.filter((n) => order.indexOf(n.service) === bestRank || (bestRank === -1 && true));
  return takePick(state, top.length ? top : ranked);
}

function processNode(
  state: GameState,
  node: PlacedNode,
  kind: RequestKind,
  dt: number,
): HopResult {
  const svc = node.service;
  const cands = outs(state, node.id);
  const util = utilNow(state, node, dt);
  const lat = hopLatency(node, util);
  const r = rt(state, node.id);

  if (svc === 'cloudwatch') {
    return {
      status: 'dropped',
      decision: 'NOT ON PATH',
      latency: 0,
      money: 0,
      reason: 'CloudWatch is observability, not a hop',
    };
  }

  const ok = tryUse(state, node, dt, kind === 'search' ? 2 : 1);
  if (!ok && svc !== 'internet' && svc !== 'sqs') {
    r.dropped += 1;
    if (LEGIT.includes(kind)) {
      return {
        status: 'dropped',
        decision: 'SATURATED',
        latency: lat,
        money: -0.55,
        reason: `${CATALOG[svc].short} saturated — request dropped`,
      };
    }
    if (kind === 'ddos' && isOrigin(svc)) {
      return {
        status: 'dropped',
        decision: 'ORIGIN DROP',
        latency: lat,
        money: -0.45,
        reason: 'DDoS dropped after wasting origin capacity',
      };
    }
  }

  if (svc === 'internet') {
    const next = splitOrPrefer(
      state,
      cands,
      ['route53', 'shield', 'waf', 'cloudfront', 'apigateway', 'alb', 'ec2', 'lambda', 's3', 'sqs', 'cache', 'rds', 'dynamodb'],
      true,
    );
    if (!next) {
      return {
        status: 'dropped',
        decision: 'NO ROUTE',
        latency: 0,
        money: state.mode === 'live' && LEGIT.includes(kind) ? -0.55 : 0,
        reason: 'Internet has no outbound wire',
      };
    }
    return { status: 'forward', next: next.id, decision: 'ROUTE', latency: 1, money: 0, reason: '' };
  }

  if (svc === 'route53') {
    const live = cands.filter((n) => (state.runtime[n.id]?.utilization ?? 0) < 1.15);
    const pool = live.length ? live : cands;
    const next = splitOrPrefer(
      state,
      pool,
      ['shield', 'waf', 'cloudfront', 'apigateway', 'alb', 'ec2', 'lambda'],
      true,
    );
    if (!next) return fail(kind, lat, 'DNS has no target');
    return fwd(next.id, 'RESOLVE', lat);
  }

  if (svc === 'shield') {
    if (kind === 'ddos' && take(state) < 0.88) {
      r.blocked += 1;
      return {
        status: 'blocked',
        decision: 'ABSORB L3/L4',
        latency: lat,
        money: 0.04,
        reason: 'Shield absorbed volumetric flood',
      };
    }
    const next = splitOrPrefer(state, cands, ['waf', 'cloudfront', 'apigateway', 'alb', 'ec2'], true);
    if (!next) return terminateAtEdge(state, node, kind, lat);
    return fwd(next.id, kind === 'ddos' ? 'LEAK' : 'PASS', lat);
  }

  if (svc === 'waf') {
    if (kind === 'malicious') {
      const bypass = !ok || take(state) > 0.92;
      if (!bypass) {
        r.blocked += 1;
        return {
          status: 'blocked',
          decision: 'BLOCK L7',
          latency: lat,
          money: 0.04,
          reason: 'WAF blocked SQLi/XSS/bot',
        };
      }
      maybeCoach(state, 'waf-bypass', {
        title: 'WAF failed open',
        body: 'A saturated or unlucky WAF let a malicious request through. Size the WAF for peak, and never leave a parallel path around it.',
        lesson: 'Inspection has a capacity. Undersized WAFs become expensive routers.',
      });
    }
    if (kind === 'ddos' && take(state) < 0.42) {
      r.blocked += 1;
      return {
        status: 'blocked',
        decision: 'RATE LIMIT',
        latency: lat,
        money: 0.04,
        reason: 'WAF rate-limited the flood',
      };
    }
    const next = splitOrPrefer(
      state,
      cands,
      ['cloudfront', 'apigateway', 'alb', 'ec2', 'lambda', 's3'],
      true,
    );
    if (!next) return terminateAtEdge(state, node, kind, lat);
    return fwd(next.id, 'ALLOW', lat);
  }

  if (svc === 'cloudfront') {
    if (kind === 'ddos' && take(state) < 0.58) {
      r.blocked += 1;
      return {
        status: 'blocked',
        decision: 'EDGE ABSORB',
        latency: lat,
        money: 0.04,
        reason: 'CloudFront soaked flood at PoP',
      };
    }
    if (kind === 'malicious' && take(state) < 0.12) {
      r.blocked += 1;
      return {
        status: 'blocked',
        decision: 'BOT SCORE',
        latency: lat,
        money: 0.04,
        reason: 'CDN bot score dropped the request',
      };
    }
    const hitP = kind === 'static' ? 0.78 * cacheFactor(state) : kind === 'read' ? 0.16 * cacheFactor(state) : 0;
    if (hitP > 0 && take(state) < hitP) {
      r.hits += 1;
      state.metrics.cdnHits += 1;
      return success(kind, lat * 0.4, 'HIT');
    }
    r.misses += 1;
    const order: ServiceId[] =
      kind === 'static' || kind === 'upload'
        ? ['s3', 'alb', 'apigateway', 'ec2', 'lambda']
        : ['apigateway', 'alb', 'ec2', 'lambda', 's3'];
    const next = splitOrPrefer(state, cands, order, false);
    if (!next) {
      if (kind === 'static') return success(kind, lat, 'EDGE ORIGIN');
      return fail(kind, lat, 'CDN has no origin');
    }
    return fwd(next.id, 'MISS', lat);
  }

  if (svc === 'apigateway') {
    if (kind === 'ddos' && take(state) < 0.35) {
      r.dropped += 1;
      return {
        status: 'dropped',
        decision: 'THROTTLE',
        latency: lat,
        money: -0.2,
        reason: 'API Gateway throttled — still an origin-adjacent hop',
      };
    }
    const next = splitOrPrefer(state, cands, ['alb', 'lambda', 'ec2', 'sqs'], true);
    if (!next) return serveLocal(state, node, kind, lat);
    return fwd(next.id, 'ROUTE', lat);
  }

  if (svc === 'alb') {
    const targets = cands.filter((n) => COMPUTE.includes(n.service));
    if (!targets.length) {
      maybeCoach(state, 'alb-empty', {
        title: 'ALB has no targets',
        body: 'A load balancer with nothing behind it is a 502 factory. Wire at least two healthy compute nodes.',
        lesson: 'ALB spreads traffic. It does not create capacity.',
      });
      return fail(kind, lat, 'ALB has no healthy targets');
    }
    targets.sort((a, b) => utilNow(state, a, dt) - utilNow(state, b, dt));
    const next = targets[0];
    if (kind === 'ddos' || kind === 'malicious') {
      return {
        status: 'forward',
        next: next.id,
        decision: 'SPREAD',
        latency: lat,
        money: kind === 'ddos' ? -1.6 : 0,
        reason: '',
      };
    }
    return fwd(next.id, 'BALANCE', lat);
  }

  if (COMPUTE.includes(svc)) {
    if (kind === 'ddos') {
      state.metrics.originBurns += 1;
      const bill = svc === 'lambda' ? 3.4 : 2.2;
      maybeCoach(state, 'ddos-origin', {
        title: 'DDoS is landing on compute',
        body:
          svc === 'lambda'
            ? 'Lambda scaled to meet the flood. That is the opposite of protection — you just bought every attacker request.'
            : 'EC2 is spending CPU on garbage. Put Shield / CloudFront / WAF in front so origin never sees this.',
        lesson: 'Scale is not a WAF. Edge absorption is.',
      });
      return {
        status: 'dropped',
        decision: 'ORIGIN BURN',
        latency: lat,
        money: -bill,
        reason: `${CATALOG[svc].short} processed DDoS`,
      };
    }
    if (kind === 'malicious') {
      const db = cands.find((n) => DATA.includes(n.service));
      if (db) return { status: 'forward', next: db.id, decision: 'PWNED FORWARD', latency: lat, money: -6, reason: '' };
      return breach(state, lat, `${CATALOG[svc].short} compromised`, 6);
    }
    const next = pickFromCompute(cands, kind);
    if (next) return fwd(next.id, 'APP', lat);
    return serveLocal(state, node, kind, lat);
  }

  if (svc === 'cache') {
    if (kind === 'malicious') return breach(state, lat, 'Cache exposed / poisoned', 8);
    if (kind === 'ddos') {
      state.metrics.originBurns += 1;
      return { status: 'dropped', decision: 'CACHE BURN', latency: lat, money: -1.4, reason: 'Flood hit ElastiCache' };
    }
    if (kind === 'read' || kind === 'search') {
      const p = 0.72 * cacheFactor(state);
      if (take(state) < p) {
        r.hits += 1;
        state.metrics.cacheHits += 1;
        maybeCoach(state, 'cache-hit', {
          title: 'Cache hit',
          body: 'This read never touched RDS. That is the entire point of ElastiCache — origin QPS collapses as hit ratio climbs.',
          lesson: 'A cache sits beside compute, not on the public internet.',
        });
        return success(kind, lat, 'HIT');
      }
      r.misses += 1;
      state.metrics.cacheMisses += 1;
      const db = cands.find((n) => DATA.includes(n.service));
      if (db) return fwd(db.id, 'MISS', lat);
      return fail(kind, lat, 'Cache miss with no database');
    }
    if (kind === 'write') {
      const db = cands.find((n) => DATA.includes(n.service));
      if (db) return fwd(db.id, 'INVALIDATE', lat);
      return fail(kind, lat, 'Write missed the database');
    }
    return fail(kind, lat, 'Cache does not serve this kind');
  }

  if (DATA.includes(svc)) {
    if (kind === 'malicious') return breach(state, lat, `SQL/NoSQL breach on ${CATALOG[svc].short}`, 18);
    if (kind === 'ddos') {
      state.metrics.originBurns += 1;
      return { status: 'dropped', decision: 'DB BURN', latency: lat, money: -2.8, reason: 'Flood hit the database' };
    }
    if (kind === 'static' || kind === 'upload') {
      return fail(kind, lat, `${CATALOG[svc].short} is not object storage`);
    }
    return success(kind, lat, 'QUERY');
  }

  if (svc === 's3') {
    if (kind === 'malicious') {
      return {
        status: 'blocked',
        decision: 'DENY',
        latency: lat,
        money: 0.02,
        reason: 'S3 blocked a crafted object request',
      };
    }
    if (kind === 'ddos') {
      state.metrics.originBurns += 1;
      return { status: 'dropped', decision: 'S3 BURN', latency: lat, money: -0.9, reason: 'Flood pulled from S3' };
    }
    if (kind === 'static' || kind === 'upload' || kind === 'read') return success(kind, lat, 'OBJECT');
    return fail(kind, lat, 'S3 is the wrong store for this request');
  }

  if (svc === 'sqs') {
    if (kind === 'malicious') {
      r.queueDepth = Math.min(MAX_QUEUE, r.queueDepth + 1);
      return {
        status: 'blocked',
        decision: 'POISON QUEUED',
        latency: lat,
        money: -0.8,
        reason: 'Poison message landed on SQS — needs a DLQ in real life',
      };
    }
    if (kind === 'ddos') {
      r.queueDepth = Math.min(MAX_QUEUE, r.queueDepth + 1);
      return { status: 'dropped', decision: 'QUEUE FLOOD', latency: lat, money: -0.5, reason: 'DDoS filled the queue' };
    }
    if (kind === 'write' || kind === 'upload') {
      if (r.queueDepth >= MAX_QUEUE) {
        r.dropped += 1;
        maybeCoach(state, 'queue-overflow', {
          title: 'Queue overflow',
          body: 'SQS accepted until it could not. Add consumers (EC2/Lambda) or the buffer becomes a cliff.',
          lesson: 'A queue delays the problem. Workers still have to exist.',
        });
        return fail(kind, lat, 'SQS overflow');
      }
      r.queueDepth += 1;
      return success(kind, lat, 'ENQUEUE 202');
    }
    return fail(kind, lat, 'SQS is for async writes');
  }

  return fail(kind, lat, 'No handler');
}

function fwd(next: string, decision: string, latency: number): HopResult {
  return { status: 'forward', next, decision, latency, money: 0, reason: '' };
}

function fail(kind: RequestKind, latency: number, reason: string): HopResult {
  return {
    status: 'dropped',
    decision: 'FAIL',
    latency,
    money: LEGIT.includes(kind) ? -0.55 : 0,
    reason,
  };
}

function success(kind: RequestKind, latency: number, decision: string): HopResult {
  const earn = LEGIT.includes(kind) ? KIND_META[kind].earn : KIND_META[kind].earn;
  return {
    status: 'success',
    decision,
    latency,
    money: earn,
    reason: decision,
  };
}

function breach(state: GameState, latency: number, reason: string, cost: number): HopResult {
  state.metrics.breaches += 1;
  maybeCoach(state, 'breach', {
    title: 'Request became a breach',
    body: 'Malicious traffic reached compute or data. In production this is lost data, not a red packet. WAF belongs in front of origin, and databases are never public.',
    lesson: 'Security is a hop on the path, not a document.',
  });
  return { status: 'breach', decision: 'BREACH', latency, money: -cost, reason };
}

function terminateAtEdge(state: GameState, node: PlacedNode, kind: RequestKind, lat: number): HopResult {
  if (kind === 'ddos' || kind === 'malicious') {
    rt(state, node.id).blocked += 1;
    return {
      status: 'blocked',
      decision: 'EDGE END',
      latency: lat,
      money: 0.04,
      reason: 'Stopped at edge with no origin',
    };
  }
  return fail(kind, lat, `${CATALOG[node.service].short} has no next hop`);
}

function serveLocal(
  state: GameState,
  _node: PlacedNode,
  kind: RequestKind,
  lat: number,
): HopResult {
  if (kind === 'malicious') return breach(state, lat, 'App parsed an attack', 6);
  if (kind === 'ddos') {
    state.metrics.originBurns += 1;
    return { status: 'dropped', decision: 'ORIGIN BURN', latency: lat, money: -2.2, reason: 'Flood served by origin' };
  }
  if (LEGIT.includes(kind)) {
    if ((kind === 'read' || kind === 'write' || kind === 'search') && !hasService(state.nodes, 'rds') && !hasService(state.nodes, 'dynamodb') && !hasService(state.nodes, 'cache')) {
      maybeCoach(state, 'local-disk', {
        title: 'Serving from the instance',
        body: 'EC2 answered from local memory/disk. That works for a demo and dies in production. Add a database, a cache, or S3 depending on the request kind.',
        lesson: 'Compute is not storage. Wire the data plane.',
      });
    }
    return success(kind, lat + 8, 'LOCAL');
  }
  return fail(kind, lat, 'Cannot serve locally');
}

function pickFromCompute(cands: PlacedNode[], kind: RequestKind): PlacedNode | undefined {
  const of = (...ids: ServiceId[]) => cands.find((n) => ids.includes(n.service));
  if (kind === 'static' || kind === 'upload') return of('s3');
  if (kind === 'read') return of('cache', 'dynamodb', 'rds');
  if (kind === 'write') return of('sqs', 'dynamodb', 'rds');
  if (kind === 'search') return of('cache', 'dynamodb', 'rds');
  return undefined;
}

interface Resolved {
  path: string[];
  decisions: string[];
  status: PacketStatus;
  money: number;
  reason: string;
  latency: number;
}

function resolveRequest(state: GameState, kind: RequestKind, dt: number): Resolved {
  const inet = internetNode(state.nodes);
  const path: string[] = [];
  const decisions: string[] = [];
  let money = 0;
  let latency = 0;
  let reason = '';
  let status: PacketStatus = 'dropped';
  if (!inet) return { path, decisions, status, money, reason: 'no internet', latency };

  let current = inet.id;
  const seen = new Set<string>();

  for (let i = 0; i < 14; i++) {
    if (seen.has(current)) {
      status = 'dropped';
      reason = 'routing cycle';
      money += LEGIT.includes(kind) ? -0.55 : 0;
      break;
    }
    seen.add(current);
    path.push(current);
    const node = state.nodes.find((n) => n.id === current);
    if (!node) break;

    if (publicDataStore(state.nodes, state.edges) && node.service === 'internet') {
      maybeCoach(state, 'public-db', {
        title: 'Database is on the public internet',
        body: 'You wired Users straight into a data store. Every malicious packet is now a breach attempt with no app tier in the way.',
        lesson: 'Security groups exist because this drawing is a production outage.',
      });
    }

    const hop = processNode(state, node, kind, dt);
    decisions.push(`${CATALOG[node.service].short}:${hop.decision}`);
    latency += hop.latency;
    money += hop.money;
    reason = hop.reason || reason;

    if (hop.status !== 'forward') {
      status = hop.status;
      break;
    }
    if (!hop.next) {
      status = 'dropped';
      break;
    }
    current = hop.next;
    if (i === 13) {
      status = 'dropped';
      reason = 'too many hops';
    }
  }

  return { path, decisions, status, money, reason, latency };
}

function applyOutcome(state: GameState, kind: RequestKind, res: Resolved) {
  const legit = LEGIT.includes(kind);
  const noRoute = res.reason === 'Internet has no outbound wire';
  const routed = !noRoute || state.mode === 'live';
  state.metrics.seen[kind] += 1;
  state.metrics.seenTotal += 1;
  if (legit && routed) {
    let tot = state.metrics.legitTotWindow;
    let ok = state.metrics.legitOkWindow;
    if (tot >= SLA_WINDOW) {
      const ratio = tot > 0 ? Math.min(1, ok / tot) : 1;
      tot = SLA_WINDOW - 1;
      ok = ratio * tot;
    }
    tot += 1;
    if (res.status === 'success') ok += 1;
    state.metrics.legitTotWindow = tot;
    state.metrics.legitOkWindow = Math.min(ok, tot);
  }
  if (res.status === 'success') {
    state.metrics.served[kind] += 1;
    state.metrics.servedTotal += 1;
  } else if (res.status === 'blocked') {
    state.metrics.blocked += 1;
  } else if (res.status === 'breach') {
    state.metrics.failed += 1;
  } else if (legit && routed) {
    state.metrics.failed += 1;
  }

  if (res.money >= 0) state.metrics.revenue += res.money;
  else state.metrics.spend += -res.money;
  state.money += res.money;

  if (take(state) < (hasWatch(state) ? 0.22 : 0.08) || res.status === 'breach') {
    pushLog(state, kind, res);
  }
}

function pushLog(state: GameState, kind: RequestKind, res: Resolved) {
  const line: LogLine = {
    id: `l${state.pktSeq++}`,
    t: state.simTime,
    kind,
    status: res.status,
    path: res.decisions.join(' → '),
    money: res.money,
    reason: res.reason,
  };
  state.log.unshift(line);
  if (state.log.length > MAX_LOG) state.log.pop();
}

function spawnVisual(state: GameState, kind: RequestKind, res: Resolved) {
  if (res.path.length < 1) return;
  if (state.packets.length >= MAX_PACKETS) return;
  const p: Packet = {
    id: `p${state.pktSeq++}`,
    kind,
    path: res.path,
    hop: 0,
    t: 0,
    status: 'inflight',
    finalStatus: res.status,
    decisions: res.decisions,
    born: state.simTime,
  };
  state.packets.push(p);
}

function maybeCoach(state: GameState, id: string, msg: Omit<CoachMsg, 'id'>) {
  if (state.seenCoach.includes(id)) return;
  state.seenCoach.push(id);
  if (state.coach && state.coach.id !== 'welcome') return;
  state.coach = { id, ...msg };
}

/** Mix the engine is spawning right now — mission/sandbox/live baseline, or the active event. */
export function currentMix(state: Pick<GameState, 'mode' | 'missionIndex' | 'event'>): Mix {
  const mission = state.mode === 'mission' ? MISSIONS[state.missionIndex] : null;
  const base = mission?.mix ?? (state.mode === 'live' ? LIVE_MIX : DEFAULT_MIX);
  if (state.event?.mix) return normalize(state.event.mix);
  return normalize(base);
}

/** Breathing load: slow climb, a 70s business cycle, a faster wobble. Lulls are events. */
export function liveIngress(t: number): number {
  const trend = LIVE_START_RPS + t * 0.105;
  const day = 1 + 0.3 * Math.sin((t / 70) * Math.PI * 2);
  const breath = 1 + 0.1 * Math.sin((t / 22) * Math.PI * 2);
  return Math.min(130, Math.max(4, trend * day * breath));
}

export function currentRps(state: GameState): number {
  const mission = state.mode === 'mission' ? MISSIONS[state.missionIndex] : null;
  let rps =
    state.mode === 'live'
      ? liveIngress(state.simTime)
      : state.mode === 'sandbox'
        ? 8 + state.simTime * 0.14
        : (mission?.startRps ?? 8) + state.simTime * (mission?.rpsGrowth ?? 0);
  rps = Math.min(state.mode === 'sandbox' ? 220 : 140, rps);
  if (state.event) rps *= state.event.rpsMul;
  return rps;
}

function drainQueues(state: GameState, dt: number) {
  for (const n of state.nodes) {
    if (n.service !== 'sqs') continue;
    const r = rt(state, n.id);
    const consumers = outs(state, n.id).filter((c) => COMPUTE.includes(c.service));
    const dbsOnQueue = outs(state, n.id).filter((c) => DATA.includes(c.service));
    let cap = 0;
    for (const c of consumers) cap += capacityRps(c) * dt * 0.65;
    if (!consumers.length && r.queueDepth > 4) {
      maybeCoach(state, dbsOnQueue.length ? 'queue-db-not-worker' : 'queue-no-worker', {
        title: dbsOnQueue.length ? 'RDS cannot poll SQS' : 'Queue has no consumer',
        body: dbsOnQueue.length
          ? 'You wired SQS → RDS. A database does not consume messages. Put EC2 or Lambda between the queue and the database: SQS → worker → RDS.'
          : 'Messages are piling up on SQS because nothing is wired out of it. Connect EC2 or Lambda as a worker.',
        lesson: 'A queue stores work. A worker does the work. A database is not a worker.',
      });
    }
    const d = Math.min(r.queueDepth, cap);
    r.queueDepth = Math.max(0, r.queueDepth - d);
    let left = d;
    for (const c of consumers) {
      if (left <= 0) break;
      const takeN = Math.min(left, capTick(c, dt));
      state.usedTick[c.id] = (state.usedTick[c.id] ?? 0) + takeN;
      const dbs = outs(state, c.id).filter((x) => DATA.includes(x.service));
      const sinks = dbs.length ? dbs : dbsOnQueue;
      const share = sinks.length ? takeN / sinks.length : 0;
      for (const db of sinks) {
        state.usedTick[db.id] = (state.usedTick[db.id] ?? 0) + share;
        rt(state, db.id).processed += 1;
      }
      left -= takeN;
    }
  }
}

function tickEvents(state: GameState, dt: number) {
  const mission = state.mode === 'mission' ? MISSIONS[state.missionIndex] : null;
  const enabled = state.mode === 'sandbox' || state.mode === 'live' || !!mission?.events;
  if (state.event) {
    state.event.remaining -= dt;
    if (state.event.remaining <= 0) {
      if (state.event.degradeNodeId) {
        const n = state.nodes.find((x) => x.id === state.event!.degradeNodeId);
        if (n) n.degraded = false;
      }
      state.event = null;
    }
  } else if (enabled && state.simTime >= state.nextEventAt) {
    const type = eventOrder(state.simTime + take(state), state.mode === 'live');
    let degrade: string | null = null;
    if (type === 'neighbor') {
      const boxes = state.nodes.filter((n) => n.service === 'ec2');
      if (boxes.length) {
        const n = takePick(state, boxes);
        n.degraded = true;
        degrade = n.id;
      }
    }
    state.event = makeEvent(type, degrade);
    state.nextEventAt = state.simTime + 22 + take(state) * 22;
    if (type === 'ddos') {
      maybeCoach(state, 'ddos-event', {
        title: 'DDoS wave inbound',
        body: 'RPS just tripled and most of it is garbage. If origin utilization spikes, your edge is missing or bypassed.',
        lesson: 'The cheapest DDoS packet is the one Shield drops.',
      });
    }
    if (type === 'stampede') {
      maybeCoach(state, 'stampede-event', {
        title: 'Cache stampede',
        body: 'Hit ratio cratered. RDS will see every reader at once. This is the failure mode of a single popular key plus a TTL expiry.',
        lesson: 'Caches fail by amplifying origin load, not by being empty forever.',
      });
    }
  }
}

function tickPackets(state: GameState, dt: number) {
  const live: Packet[] = [];
  for (const p of state.packets) {
    p.t += dt / TRAVERSE;
    if (p.t >= 1) {
      p.t = 0;
      p.hop += 1;
      if (p.hop >= p.path.length - 1) {
        p.status = p.finalStatus;
        continue;
      }
    }
    if (p.status === 'inflight') live.push(p);
  }
  state.packets = live;
}

function tickRuntime(state: GameState, dt: number) {
  for (const n of state.nodes) {
    const r = rt(state, n.id);
    const used = state.usedTick[n.id] ?? 0;
    const inst = dt > 0 ? used / dt : 0;
    r.emaRps = r.emaRps * 0.72 + inst * 0.28;
    const cap = capacityRps(n);
    r.utilization = cap > 0 ? r.emaRps / cap : 0;
    r.latency = hopLatency(n, r.utilization);
    r.status =
      r.utilization > 1.05
        ? 'saturated'
        : r.utilization > 0.85
          ? 'hot'
          : r.utilization > 0.55
            ? 'warm'
            : r.emaRps > 0.2
              ? 'ok'
              : 'idle';
    if (hasWatch(state) && r.utilization > 0.78 && n.service !== 'internet') {
      maybeCoach(state, `watch-${n.service}`, {
        title: `${CATALOG[n.service].short} is warming`,
        body: `CloudWatch would have paged you: ${CATALOG[n.service].name} is past 78% utilization. Add capacity or move work to a cache/CDN/queue before it cliffs.`,
        lesson: 'Observability is how you act before the SLA does.',
      });
    }
  }
}

function tickEconomy(state: GameState, dt: number) {
  let opex = 0;
  for (const n of state.nodes) opex += opexPerMin(n) * (dt / 60);
  state.money -= opex;
  state.metrics.spend += opex;
  if (state.money > state.peakMoney) state.peakMoney = state.money;
}

function tickWinLose(state: GameState) {
  if (state.won || state.loseReason) return;
  const s = sla(state);
  if (s >= (state.mode === 'mission' ? MISSIONS[state.missionIndex]?.objectives.find((o) => o.type === 'sla')?.n ?? 90 : 90)) {
    state.metrics.slaHold += 0.1;
  } else {
    state.metrics.slaHold = Math.max(0, state.metrics.slaHold - 0.12);
  }

  if (state.money < 0) state.bankruptFor += 0.1;
  else state.bankruptFor = 0;

  if (state.mode === 'sandbox') {
    return;
  }

  if (state.mode === 'live') {
    if (!state.liveStarted) return;
    if (state.bankruptFor > 6) {
      state.loseReason =
        'Bankrupt in production. Either the edge was missing, origin ate the flood, or the fortress was too expensive for the lull.';
      state.speed = 0;
      state.screen = 'debrief';
      state.won = false;
      return;
    }
    if (state.simTime > 45 && state.metrics.servedTotal < 8) {
      state.loseReason = 'Nothing useful was served. A path that does not exist is not an architecture.';
      state.speed = 0;
      state.screen = 'debrief';
      state.won = false;
      return;
    }
    if (state.simTime > 22 && state.metrics.legitTotWindow > 40 && s < 42) {
      state.loseReason = `SLA collapsed to ${s.toFixed(0)}%. Users left. Failed requests are refunds you cannot pause away.`;
      state.speed = 0;
      state.screen = 'debrief';
      state.won = false;
    }
    return;
  }

  const mission = MISSIONS[state.missionIndex];
  if (!mission) return;

  if (state.bankruptFor > 8) {
    state.loseReason = 'Bankrupt — the bill outran revenue. Over-provisioning is an outage with nicer graphs.';
    state.speed = 0;
    state.screen = 'debrief';
    state.won = false;
    return;
  }
  if (mission.failSla > 0 && state.metrics.legitTotWindow > 30 && s < mission.failSla) {
    state.loseReason = `SLA collapsed to ${s.toFixed(0)}%. Users left. Failed requests are refunds.`;
    state.speed = 0;
    state.screen = 'debrief';
    state.won = false;
    return;
  }

  const objs = evaluateObjectives(state);
  if (objs.length && objs.every((o) => o.done)) {
    state.won = true;
    state.speed = 0;
    state.screen = 'debrief';
    if (!state.completed.includes(mission.id)) state.completed = [...state.completed, mission.id];
  }
}

export function evaluateObjectives(state: GameState): ObjectiveState[] {
  if (state.mode !== 'mission') return [];
  const mission = MISSIONS[state.missionIndex];
  if (!mission) return [];
  const s = sla(state);
  const wa = wellArchitected(state).total;
  return mission.objectives.map((o) => {
    let done = false;
    switch (o.type) {
      case 'place':
        done = !!o.service && hasService(state.nodes, o.service);
        if (o.service === 'cloudfront') {
          done = hasService(state.nodes, 'cloudfront') || hasService(state.nodes, 'shield');
        }
        break;
      case 'count':
        done = !!o.service && countService(state.nodes, o.service) >= (o.n ?? 1);
        break;
      case 'path':
        done = !!o.from && !!o.to && hasPath(state.nodes, state.edges, o.from, o.to);
        break;
      case 'serve':
        done = state.metrics.servedTotal >= (o.n ?? 0);
        break;
      case 'block':
        done = state.metrics.blocked >= (o.n ?? 0);
        break;
      case 'sla':
        done = s >= (o.n ?? 90) && state.metrics.slaHold >= 20;
        break;
      case 'wa':
        done = wa >= (o.n ?? 70);
        break;
      case 'survive':
        done = state.simTime >= (o.n ?? 0);
        break;
      case 'profit':
        done = state.money >= (o.n ?? 0);
        break;
      default:
        done = false;
    }
    return { id: o.id, label: o.label, done };
  });
}

export function simulate(input: GameState, dt: number): GameState {
  if (input.screen !== 'play' || input.speed === 0) return input;
  if (input.mode === 'live' && !input.liveStarted) return input;
  const state: GameState = {
    ...input,
    nodes: input.nodes.map((n) => ({ ...n })),
    edges: input.edges.map((e) => ({ ...e })),
    packets: input.packets.map((p) => ({ ...p })),
    runtime: { ...input.runtime },
    metrics: {
      ...input.metrics,
      served: { ...input.metrics.served },
      seen: { ...(input.metrics.seen ?? emptyMix()) },
      seenTotal: input.metrics.seenTotal ?? 0,
    },
    spawnAcc: { ...input.spawnAcc },
    usedTick: {},
    log: input.log.slice(),
    seenCoach: input.seenCoach.slice(),
    toasts: input.toasts.map((t) => ({ ...t })),
    moneySeries: input.moneySeries.slice(),
    slaSeries: input.slaSeries.slice(),
    completed: input.completed.slice(),
    event: input.event ? { ...input.event } : null,
    coach: input.coach ? { ...input.coach } : null,
  };
  for (const id of Object.keys(state.runtime)) {
    state.runtime[id] = { ...state.runtime[id] };
  }

  state.simTime += dt;
  refillTokens(state, dt);
  tickEvents(state, dt);
  state.toasts = state.toasts.filter((t) => state.simTime - (t.at ?? 0) < 3.2);

  const mix = currentMix(state);
  const rps = currentRps(state);
  let visuals = 0;
  const visualBudget = 8;

  for (const k of KINDS) {
    state.spawnAcc[k] += rps * mix[k] * dt;
    while (state.spawnAcc[k] >= 1) {
      state.spawnAcc[k] -= 1;
      const res = resolveRequest(state, k, dt);
      applyOutcome(state, k, res);
      if (visuals < visualBudget && state.packets.length < MAX_PACKETS && take(state) < 0.55) {
        spawnVisual(state, k, res);
        visuals += 1;
      }
    }
  }

  drainQueues(state, dt);
  tickPackets(state, dt);
  tickRuntime(state, dt);
  tickEconomy(state, dt);

  if (Math.floor(state.simTime * 2) !== Math.floor((state.simTime - dt) * 2)) {
    state.moneySeries.push(state.money);
    state.slaSeries.push(sla(state));
    if (state.moneySeries.length > SAVE_SERIES) state.moneySeries.shift();
    if (state.slaSeries.length > SAVE_SERIES) state.slaSeries.shift();
  }

  tickWinLose(state);
  return state;
}

export function placeNode(
  state: GameState,
  service: ServiceId,
  x: number,
  y: number,
): GameState | { error: string } {
  const def = CATALOG[service];
  if (!def.placeable) return { error: 'Cannot place that' };
  if (state.money < def.capex) return { error: 'Insufficient funds' };
  const id = `n${state.nodeSeq + 1}_${service}`;
  const node: PlacedNode = { id, service, size: 1, x, y, degraded: false };
  return {
    ...state,
    money: state.money - def.capex,
    metrics: { ...state.metrics, spend: state.metrics.spend + def.capex },
    nodeSeq: state.nodeSeq + 1,
    nodes: [...state.nodes, node],
    runtime: { ...state.runtime, [id]: emptyRuntime() },
    placing: null,
    selectedId: id,
  };
}

export function connectNodes(state: GameState, source: string, target: string): GameState | { error: string } {
  if (source === target) return { error: 'Cannot loop a node onto itself' };
  const src = state.nodes.find((n) => n.id === source);
  const tgt = state.nodes.find((n) => n.id === target);
  if (!src || !tgt) return { error: 'Missing node' };
  if (!CATALOG[src.service].ports || !CATALOG[tgt.service].ports) {
    if (src.service === 'cloudwatch' || tgt.service === 'cloudwatch') {
      return { error: 'CloudWatch is not on the data path — just place it' };
    }
  }
  if (tgt.service === 'internet') return { error: 'Traffic does not flow back into the Internet node' };
  if (state.edges.some((e) => e.source === source && e.target === target)) return state;
  const id = `e${state.edgeSeq + 1}`;
  return {
    ...state,
    edgeSeq: state.edgeSeq + 1,
    edges: [...state.edges, { id, source, target }],
  };
}

export function disconnectEdge(state: GameState, id: string): GameState {
  if (!state.edges.some((e) => e.id === id)) return state;
  return {
    ...state,
    edges: state.edges.filter((e) => e.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  };
}

export function deleteSelection(state: GameState): GameState {
  const id = state.selectedId;
  if (!id) return state;
  const node = state.nodes.find((n) => n.id === id);
  if (node) {
    if (node.service === 'internet') return state;
    const refund = saleRefund(node);
    const runtime = { ...state.runtime };
    delete runtime[id];
    return {
      ...state,
      money: state.money + refund,
      metrics: {
        ...state.metrics,
        spend: Math.max(0, state.metrics.spend - refund),
      },
      selectedId: null,
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      runtime,
    };
  }
  const edge = state.edges.find((e) => e.id === id);
  if (edge) {
    return { ...state, selectedId: null, edges: state.edges.filter((e) => e.id !== id) };
  }
  return state;
}

export function upgradeNode(state: GameState, id: string): GameState | { error: string } {
  const node = state.nodes.find((n) => n.id === id);
  if (!node) return { error: 'No node' };
  if (!CATALOG[node.service].upgradable) return { error: 'This service has no size ladder' };
  if (node.size >= 3) return { error: 'Already T3' };
  const next = (node.size + 1) as 2 | 3;
  const cost = UPGRADE_COST[next];
  if (state.money < cost) return { error: 'Insufficient funds' };
  return {
    ...state,
    money: state.money - cost,
    metrics: { ...state.metrics, spend: state.metrics.spend + cost },
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, size: next } : n)),
  };
}

export function moveNode(state: GameState, id: string, x: number, y: number): GameState {
  return {
    ...state,
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
  };
}

export { sla, wellArchitected, burnPerMin, publicDataStore };
