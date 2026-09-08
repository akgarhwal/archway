import {
  connectNodes,
  createInitialState,
  evaluateObjectives,
  goLive,
  placeNode,
  simulate,
} from '../src/sim/engine';
import { sla, wellArchitected } from '../src/sim/score';
import { MISSIONS } from '../src/data/missions';
import type { GameState, ServiceId } from '../src/types';

function fail(msg: string): never {
  throw new Error(msg);
}

function sid(s: GameState, service: ServiceId, nth = 0): string {
  const hits = s.nodes.filter((n) => n.service === service);
  if (!hits[nth]) fail(`missing ${service}#${nth}`);
  return hits[nth].id;
}

function place(s: GameState, service: ServiceId, x: number, y: number): GameState {
  if (s.nodes.some((n) => n.service === service) && service !== 'ec2' && service !== 'lambda') {
    return s;
  }
  const r = placeNode(s, service, x, y);
  if ('error' in r) fail(`place ${service}: ${r.error} (money ${s.money.toFixed(0)})`);
  return r;
}

function tryPlace(s: GameState, service: ServiceId, x: number, y: number): GameState {
  if (s.nodes.some((n) => n.service === service) && service !== 'ec2' && service !== 'lambda') {
    return s;
  }
  const r = placeNode(s, service, x, y);
  return 'error' in r ? s : r;
}

function wire(s: GameState, a: ServiceId, b: ServiceId, an = 0, bn = 0): GameState {
  if (!s.nodes.some((n) => n.service === a) || !s.nodes.some((n) => n.service === b)) return s;
  const r = connectNodes(s, sid(s, a, an), sid(s, b, bn));
  if ('error' in r) fail(`wire ${a}->${b}: ${r.error}`);
  return r;
}

function backbone(s: GameState, extra: ServiceId[]): GameState {
  const want: ServiceId[] = [...extra];
  let x = 220;
  for (const svc of want) {
    s = tryPlace(s, svc, x, 180 + (x % 90));
    x += 28;
  }
  s = wire(s, 'internet', extra.includes('route53') ? 'route53' : extra.includes('shield') ? 'shield' : extra.includes('waf') ? 'waf' : extra.includes('cloudfront') ? 'cloudfront' : extra.includes('alb') ? 'alb' : 'ec2');
  s = wire(s, 'route53', extra.includes('shield') ? 'shield' : extra.includes('waf') ? 'waf' : extra.includes('cloudfront') ? 'cloudfront' : extra.includes('alb') ? 'alb' : 'ec2');
  s = wire(s, 'shield', extra.includes('waf') ? 'waf' : extra.includes('cloudfront') ? 'cloudfront' : extra.includes('alb') ? 'alb' : 'ec2');
  s = wire(s, 'waf', extra.includes('cloudfront') ? 'cloudfront' : extra.includes('alb') ? 'alb' : extra.includes('apigateway') ? 'apigateway' : 'ec2');
  s = wire(s, 'cloudfront', extra.includes('alb') ? 'alb' : extra.includes('apigateway') ? 'apigateway' : 'ec2');
  s = wire(s, 'cloudfront', 's3');
  s = wire(s, 'apigateway', extra.includes('alb') ? 'alb' : extra.includes('lambda') ? 'lambda' : 'ec2');
  s = wire(s, 'alb', 'ec2');
  if (s.nodes.filter((n) => n.service === 'ec2').length > 1) s = wire(s, 'alb', 'ec2', 0, 1);
  s = wire(s, 'alb', 'lambda');
  s = wire(s, 'ec2', 'cache');
  s = wire(s, 'cache', 'rds');
  s = wire(s, 'ec2', 'rds');
  s = wire(s, 'ec2', 'dynamodb');
  s = wire(s, 'ec2', 'sqs');
  s = wire(s, 'lambda', 'sqs');
  s = wire(s, 'sqs', extra.includes('lambda') ? 'lambda' : 'ec2');
  s = wire(s, 'lambda', 'rds');
  s = wire(s, 'lambda', 'cache');
  s = wire(s, 'lambda', 'dynamodb');
  return s;
}

