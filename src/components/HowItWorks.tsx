import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { HourlyQuote } from './HourlyQuote';
import { RequestPathDemo, type DemoHopId } from './RequestPathDemo';

const STEPS: { id: DemoHopId | 'cloudwatch'; title: string; body: string; why: string }[] = [
  {
    id: 'users',
    title: 'Users',
    body: 'Customers, bots, and floods share the same wire.',
    why: 'There is no separate attacker network. Every packet is born here — your job is to decide which hops it is allowed to reach.',
  },
  {
    id: 'route53',
    title: 'Route 53',
    body: 'DNS. Health checks send users to a live edge, not a dead box.',
    why: 'Cheap and fast. When an origin dies, DNS should stop sending people there. Skip it and you have no failover story.',
  },
  {
    id: 'shield',
    title: 'Shield',
    body: 'L3/L4. Volumetric DDoS dies here. SQLi sails through.',
    why: 'Shield absorbs floods before they become an EC2 bill. It does not read HTTP. Application attacks still need a WAF.',
  },
  {
    id: 'waf',
    title: 'WAF',
    body: 'L7 inspect. Blocks SQLi, XSS, bots. Undersized WAFs fail open.',
    why: 'This is the hop that turns a breach into a 403. Put it in front of origin. A parallel wire around it is a bypass.',
  },
  {
    id: 'cloudfront',
    title: 'CloudFront',
    body: 'CDN. Hits never touch EC2 or RDS. Also soaks a slice of floods.',
    why: 'Most of the internet is files, not SQL. A cache hit at the edge is the cheapest 200 you will ever serve.',
  },
  {
    id: 'alb',
    title: 'ALB',
    body: 'Spreads HTTP across targets. Does not inspect like a WAF.',
    why: 'A load balancer with one instance is still a single point of failure. Two healthy targets is the minimum architecture.',
  },
  {
    id: 'ec2',
    title: 'EC2',
    body: 'Compute. Finite CPU. Lambda will scale — including into your invoice.',
    why: 'This is origin. DDoS that lands here is work you pay for. Keep it behind the edge, and give it a cache and a queue.',
  },
  {
    id: 'cache',
    title: 'Cache',
    body: 'Hot reads. Misses and stampedes become the database’s problem.',
    why: 'ElastiCache sits beside compute, never on the public internet. A stampede is every reader arriving at RDS at once.',
  },
  {
    id: 'rds',
    title: 'RDS',
    body: 'Source of truth. Low QPS. Never public.',
    why: 'Internet → RDS is a breach with extra steps. Hide it behind compute. Let the cache take the reads.',
  },
  {
    id: 's3',
    title: 'S3',
    body: 'Object origin for CloudFront. Not a SQL database.',
    why: 'Static and uploads belong here. Pair it with CloudFront so the bucket is not the front door.',
  },
  {
    id: 'sqs',
    title: 'SQS',
    body: 'Async writes. Accept 202, drain later. Needs a consumer.',
    why: 'A queue stores work. A worker (EC2/Lambda) does the work. RDS cannot poll SQS.',
  },
  {
    id: 'cloudwatch',
    title: 'CloudWatch',
    body: 'Watches the path. Not on it.',
    why: 'Saturation you cannot see is just an outage with better excuses. Place it; it never takes a packet.',
  },
];

export function HowItWorks() {
  const setScreen = useGame((s) => s.setScreen);
  const startMission = useGame((s) => s.startMission);
  const [scene, setScene] = useState(0);
  const [hop, setHop] = useState<DemoHopId | null>('users');
  const onScene = useCallback((i: number) => setScene(i), []);
  const onActiveHop = useCallback((id: DemoHopId | null) => setHop(id), []);
  const highlight = hop;
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(0);
  const active = STEPS.find((s) => s.id === highlight) ?? STEPS[0];

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const apply = () => setPanelH(Math.round(el.getBoundingClientRect().height));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="screen how-screen">
      <div className="how-main">
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('title')}>
          ← Home
        </button>
        <div className="kicker" style={{ marginTop: 18 }}>
          Request path
        </div>
        <h1>How a packet earns — or costs.</h1>
        <p className="how-lede">
          High-level design is the ordered list of hops between a user and a 200. Watch seven
          request types walk the same production path — including the ones that actually reach
          RDS and S3. Money is what happens when that list is wrong.
        </p>
        <div className="how-split">
          <div className="how-panel" ref={panelRef}>
            <div className="how-flow">
              {STEPS.map((s) => (
                <div key={s.id} className={`how-step ${highlight === s.id ? 'active' : ''}`}>
                  <b>{s.title}</b>
                  <span>{s.body}</span>
                </div>
              ))}
            </div>
            <div className="how-focus">
              <span className="kicker">On this hop</span>
              <h3>{active.title}</h3>
              <p>{active.why}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => startMission(0)}>
              Start mission 01
            </button>
          </div>
          <RequestPathDemo
            sceneIndex={scene}
            onScene={onScene}
            onActiveHop={onActiveHop}
            height={panelH}
          />
        </div>
        <HourlyQuote />
      </div>
    </div>
  );
}
