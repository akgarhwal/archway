import { DEFAULT_MIX, LIVE_MIX } from '../src/data/catalog';
import { makeEvent } from '../src/data/events';
import { MISSIONS } from '../src/data/missions';
import {
  connectNodes,
  createInitialState,
  currentMix,
  deleteSelection,
  goLive,
  placeNode,
  simulate,
  upgradeNode,
} from '../src/sim/engine';
import { mixFocus } from '../src/sim/mixFocus';
import { sla } from '../src/sim/score';

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let s = createInitialState('mission', 0, 42);
must(s.money === 7200, 'start money');
const placed = placeNode(s, 'ec2', 300, 200);
if ('error' in placed) throw new Error(placed.error);
s = placed;
const wired = connectNodes(s, 'n_internet', s.nodes.find((n) => n.service === 'ec2')!.id);
if ('error' in wired) throw new Error(wired.error);
s = wired;
s.speed = 1;
s.screen = 'play';
for (let i = 0; i < 80; i++) s = simulate(s, 0.1);
must(s.metrics.servedTotal > 0, 'should serve after wiring, got ' + s.metrics.servedTotal);
must(s.metrics.seenTotal >= s.metrics.servedTotal, 'seen includes served');
console.log('boot served', s.metrics.servedTotal, 'seen', s.metrics.seenTotal, 'money', s.money.toFixed(1));

s = createInitialState('sandbox', 0, 7);
const p2 = placeNode(s, 'ec2', 300, 200);
if ('error' in p2) throw new Error(p2.error);
s = p2;
const w2 = connectNodes(s, 'n_internet', s.nodes.find((n) => n.service === 'ec2')!.id);
if ('error' in w2) throw new Error(w2.error);
s = w2;
s.speed = 1;
s.screen = 'play';
for (let i = 0; i < 200; i++) s = simulate(s, 0.1);
console.log(
  'sandbox t',
  s.simTime.toFixed(1),
  'money',
  s.money.toFixed(1),
  'burns',
  s.metrics.originBurns,
  'breaches',
  s.metrics.breaches,
  'event',
  s.event?.type ?? 'none',
);
for (let i = 0; i < 800; i++) s = simulate(s, 0.1);
const slaNow = sla(s);
must(s.metrics.legitTotWindow >= 4, 'SLA window should fill on a live path');
must(s.metrics.legitOkWindow <= s.metrics.legitTotWindow + 1e-9, 'ok cannot exceed tot');
must(slaNow <= 100, 'SLA cannot exceed 100%, got ' + slaNow);
must(slaNow >= 0, 'SLA cannot be negative, got ' + slaNow);
console.log('sla window', s.metrics.legitOkWindow.toFixed(1), '/', s.metrics.legitTotWindow, '=', slaNow.toFixed(1) + '%');

s = createInitialState('mission', 2, 99);
let cur = s;
for (const svc of ['waf', 'ec2'] as const) {
  const r = placeNode(cur, svc, 200, 180);
  if ('error' in r) throw new Error(r.error);
  cur = r;
}
const waf = cur.nodes.find((n) => n.service === 'waf')!.id;
const ec2 = cur.nodes.find((n) => n.service === 'ec2')!.id;
let c = connectNodes(cur, 'n_internet', waf);
if ('error' in c) throw new Error(c.error);
cur = c;
c = connectNodes(cur, waf, ec2);
if ('error' in c) throw new Error(c.error);
cur = c;
cur.speed = 1;
cur.screen = 'play';
for (let i = 0; i < 120; i++) cur = simulate(cur, 0.1);
console.log('waf served', cur.metrics.servedTotal, 'blocked', cur.metrics.blocked, 'breaches', cur.metrics.breaches);
must(cur.metrics.blocked > 0, 'WAF should block some attacks');

s = createInitialState('live', 0, 3);
must(s.money === 7200, 'live grant');
must(s.speed === 0 && !s.liveStarted, 'live starts paused');
s = simulate(s, 0.1);
must(s.simTime === 0, 'planning does not tick');
s = goLive(s);
must(s.liveStarted && s.speed === 1, 'goLive opens the wire');
const liveBox = placeNode(s, 'ec2', 300, 200);
if ('error' in liveBox) throw new Error(liveBox.error);
s = liveBox;
const liveWire = connectNodes(s, 'n_internet', s.nodes.find((n) => n.service === 'ec2')!.id);
if ('error' in liveWire) throw new Error(liveWire.error);
s = liveWire;
s.speed = 1;
s.liveStarted = true;
for (let i = 0; i < 40; i++) s = simulate(s, 0.1);
must(s.simTime > 3, 'live time advances, got ' + s.simTime);
console.log('live after go', 't', s.simTime.toFixed(1), 'served', s.metrics.servedTotal, 'money', s.money.toFixed(0));

