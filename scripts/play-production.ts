/**
 * Play Production like a human: lean staging, Go live, buy the next box
 * only when a hop is actually hurting — then prove the ledger stays up.
 */
import { CATALOG, START_GRANT } from '../src/data/catalog';
import {
  connectNodes,
  createInitialState,
  currentRps,
  goLive,
  placeNode,
  simulate,
  upgradeNode,
} from '../src/sim/engine';
import { burnPerMin, sla } from '../src/sim/score';
import type { GameState, ServiceId } from '../src/types';

const CASH_FLOOR = 1100;
const MAX_S = 2400;

function fail(msg: string): never {
  throw new Error(msg);
}

function sid(s: GameState, service: ServiceId, nth = 0): string | null {
  const hits = s.nodes.filter((n) => n.service === service);
  return hits[nth]?.id ?? null;
}

function has(s: GameState, service: ServiceId) {
  return s.nodes.some((n) => n.service === service);
}

function count(s: GameState, service: ServiceId) {
  return s.nodes.filter((n) => n.service === service).length;
}

function peakUtil(s: GameState, service: ServiceId) {
  const hits = s.nodes.filter((n) => n.service === service);
  if (!hits.length) return 0;
  return Math.max(...hits.map((n) => s.runtime[n.id]?.utilization ?? 0));
}

function tryPlace(s: GameState, service: ServiceId, x: number, y: number): GameState | { error: string } {
  if (s.nodes.some((n) => n.service === service) && service !== 'ec2' && service !== 'lambda') {
    return s;
  }
  return placeNode(s, service, x, y);
}

function tryWire(s: GameState, a: ServiceId, b: ServiceId, an = 0, bn = 0): GameState {
  const from = a === 'internet' ? 'n_internet' : sid(s, a, an);
  const to = sid(s, b, bn);
  if (!from || !to) return s;
  const r = connectNodes(s, from, to);
  return 'error' in r ? s : r;
}

function canAfford(s: GameState, capex: number, floor = CASH_FLOOR) {
  return s.money >= capex + floor;
}

type Buy = { t: number; action: string; money: number; why: string };

function buy(s: GameState, log: Buy[], action: string, why: string): GameState {
  log.push({ t: s.simTime, action, money: s.money, why });
  return s;
}

