import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from '../data/catalog';
import type { RequestKind, ServiceId } from '../types';
import { ServiceIcon } from './icons';

export type DemoHopId =
  | 'users'
  | 'route53'
  | 'shield'
  | 'waf'
  | 'cloudfront'
  | 'alb'
  | 'ec2'
  | 'cache'
  | 'rds'
  | 's3'
  | 'sqs';

type NodeId = DemoHopId | 'absorb' | 'block' | 'edgehit';

type SceneHop = { id: NodeId; verb: string };

export type DemoScene = {
  id: string;
  kind: RequestKind;
  label: string;
  title: string;
  hops: SceneHop[];
  result: { status: string; detail: string; money: string; ms: number };
};

const KIND_COLOR: Record<string, string> = {
  static: '#7dd3fc',
  read: '#86efac',
  write: '#fbbf24',
  upload: '#c4b5fd',
  search: '#67e8f9',
  malicious: '#fb7185',
  ddos: '#f43f5e',
};

const HIGHLIGHT: Partial<Record<NodeId, DemoHopId>> = {
  absorb: 'shield',
  block: 'waf',
  edgehit: 'cloudfront',
};

export const DEMO_SCENES: DemoScene[] = [
  {
    id: 'static',
    kind: 'static',
    label: 'Static',
    title: 'GET /assets/logo.svg',
    hops: [
      { id: 'users', verb: 'SEND' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'PASS' },
      { id: 'waf', verb: 'ALLOW' },
      { id: 'cloudfront', verb: 'LOOK UP' },
      { id: 'edgehit', verb: 'HIT' },
    ],
    result: {
      status: '200 · edge hit',
      detail: 'CloudFront served it. The origin branch never lit. EC2 and S3 stayed dark.',
      money: '+$0.10',
      ms: 12,
    },
  },
  {
    id: 'read',
    kind: 'read',
    label: 'Read',
    title: 'GET /api/products/42',
    hops: [
      { id: 'users', verb: 'SEND' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'PASS' },
      { id: 'waf', verb: 'ALLOW' },
      { id: 'cloudfront', verb: 'MISS' },
      { id: 'alb', verb: 'BALANCE' },
      { id: 'ec2', verb: 'APP' },
      { id: 'cache', verb: 'HIT' },
    ],
    result: {
      status: '200 · cache hit',
      detail: 'Missed the CDN, hit ElastiCache. RDS stayed idle — that is the whole pattern.',
      money: '+$0.18',
      ms: 9,
    },
  },
  {
    id: 'search',
    kind: 'search',
    label: 'Search',
    title: 'GET /search?q=lanterns',
    hops: [
      { id: 'users', verb: 'SEND' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'PASS' },
      { id: 'waf', verb: 'ALLOW' },
      { id: 'cloudfront', verb: 'MISS' },
      { id: 'alb', verb: 'BALANCE' },
      { id: 'ec2', verb: 'APP' },
      { id: 'rds', verb: 'QUERY' },
    ],
    result: {
      status: '200 · origin read',
      detail: 'A unique query cannot hide in ElastiCache. RDS did the work — this is why its QPS is low and it is never public.',
      money: '+$0.24',
      ms: 42,
    },
  },
  {
    id: 'upload',
    kind: 'upload',
    label: 'Upload',
    title: 'PUT /media/hero.jpg',
    hops: [
      { id: 'users', verb: 'SEND' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'PASS' },
      { id: 'waf', verb: 'ALLOW' },
      { id: 'cloudfront', verb: 'ORIGIN' },
      { id: 'alb', verb: 'BALANCE' },
      { id: 'ec2', verb: 'APP' },
      { id: 's3', verb: 'PUT' },
    ],
    result: {
      status: '200 · stored',
      detail: 'The object landed in S3. The bucket is not the front door — CloudFront and the app are. Next GET can be an edge hit.',
      money: '+$0.48',
      ms: 28,
    },
  },
  {
    id: 'write',
    kind: 'write',
    label: 'Write',
    title: 'POST /api/orders',
    hops: [
      { id: 'users', verb: 'SEND' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'PASS' },
      { id: 'waf', verb: 'ALLOW' },
      { id: 'cloudfront', verb: 'ORIGIN' },
      { id: 'alb', verb: 'BALANCE' },
      { id: 'ec2', verb: 'APP' },
      { id: 'sqs', verb: 'ENQUEUE' },
    ],
    result: {
      status: '202 · accepted',
      detail: 'SQS took the write. RDS will see it when a worker drains, not on the user’s clock.',
      money: '+$0.42',
      ms: 18,
    },
  },
  {
    id: 'malicious',
    kind: 'malicious',
    label: 'Attack',
    title: 'POST /login  ·  SQLi payload',
    hops: [
      { id: 'users', verb: 'SEND' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'PASS' },
      { id: 'waf', verb: 'INSPECT' },
      { id: 'block', verb: 'BLOCK' },
    ],
    result: {
      status: '403 · blocked',
      detail: 'Shield ignores application attacks. The WAF is the hop that saves you a breach.',
      money: '+$0.04',
      ms: 6,
    },
  },
  {
    id: 'ddos',
    kind: 'ddos',
    label: 'DDoS',
    title: 'UDP / SYN flood  ·  40× RPS',
    hops: [
      { id: 'users', verb: 'FLOOD' },
      { id: 'route53', verb: 'RESOLVE' },
      { id: 'shield', verb: 'SCRUB' },
      { id: 'absorb', verb: 'ABSORB' },
    ],
    result: {
      status: 'absorbed at edge',
      detail: 'Origin never saw it, so origin was never billed. More EC2 would have been the wrong move.',
      money: '+$0.04',
      ms: 3,
    },
  },
];