s = createInitialState('sandbox', 0, 1);
let box = placeNode(s, 'ec2', 200, 200);
if ('error' in box) throw new Error(box.error);
s = box;
must(s.money === 7200 - 720, 'pay full capex');
must(s.metrics.spend === 720, 'spend tracks capex');
s = { ...s, selectedId: s.nodes.find((n) => n.service === 'ec2')!.id };
s = deleteSelection(s);
must(s.money === 7200 - 360, 'sell 50% of T1 capex, got ' + s.money);
must(s.metrics.spend === 360, 'spend credited by refund, got ' + s.metrics.spend);
must(!s.nodes.some((n) => n.service === 'ec2'), 'node gone');
must(s.edges.length === 0, 'wires ripped with the box');

s = createInitialState('sandbox', 0, 1);
box = placeNode(s, 'ec2', 200, 200);
if ('error' in box) throw new Error(box.error);
s = box;
const up = upgradeNode(s, s.nodes.find((n) => n.service === 'ec2')!.id);
if ('error' in up) throw new Error(up.error);
s = up;
must(s.money === 7200 - 720 - 620, 'paid T2');
s = { ...s, selectedId: s.nodes.find((n) => n.service === 'ec2')!.id };
s = deleteSelection(s);
must(s.money === 7200 - (720 + 620) / 2, 'sell 50% of capex+upgrade, got ' + s.money);
must(s.metrics.spend === (720 + 620) / 2, 'spend after T2 sell, got ' + s.metrics.spend);

s = createInitialState('sandbox', 0, 1);
s = { ...s, selectedId: 'n_internet' };
s = deleteSelection(s);
must(s.nodes.some((n) => n.service === 'internet'), 'cannot sell Users');

{
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  const boot = createInitialState('mission', 0, 1);
  must(near(currentMix(boot).read, MISSIONS[0].mix.read), 'mission 01 mix is quiet reads');
  must(currentMix(boot).malicious === 0, 'mission 01 has no attacks');
  must(mixFocus(currentMix(boot)).startsWith('Mixed product'), 'quiet mix is mixed, not cache-heavy');

  const edge = createInitialState('mission', 4, 1);
  must(currentMix(edge).static > 0.55, 'edge-first is static-heavy');
  must(mixFocus(currentMix(edge)).includes('CDN'), 'static-heavy focus names CDN');

  const cacheM = createInitialState('mission', 5, 1);
  must(currentMix(cacheM).read > 0.5, 'cache mission is read-heavy');
  must(mixFocus(currentMix(cacheM)).includes('Cache'), 'read-heavy focus names cache');

  const writes = createInitialState('mission', 6, 1);
  must(currentMix(writes).write > 0.4, 'async mission is write-heavy');
  must(mixFocus(currentMix(writes)).includes('Queue'), 'write-heavy focus names the queue');

  const seeking = createInitialState('mission', 9, 1);
  must(currentMix(seeking).search >= 0.45, 'shop search is search-heavy');
  must(mixFocus(currentMix(seeking)).includes('Search-heavy'), 'search mix names search');

  const neighbors = createInitialState('mission', 2, 1);
  must(mixFocus(currentMix(neighbors)).includes('Hostile'), 'bad-neighbors mix is hostile');

  const flood = createInitialState('mission', 3, 1);
  must(mixFocus(currentMix(flood)).includes('Flood'), 'the-flood mix names the flood');

  const sandbox = createInitialState('sandbox', 0, 1);
  must(near(currentMix(sandbox).static, DEFAULT_MIX.static), 'sandbox uses default mix');
  must(mixFocus(currentMix(sandbox)).startsWith('Mixed product'), 'sandbox baseline is mixed');

  const live = createInitialState('live', 0, 1);
  must(!live.liveStarted, 'staging starts closed');
  must(near(currentMix(live).malicious, LIVE_MIX.malicious), 'staging already uses live mix');
  must(mixFocus(currentMix(live)).includes('Hostile'), 'production mix is hostile from staging');

  const waved = { ...live, event: makeEvent('ddos', null) };
  must(currentMix(waved).ddos > 0.5, 'ddos event replaces the mix');
  must(mixFocus(currentMix(waved), 'ddos').includes('garbage'), 'ddos event copy');
  must(mixFocus(LIVE_MIX, 'stampede').includes('Hit ratio'), 'stampede copy even when mix is unchanged');
  console.log('mix bar', mixFocus(currentMix(live)), '| event', mixFocus(currentMix(waved), 'ddos'));
}

console.log('SMOKE OK');