/** One human decision. At most one purchase per second. */
function act(s: GameState, log: Buy[]): GameState {
  if (s.loseReason) return s;
  const ev = s.event?.type ?? null;
  const ec2u = peakUtil(s, 'ec2');
  const ddbu = peakUtil(s, 'dynamodb');
  const cacheu = peakUtil(s, 'cache');
  const wafu = peakUtil(s, 'waf');
  const nEc2 = count(s, 'ec2');
  const sized = s.nodes.filter((n) => n.service === 'ec2').every((n) => n.size >= 2);
  const pathReady =
    nEc2 >= 2 && sized && has(s, 'cache') && has(s, 'sqs') && has(s, 'shield');
  const slaNow = sla(s);
  // Healthy path: stop shopping and bank toward the grant.
  const needsDb = has(s, 'cache') && !has(s, 'dynamodb') && !has(s, 'rds') && s.money >= 2600;
  // Architecture is on the board. Stop shopping — panic T2/T3 is how a winning run goes broke.
  if (pathReady && !needsDb) return s;

  // 1. Flood is landing — Shield before more origin.
  if ((ev === 'ddos' || s.metrics.originBurns > 8) && !has(s, 'shield') && canAfford(s, CATALOG.shield.capex, 400)) {
    const r = tryPlace(s, 'shield', 160, 180);
    if ('error' in r) return s;
    s = r;
    s = tryWire(s, 'internet', 'shield');
    s = tryWire(s, 'shield', 'waf');
    return buy(s, log, 'Shield', `DDoS/origin burn — absorb at the edge (${s.metrics.originBurns} burns)`);
  }

  // 2. One box is hot — second EC2 behind the ALB.
  if (nEc2 === 1 && ec2u > 0.72 && canAfford(s, CATALOG.ec2.capex, 400)) {
    const r = tryPlace(s, 'ec2', 520, 280);
    if ('error' in r) return s;
    s = r;
    s = tryWire(s, 'alb', 'ec2', 0, 1);
    if (has(s, 'cache')) s = tryWire(s, 'ec2', 'cache', 1, 0);
    if (has(s, 'dynamodb')) s = tryWire(s, 'ec2', 'dynamodb', 1, 0);
    if (has(s, 'sqs')) {
      s = tryWire(s, 'ec2', 'sqs', 1, 0);
      s = tryWire(s, 'sqs', 'ec2', 0, 1);
    }
    return buy(s, log, 'EC2 #2', `first instance at ${(ec2u * 100).toFixed(0)}% — ALB needs a second target`);
  }

  // 3. Reads are through compute — ElastiCache.
  if (!has(s, 'cache') && (ec2u > 0.55 || s.simTime > 18) && canAfford(s, CATALOG.cache.capex, 250)) {
    const r = tryPlace(s, 'cache', 600, 160);
    if ('error' in r) return s;
    s = r;
    s = tryWire(s, 'ec2', 'cache');
    if (nEc2 > 1) s = tryWire(s, 'ec2', 'cache', 1, 0);
    if (has(s, 'dynamodb')) s = tryWire(s, 'cache', 'dynamodb');
    return buy(s, log, 'ElastiCache', `reads on origin — cache before another database`);
  }

  // 4. After the ledger has recovered some capex, add a miss sink so SLA
  // doesn't die at high RPS. Never buy this broke.
  if (
    has(s, 'cache') &&
    !has(s, 'dynamodb') &&
    !has(s, 'rds') &&
    s.money >= 2600 &&
    ev !== 'ddos' &&
    ev !== 'lull'
  ) {
    const r = tryPlace(s, 'dynamodb', 680, 220);
    if (!('error' in r)) {
      s = r;
      s = tryWire(s, 'cache', 'dynamodb');
      return buy(s, log, 'DynamoDB', `cache → DDB only (not EC2 → DDB — that is a poison blast radius)`);
    }
  }

  // 5. Writes / flash — queue.
  if (
    !has(s, 'sqs') &&
    canAfford(s, CATALOG.sqs.capex, 250) &&
    (ev === 'flash' || ddbu > 0.7 || s.simTime > 40)
  ) {
    const r = tryPlace(s, 'sqs', 600, 300);
    if ('error' in r) return s;
    s = r;
    s = tryWire(s, 'ec2', 'sqs');
    s = tryWire(s, 'sqs', 'ec2');
    if (nEc2 > 1) {
      s = tryWire(s, 'ec2', 'sqs', 1, 0);
      s = tryWire(s, 'sqs', 'ec2', 0, 1);
    }
    return buy(s, log, 'SQS', ev === 'flash' ? 'flash sale — accept writes, drain later' : `DDB at ${(ddbu * 100).toFixed(0)}% — writes off the hot path`);
  }

  // 6. Size compute. T3 only when the grant climb can afford the opex.
  if (ec2u > 0.9 || slaNow < 85) {
    const hot = s.nodes
      .filter((n) => n.service === 'ec2' && n.size < 2)
      .sort((a, b) => (s.runtime[b.id]?.utilization ?? 0) - (s.runtime[a.id]?.utilization ?? 0))[0];
    const cost = hot ? (hot.size === 1 ? 620 : 980) : 0;
    if (hot && canAfford(s, cost, 200)) {
      const r = upgradeNode(s, hot.id);
      if (!('error' in r)) {
        s = r;
        return buy(
          s,
          log,
          `Upgrade EC2 → T${hot.size + 1}`,
          `EC2 at ${(ec2u * 100).toFixed(0)}% — size the box before buying a fleet`,
        );
      }
    }
  }

  // Don't buy during a lull just because we can.
  if (ev === 'lull') return s;
  if (wafu > 0.9 || cacheu > 0.95) return s;
  return s;
}

function snapshot(s: GameState) {
  return {
    t: s.simTime,
    money: s.money,
    sla: sla(s),
    rps: currentRps(s),
    burn: burnPerMin(s),
    served: s.metrics.servedTotal,
    failed: s.metrics.failed,
    blocked: s.metrics.blocked,
    burns: s.metrics.originBurns,
    event: s.event?.type ?? '-',
    lose: s.loseReason,
  };
}