type LayoutNode = {
  id: NodeId;
  x: number;
  y: number;
  role: 'spine' | 'leaf' | 'fan';
  service?: ServiceId;
  title: string;
  sub?: string;
};

const L: Record<NodeId, LayoutNode> = {
  users: { id: 'users', x: 220, y: 82, role: 'spine', service: 'internet', title: 'Users', sub: 'Internet' },
  route53: { id: 'route53', x: 220, y: 180, role: 'spine', service: 'route53', title: 'Route 53', sub: 'DNS' },
  shield: { id: 'shield', x: 220, y: 278, role: 'spine', service: 'shield', title: 'Shield', sub: 'L3 / L4' },
  absorb: { id: 'absorb', x: 448, y: 278, role: 'leaf', title: 'ABSORB', sub: 'flood dies' },
  waf: { id: 'waf', x: 220, y: 376, role: 'spine', service: 'waf', title: 'WAF', sub: 'L7 inspect' },
  block: { id: 'block', x: 448, y: 376, role: 'leaf', title: '403', sub: 'blocked' },
  cloudfront: { id: 'cloudfront', x: 220, y: 474, role: 'spine', service: 'cloudfront', title: 'CloudFront', sub: 'CDN' },
  edgehit: { id: 'edgehit', x: 448, y: 474, role: 'leaf', title: '200', sub: 'edge hit' },
  alb: { id: 'alb', x: 220, y: 590, role: 'spine', service: 'alb', title: 'ALB', sub: 'spread' },
  ec2: { id: 'ec2', x: 220, y: 688, role: 'spine', service: 'ec2', title: 'EC2', sub: 'compute' },
  cache: { id: 'cache', x: 78, y: 808, role: 'fan', service: 'cache', title: 'Cache', sub: 'hit' },
  rds: { id: 'rds', x: 206, y: 808, role: 'fan', service: 'rds', title: 'RDS', sub: 'sql' },
  s3: { id: 's3', x: 334, y: 808, role: 'fan', service: 's3', title: 'S3', sub: 'object' },
  sqs: { id: 'sqs', x: 462, y: 808, role: 'fan', service: 'sqs', title: 'SQS', sub: 'queue' },
};

