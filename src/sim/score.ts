import { CATALOG } from '../data/catalog';
import type {
  GameState,
  GraphEdge,
  Metrics,
  Pillars,
  PlacedNode,
  ServiceId,
  WaScore,
} from '../types';

export function neighbors(
  nodes: PlacedNode[],
  edges: GraphEdge[],
  id: string,
): PlacedNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const out: PlacedNode[] = [];
  for (const e of edges) {
    if (e.source === id) {
      const t = map.get(e.target);
      if (t) out.push(t);
    }
  }
  return out;
}

export function reachableFrom(
  nodes: PlacedNode[],
  edges: GraphEdge[],
  startService: ServiceId,
): Set<ServiceId> {
  const byService = nodes.filter((n) => n.service === startService);
  const seenN = new Set<string>();
  const services = new Set<ServiceId>();
  const q = byService.map((n) => n.id);
  for (const n of byService) {
    seenN.add(n.id);
    services.add(n.service);
  }
  const map = new Map(nodes.map((n) => [n.id, n]));
  while (q.length) {
    const id = q.shift()!;
    for (const e of edges) {
      if (e.source !== id) continue;
      if (seenN.has(e.target)) continue;
      seenN.add(e.target);
      const n = map.get(e.target);
      if (!n) continue;
      services.add(n.service);
      q.push(n.id);
    }
  }
  return services;
}

export function hasPath(
  nodes: PlacedNode[],
  edges: GraphEdge[],
  from: ServiceId,
  to: ServiceId,
): boolean {
  return reachableFrom(nodes, edges, from).has(to);
}

export function internetNode(nodes: PlacedNode[]): PlacedNode | undefined {
  return nodes.find((n) => n.service === 'internet');
}

export function hasService(nodes: PlacedNode[], s: ServiceId): boolean {
  return nodes.some((n) => n.service === s);
}

export function countService(nodes: PlacedNode[], s: ServiceId): number {
  return nodes.filter((n) => n.service === s).length;
}

export function publicDataStore(nodes: PlacedNode[], edges: GraphEdge[]): boolean {
  const inet = internetNode(nodes);
  if (!inet) return false;
  const bad: ServiceId[] = ['rds', 'dynamodb', 'cache'];
  return edges.some((e) => {
    if (e.source !== inet.id) return false;
    const t = nodes.find((n) => n.id === e.target);
    return !!t && bad.includes(t.service);
  });
}

/** Rolling sample of recent legitimate requests used for the SLA meter. */
export const SLA_WINDOW = 160;

export function requestTally(m: Metrics) {
  const seenMix = m.seen;
  const seen =
    typeof m.seenTotal === 'number' ? m.seenTotal : m.servedTotal + m.blocked + m.failed;
  const bad = seenMix
    ? (seenMix.malicious || 0) + (seenMix.ddos || 0)
    : m.served.malicious + m.served.ddos + m.blocked;
  return {
    seen,
    served: m.servedTotal,
    blocked: m.blocked,
    failed: m.failed,
    bad,
    earned: m.revenue,
    spent: m.spend,
    net: m.revenue - m.spend,
  };
}

export function sla(state: GameState): number {
  const t = state.metrics.legitTotWindow;
  if (t < 4) return 100;
  const ok = Math.min(state.metrics.legitOkWindow, t);
  return Math.max(0, Math.min(100, (100 * ok) / t));
}

export function burnPerMin(state: GameState): number {
  let v = 0;
  for (const n of state.nodes) {
    const d = CATALOG[n.service];
    const mul = d.upgradable ? [0, 1, 1.8, 3.2][n.size] : 1;
    v += d.opexPerMin * mul;
  }
  return v;
}

export function wellArchitected(state: GameState): WaScore {
  const { nodes, edges, metrics } = state;
  const r = reachableFrom(nodes, edges, 'internet');
  const on = (s: ServiceId) => r.has(s);
  const placed = (s: ServiceId) => hasService(nodes, s);
  const computeN = countService(nodes, 'ec2') + countService(nodes, 'lambda');
  const s = sla(state);
  const profit = metrics.revenue - metrics.spend;
  const cdnShare =
    metrics.served.static > 8
      ? metrics.cdnHits / Math.max(1, metrics.served.static + metrics.cdnHits * 0.01)
      : on('cloudfront')
        ? 0.5
        : 0.15;
  const cacheShare =
    metrics.cacheHits + metrics.cacheMisses > 8
      ? metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
      : on('cache')
        ? 0.45
        : 0.1;

  const operational = clamp(
    (placed('cloudwatch') ? 55 : 12) +
      (state.log.length > 5 ? 15 : 0) +
      (s > 95 ? 20 : s > 80 ? 10 : 0) +
      (state.seenCoach.length > 2 ? 10 : 0),
  );

  const security = clamp(
    (on('waf') ? 38 : 0) +
      (on('shield') || on('cloudfront') ? 22 : 0) +
      (publicDataStore(nodes, edges) ? 0 : 25) +
      (metrics.breaches === 0 ? 15 : Math.max(0, 15 - metrics.breaches * 4)),
  );

  const reliability = clamp(
    (on('alb') && computeN >= 2 ? 40 : computeN >= 2 ? 22 : 8) +
      (on('sqs') ? 18 : 0) +
      (on('route53') ? 10 : 0) +
      (s >= 99 ? 20 : s >= 90 ? 12 : s >= 70 ? 5 : 0) +
      (placed('rds') && !publicDataStore(nodes, edges) ? 12 : 0),
  );

  const performance = clamp(
    (on('cloudfront') ? 28 : 0) +
      (on('cache') ? 24 : 0) +
      Math.round(cdnShare * 20) +
      Math.round(cacheShare * 18) +
      (avgUtil(state) < 0.8 ? 12 : avgUtil(state) < 1 ? 4 : 0),
  );

  const cost = clamp(
    (profit > 0 ? 40 : profit > -400 ? 18 : 4) +
      (avgUtil(state) > 0.25 && avgUtil(state) < 0.85 ? 30 : 10) +
      (on('lambda') && metrics.originBurns > 40 ? 0 : 15) +
      (on('cloudfront') || on('cache') ? 15 : 0),
  );

  const sustainability = clamp(
    Math.round(cdnShare * 40) +
      Math.round(cacheShare * 30) +
      (on('sqs') ? 15 : 0) +
      (on('lambda') && metrics.originBurns < 10 ? 15 : 8),
  );

  const pillars: Pillars = {
    operational,
    security,
    reliability,
    performance,
    cost,
    sustainability,
  };
  const total = Math.round(
    (operational + security + reliability + performance + cost + sustainability) / 6,
  );
  return { total, pillars };
}

function avgUtil(state: GameState): number {
  const vals = Object.values(state.runtime).map((r) => r.utilization);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