function play(seed: number) {
  const log: Buy[] = [];
  let s = createInitialState('live', 0, seed);
  s.screen = 'play';
  s.speed = 0;

  // Staging: edge before origin. One compute. No database yet.
  const staging: Array<[ServiceId, number, number]> = [
    ['shield', 140, 180],
    ['waf', 240, 180],
    ['cloudfront', 340, 180],
    ['alb', 440, 180],
    ['ec2', 540, 180],
    ['s3', 440, 280],
  ];
  for (const [svc, x, y] of staging) {
    const r = tryPlace(s, svc, x, y);
    if ('error' in r) fail(`staging ${svc}: ${r.error}`);
    s = r;
  }
  s = tryWire(s, 'internet', 'shield');
  s = tryWire(s, 'shield', 'waf');
  s = tryWire(s, 'waf', 'cloudfront');
  s = tryWire(s, 'cloudfront', 'alb');
  s = tryWire(s, 'cloudfront', 's3');
  s = tryWire(s, 'alb', 'ec2');

  const leftover = s.money;
  log.push({
    t: 0,
    action: 'Go live',
    money: leftover,
    why: 'Shield → WAF → CDN → ALB → 1×EC2, CDN → S3. Edge first, cash in pocket.',
  });
  s = goLive(s);

  const series: ReturnType<typeof snapshot>[] = [snapshot(s)];
  let recoveredAt: number | null = null;
  const steps = MAX_S * 10;
  for (let i = 0; i < steps; i++) {
    s = simulate(s, 0.1);
    if (s.loseReason) break;
    if (i % 10 === 9) {
      s = act(s, log);
      series.push(snapshot(s));
      if (recoveredAt == null && s.money >= START_GRANT) recoveredAt = s.simTime;
      if (recoveredAt != null && s.simTime >= recoveredAt + 15) break;
    }
  }
  return { s, leftover, log, series, recoveredAt };
}

function fmt(n: number) {
  return n.toFixed(0);
}

let best: ReturnType<typeof play> | null = null;
for (const seed of [42]) {
  const run = play(seed);
  const peak = Math.max(...run.series.map((r) => r.money));
  console.log(
    `seed ${seed}: t=${run.s.simTime.toFixed(0)}s money=$${run.s.money.toFixed(0)} peak=$${peak.toFixed(0)} lose=${run.s.loseReason ?? 'none'} recovered=${run.recoveredAt?.toFixed(0) ?? '-'} sla=${sla(run.s).toFixed(0)}`,
  );
  if (run.recoveredAt != null) {
    best = run;
    break;
  }
  if (!best || peak > Math.max(...best.series.map((r) => r.money))) best = run;
}
if (!best) fail('no runs');
const { s, leftover, log, series, recoveredAt } = best;
const minMoney = Math.min(...series.map((r) => r.money));
const maxMoney = Math.max(...series.map((r) => r.money));

console.log('=== Human production run — recover the $7,200 grant ===');
console.log(`staging leftover  $${fmt(leftover)}`);
console.log(
  `end t=${s.simTime.toFixed(0)}s money=$${fmt(s.money)} sla=${sla(s).toFixed(0)}% served=${s.metrics.servedTotal} failed=${s.metrics.failed} blocked=${s.metrics.blocked} originBurns=${s.metrics.originBurns}`,
);
console.log(
  `lose=${s.loseReason ?? 'none'}  minCash=$${fmt(minMoney)}  peakCash=$${fmt(maxMoney)}  burn=$${burnPerMin(s).toFixed(1)}/min  rps=${currentRps(s).toFixed(1)}`,
);
console.log('');
console.log('Buys (only when a hop hurt):');
for (const b of log) {
  console.log(`  t=${b.t.toFixed(0).padStart(4)}s  $${fmt(b.money).padStart(5)}  ${b.action.padEnd(16)}  ${b.why}`);
}
console.log('');
console.log('Cash every 60s:');
for (const row of series) {
  if (row.t > 0.2 && Math.abs(row.t % 60) > 0.2) continue;
  console.log(
    `  t=${row.t.toFixed(0).padStart(4)}s  $${fmt(row.money).padStart(5)}  sla=${row.sla.toFixed(0).padStart(3)}%  rps=${row.rps.toFixed(1).padStart(5)}  event=${row.event}`,
  );
}

const lastBuy = log[log.length - 1];
const opsDelta = s.money - lastBuy.money;

if (s.loseReason) fail('HUMAN RUN LOST: ' + s.loseReason);
if (minMoney < 0) fail('dipped negative');
if (sla(s) < 70) fail(`SLA collapsed to ${sla(s).toFixed(0)}`);
if (recoveredAt == null) fail(`never recovered $${START_GRANT} (end $${s.money.toFixed(0)} at t=${s.simTime.toFixed(0)}s)`);

console.log('');
console.log(
  `PROOF: recovered the $${START_GRANT} grant at t=${recoveredAt.toFixed(0)}s with $${fmt(s.money)} in the bank. ` +
    `Floor $${fmt(minMoney)}. SLA ${sla(s).toFixed(0)}%. ` +
    `After last buy (${lastBuy.action} @ t=${lastBuy.t.toFixed(0)}s $${fmt(lastBuy.money)}) ops ${opsDelta >= 0 ? '+' : ''}${fmt(opsDelta)}. ` +
    `Never broke. originBurns=${s.metrics.originBurns}.`,
);
console.log('HUMAN RUN OK');