const EDGES: { from: NodeId; to: NodeId; side?: boolean }[] = [
  { from: 'users', to: 'route53' },
  { from: 'route53', to: 'shield' },
  { from: 'shield', to: 'absorb', side: true },
  { from: 'shield', to: 'waf' },
  { from: 'waf', to: 'block', side: true },
  { from: 'waf', to: 'cloudfront' },
  { from: 'cloudfront', to: 'edgehit', side: true },
  { from: 'cloudfront', to: 'alb' },
  { from: 'alb', to: 'ec2' },
  { from: 'ec2', to: 'cache' },
  { from: 'ec2', to: 'rds' },
  { from: 'ec2', to: 's3' },
  { from: 'ec2', to: 'sqs' },
];

const GRAPH_W = 532;
const GRAPH_H = 920;
const VIEW_H = 418;
const NODE_H = 52;
const LEAF_H = 44;
const FAN_H = 58;
const HOP_MS = 1150;
const HOLD_MS = 2800;
const CAM_EASE = 'transform 0.9s cubic-bezier(0.22, 0.61, 0.36, 1)';

function nodeH(role: LayoutNode['role']) {
  if (role === 'leaf') return LEAF_H;
  if (role === 'fan') return FAN_H;
  return NODE_H;
}

function edgePath(from: NodeId, to: NodeId, side?: boolean) {
  const a = L[from];
  const b = L[to];
  const ah = nodeH(a.role) / 2;
  const bh = nodeH(b.role) / 2;
  if (side) {
    const x1 = a.x + 84;
    const y1 = a.y;
    const x2 = b.x - 56;
    const y2 = b.y;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  if (a.role === 'spine' && b.role === 'fan') {
    const x1 = a.x;
    const y1 = a.y + ah;
    const x2 = b.x;
    const y2 = b.y - bh;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
  return `M ${a.x} ${a.y + ah} L ${b.x} ${b.y - bh}`;
}

export function RequestPathDemo({
  sceneIndex,
  onScene,
  onActiveHop,
  height,
}: {
  sceneIndex: number;
  onScene: (i: number) => void;
  onActiveHop: (id: DemoHopId | null) => void;
  height?: number;
}) {
  const scene = DEMO_SCENES[sceneIndex];
  const [step, setStep] = useState(0);
  const done = step >= scene.hops.length;
  const current = done ? scene.hops[scene.hops.length - 1] : scene.hops[step];
  const visited = useMemo(() => {
    const ids = scene.hops.slice(0, done ? scene.hops.length : step + 1).map((h) => h.id);
    return new Set<NodeId>(ids);
  }, [scene, step, done]);
  const pathSet = useMemo(() => new Set(scene.hops.map((h) => h.id)), [scene]);
  const verbs = useMemo(() => new Map(scene.hops.map((h) => [h.id, h.verb])), [scene]);
  const color = KIND_COLOR[scene.kind];
  const nextId = !done && step + 1 < scene.hops.length ? scene.hops[step + 1].id : null;

  const viewH = Math.max(160, (height ?? VIEW_H) - 210);
  const camY = useMemo(() => {
    const y = L[current.id].y;
    const raw = y - viewH * 0.34;
    return Math.max(0, Math.min(GRAPH_H - viewH, raw));
  }, [current, viewH]);

  useEffect(() => {
    setStep(0);
  }, [sceneIndex]);

  useEffect(() => {
    const id = HIGHLIGHT[current.id] ?? (current.id as DemoHopId);
    onActiveHop(id);
  }, [current, onActiveHop]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(scene.hops.length);
      return;
    }
    const delay = done ? HOLD_MS : HOP_MS;
    const t = window.setTimeout(() => {
      if (done) onScene((sceneIndex + 1) % DEMO_SCENES.length);
      else setStep((n) => n + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [step, done, scene.hops.length, sceneIndex, onScene]);

  const pkt = L[current.id];

  return (
    <div className="how-stage" style={height ? { height } : undefined}>
      <div className="how-stage-head">
        <div className="how-stage-row">
          <span className="how-kind" style={{ color, borderColor: color }}>
            {scene.label}
          </span>
          <span className="how-hopn mono">
            {done ? 'result' : `hop ${step + 1} / ${scene.hops.length}`}
          </span>
        </div>
        <code>{scene.title}</code>
      </div>
      <div className="how-scenes">
        {DEMO_SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`how-scene-btn ${i === sceneIndex ? 'active' : ''}`}
            style={i === sceneIndex ? { borderColor: KIND_COLOR[s.kind], color: KIND_COLOR[s.kind] } : undefined}
            onClick={() => onScene(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="how-viewport">
        <div
          className="how-world"
          style={{ height: GRAPH_H, transform: `translate3d(0, ${-camY}px, 0)`, transition: CAM_EASE }}
        >
          <svg className="how-edges" width={GRAPH_W} height={GRAPH_H} viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}>
            {EDGES.map((e) => {
              const lit = visited.has(e.to) && pathSet.has(e.to) && pathSet.has(e.from);
              const upcoming = nextId === e.to && visited.has(e.from);
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={edgePath(e.from, e.to, e.side)}
                  fill="none"
                  stroke={lit ? color : upcoming ? `${color}66` : '#243044'}
                  strokeWidth={lit ? 2.2 : 1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={pathSet.has(e.to) || pathSet.has(e.from) ? 1 : 0.28}
                  className={lit ? 'how-edge-lit' : ''}
                />
              );
            })}
          </svg>

          {(Object.values(L) as LayoutNode[]).map((n) => {
            const live = current.id === n.id && !done;
            const on = visited.has(n.id);
            const onPath = pathSet.has(n.id);
            const upcoming = nextId === n.id;
            const verb = verbs.get(n.id);
            const h = nodeH(n.role);
            const w = n.role === 'spine' ? 172 : n.role === 'leaf' ? 116 : 92;
            return (
              <div
                key={n.id}
                className={[
                  'tree-node',
                  n.role,
                  live ? 'live' : '',
                  on ? 'on' : '',
                  onPath ? 'path' : 'offpath',
                  upcoming ? 'next' : '',
                ].join(' ')}
                style={{
                  left: n.x - w / 2,
                  top: n.y - h / 2,
                  width: w,
                  height: h,
                  ['--accent' as string]: color,
                }}
              >
                {n.service && (
                  <span className="tree-ico" style={{ color: CATALOG[n.service].color }}>
                    <ServiceIcon id={n.service} />
                  </span>
                )}
                <div className="tree-copy">
                  <b>{n.title}</b>
                  {n.sub && <small>{n.sub}</small>}
                </div>
                {on && verb && <em>{verb}</em>}
              </div>
            );
          })}

          <i
            className="tree-pkt"
            style={{
              left: pkt.x,
              top: pkt.y,
              background: color,
              color,
              transition: 'left 0.9s cubic-bezier(0.22, 0.61, 0.36, 1), top 0.9s cubic-bezier(0.22, 0.61, 0.36, 1)',
            }}
          />
        </div>
        <div className="how-vignette" />
      </div>

      <div className="how-watch">
        <span className="how-ico" style={{ color: CATALOG.cloudwatch.color }}>
          <ServiceIcon id="cloudwatch" />
        </span>
        <div>
          <b>CloudWatch</b>
          <small>Watching the path — not on it</small>
        </div>
        <i className="how-pulse" />
      </div>

      <div className={`how-result ${done ? 'show' : ''}`}>
        <div className="how-result-top">
          <strong style={{ color }}>{scene.result.status}</strong>
          <span className="mono">
            {scene.result.ms} ms · {scene.result.money}
          </span>
        </div>
        <p>{scene.result.detail}</p>
      </div>
    </div>
  );
}