function buildMission(index: number): GameState {
  let s = createInitialState('mission', index, 11 + index);
  s.speed = 0;
  s.screen = 'play';
  switch (index) {
    case 0:
      s = place(s, 'ec2', 300, 200);
      s = wire(s, 'internet', 'ec2');
      break;
    case 1:
      s = backbone(s, ['alb', 'ec2']);
      s = place(s, 'ec2', 420, 280);
      s = wire(s, 'alb', 'ec2', 0, 1);
      break;
    case 2:
      s = backbone(s, ['waf', 'alb', 'ec2']);
      break;
    case 3:
      s = backbone(s, ['shield', 'cloudfront', 'waf', 'alb', 'ec2']);
      break;
    case 4:
      s = backbone(s, ['cloudfront', 's3', 'waf', 'alb', 'ec2']);
      break;
    case 5:
      s = backbone(s, ['waf', 'alb', 'ec2', 'cache', 'rds']);
      s = place(s, 'ec2', 480, 280);
      s = wire(s, 'alb', 'ec2', 0, 1);
      break;
    case 6:
      s = backbone(s, ['shield', 'waf', 'cloudfront', 'alb', 'ec2', 'lambda', 'sqs', 'rds', 's3']);
      break;
    case 7:
      s = backbone(s, [
        'route53',
        'shield',
        'waf',
        'cloudfront',
        'alb',
        'ec2',
        'lambda',
        'cache',
        'rds',
        's3',
        'sqs',
        'cloudwatch',
      ]);
      break;
    case 8:
      s = backbone(s, ['cloudfront', 's3', 'waf', 'alb', 'ec2', 'cache']);
      break;
    case 9:
      s = backbone(s, ['waf', 'alb', 'ec2', 'lambda', 'cache', 'rds']);
      break;
    case 10:
      s = backbone(s, ['waf', 'alb', 'ec2', 'lambda', 'sqs', 'dynamodb', 'rds']);
      s = place(s, 'ec2', 480, 280);
      s = wire(s, 'alb', 'ec2', 0, 1);
      break;
    case 11:
      s = backbone(s, [
        'cloudfront',
        'waf',
        'alb',
        'ec2',
        'lambda',
        'cache',
        's3',
        'sqs',
        'dynamodb',
        'rds',
        'cloudwatch',
      ]);
      break;
    default:
      fail(`no build for mission ${index}`);
  }
  return s;
}

function runTicks(s: GameState, seconds: number): GameState {
  s = { ...s, speed: 1, screen: 'play' };
  const steps = Math.ceil(seconds / 0.1);
  for (let i = 0; i < steps; i++) {
    s = simulate(s, 0.1);
    if (s.won || s.loseReason) break;
  }
  return s;
}

function assert(cond: boolean, msg: string) {
  if (!cond) fail(msg);
}

console.log('--- missions ---');
for (let i = 0; i < MISSIONS.length; i++) {
  const m = MISSIONS[i];
  let s = buildMission(i);
  s = runTicks(s, 140);
  const objs = evaluateObjectives(s);
  const open = objs.filter((o) => !o.done).map((o) => o.label);
  const line = `${m.kicker} ${m.title}: t=${s.simTime.toFixed(0)}s money=${s.money.toFixed(0)} sla=${sla(s).toFixed(0)} wa=${wellArchitected(s).total} won=${s.won} lose=${s.loseReason ?? '-'} pending=${open.join(' | ') || 'none'}`;
  console.log(line);
  if (s.loseReason) fail(`mission ${i} lost: ${s.loseReason}\n${line}`);
  if (!s.won) fail(`mission ${i} did not win in time\n${line}`);
}

console.log('--- sandbox ---');
{
  let s = createInitialState('sandbox', 0, 9);
  s = place(s, 'waf', 240, 180);
  s = place(s, 'ec2', 400, 180);
  s = wire(s, 'internet', 'waf');
  s = wire(s, 'waf', 'ec2');
  s.speed = 1;
  s.screen = 'play';
  s = runTicks(s, 40);
  assert(s.mode === 'sandbox', 'sandbox mode');
  assert(!s.won && !s.loseReason, `sandbox must not end the session, lose=${s.loseReason}`);
  assert(s.metrics.servedTotal > 0, 'sandbox served nothing');
  assert(s.simTime > 30, 'sandbox time');
  console.log(
    `sandbox ok t=${s.simTime.toFixed(0)} served=${s.metrics.servedTotal} money=${s.money.toFixed(0)} sla=${sla(s).toFixed(0)}`,
  );
}

console.log('--- production ---');
{
  let s = createInitialState('live', 0, 3);
  assert(s.speed === 0 && !s.liveStarted, 'staging starts closed');
  s = simulate(s, 0.1);
  assert(s.simTime === 0, 'staging must not tick');
  s = place(s, 'waf', 220, 180);
  s = place(s, 'cloudfront', 300, 180);
  s = place(s, 'alb', 380, 180);
  s = place(s, 'ec2', 460, 160);
  s = place(s, 'lambda', 460, 260);
  s = place(s, 'cache', 540, 160);
  s = place(s, 's3', 540, 260);
  s = wire(s, 'internet', 'waf');
  s = wire(s, 'waf', 'cloudfront');
  s = wire(s, 'cloudfront', 'alb');
  s = wire(s, 'cloudfront', 's3');
  s = wire(s, 'alb', 'ec2');
  s = wire(s, 'alb', 'lambda');
  s = wire(s, 'ec2', 'cache');
  s = goLive(s);
  assert(s.liveStarted && s.speed === 1, 'goLive opens the wire');
  s = runTicks(s, 25);
  assert(!s.loseReason, `production died early: ${s.loseReason}`);
  assert(s.simTime > 20, 'production time');
  assert(s.metrics.servedTotal > 0, 'production served nothing');
  console.log(
    `production ok t=${s.simTime.toFixed(0)} served=${s.metrics.servedTotal} money=${s.money.toFixed(0)} sla=${sla(s).toFixed(0)}`,
  );
}

console.log('VERIFY OK');
