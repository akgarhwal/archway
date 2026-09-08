import type { Mission, Mix } from '../types';

const quiet: Mix = {
  static: 0.4,
  read: 0.5,
  write: 0.05,
  upload: 0.05,
  search: 0,
  malicious: 0,
  ddos: 0,
};

const neighbors: Mix = {
  static: 0.32,
  read: 0.28,
  write: 0.1,
  upload: 0.06,
  search: 0.04,
  malicious: 0.18,
  ddos: 0.02,
};

const floody: Mix = {
  static: 0.3,
  read: 0.22,
  write: 0.08,
  upload: 0.05,
  search: 0.05,
  malicious: 0.1,
  ddos: 0.2,
};

const staticHeavy: Mix = {
  static: 0.62,
  read: 0.18,
  write: 0.06,
  upload: 0.08,
  search: 0.02,
  malicious: 0.03,
  ddos: 0.01,
};

const readHeavy: Mix = {
  static: 0.12,
  read: 0.58,
  write: 0.08,
  upload: 0.04,
  search: 0.08,
  malicious: 0.07,
  ddos: 0.03,
};

const writeHeavy: Mix = {
  static: 0.1,
  read: 0.18,
  write: 0.48,
  upload: 0.1,
  search: 0.04,
  malicious: 0.07,
  ddos: 0.03,
};

const prod: Mix = {
  static: 0.34,
  read: 0.26,
  write: 0.14,
  upload: 0.08,
  search: 0.06,
  malicious: 0.07,
  ddos: 0.05,
};

const browse: Mix = {
  static: 0.52,
  read: 0.28,
  write: 0.05,
  upload: 0.07,
  search: 0.04,
  malicious: 0.03,
  ddos: 0.01,
};

const seeking: Mix = {
  static: 0.12,
  read: 0.18,
  write: 0.06,
  upload: 0.02,
  search: 0.5,
  malicious: 0.08,
  ddos: 0.04,
};

const checkout: Mix = {
  static: 0.12,
  read: 0.16,
  write: 0.5,
  upload: 0.08,
  search: 0.06,
  malicious: 0.06,
  ddos: 0.02,
};

const sale: Mix = {
  static: 0.22,
  read: 0.2,
  write: 0.32,
  upload: 0.08,
  search: 0.08,
  malicious: 0.06,
  ddos: 0.04,
};

export const MISSIONS: Mission[] = [
  {
    id: 'boot',
    kicker: 'Mission 01',
    title: 'First Packet',
    briefing:
      'The company is live with nothing behind the Internet gateway. Place a compute instance, wire users to it, and watch a request travel. This is the naive architecture every production system grows out of.',
    stakes: 'If you cannot serve a packet, there is no product.',
    win: 'You have a request path. Next you will learn why one box is not an architecture.',
    hint: 'Drag EC2 onto the canvas, then drag from the Internet node’s right handle to EC2.',
    startRps: 5,
    rpsGrowth: 0,
    mix: quiet,
    events: false,
    objectives: [
      { id: 'place-ec2', type: 'place', service: 'ec2', label: 'Place an EC2 instance' },
      { id: 'wire', type: 'path', from: 'internet', to: 'ec2', label: 'Wire Internet → EC2' },
      { id: 'serve', type: 'serve', n: 25, label: 'Serve 25 successful requests' },
    ],
    failSla: 0,
    recommended: ['ec2'],
  },
  {
    id: 'balance',
    kicker: 'Mission 02',
    title: 'One Box Is Not an Architecture',
    briefing:
      'Traffic is climbing. A single EC2 is a single point of failure — and a single queue of latency. Put an Application Load Balancer in front and give it two healthy targets.',
    stakes: 'Saturation on one instance drops legitimate requests. Dropped requests are SLA credits you pay.',
    win: 'Horizontal scale. The ALB is useless with one target — you gave it two.',
    hint: 'Internet → ALB → EC2, plus a second EC2 also fed by the ALB.',
    startRps: 16,
    rpsGrowth: 0.08,
    mix: quiet,
    events: false,
    objectives: [
      { id: 'alb', type: 'place', service: 'alb', label: 'Place an ALB' },
      { id: 'two', type: 'count', service: 'ec2', n: 2, label: 'Run at least two EC2 instances' },
      { id: 'path', type: 'path', from: 'alb', to: 'ec2', label: 'ALB must reach EC2' },
      { id: 'sla', type: 'sla', n: 92, label: 'Hold SLA ≥ 92% for 20s' },
    ],
    failSla: 40,
    recommended: ['alb', 'ec2'],
  },
  {
    id: 'bad-neighbors',
    kicker: 'Mission 03',
    title: 'Bad Neighbors',
    briefing:
      'The mix just got hostile. SQLi and XSS ride in as ordinary HTTP. A load balancer will happily distribute attacks across every instance you own. You need a WAF in front of origin — inspection, not just spread.',
    stakes: 'A malicious request that reaches compute is a compromise. One that reaches RDS is a breach tax.',
    win: 'Blocking is not overhead. It is how you keep the bill and the brand.',
    hint: 'Internet → WAF → ALB. Do not leave a parallel edge from Internet to EC2 — that is a bypass.',
    startRps: 14,
    rpsGrowth: 0.04,
    mix: neighbors,
    events: false,
    objectives: [
      { id: 'waf', type: 'place', service: 'waf', label: 'Place a WAF' },
      { id: 'onpath', type: 'path', from: 'internet', to: 'waf', label: 'Internet can reach the WAF' },
      { id: 'block', type: 'block', n: 18, label: 'Block 18 attacks at the edge' },
      { id: 'sla', type: 'sla', n: 90, label: 'Hold SLA ≥ 90% for 20s' },
    ],
    failSla: 35,
    recommended: ['waf', 'alb', 'ec2'],
  },
  {
    id: 'flood',
    kicker: 'Mission 04',
    title: 'The Flood',
    briefing:
      'A volumetric wave is coming. The instinct is more EC2. That instinct is how you pay to process the attack. Absorb at the edge with Shield and/or CloudFront. Origin should barely notice.',
    stakes: 'DDoS that reaches origin is a bill attack. Lambda will scale — and invoice you for every packet.',
    win: 'Edge absorption. You did not scale the origin to eat garbage.',
    hint: 'Shield and CloudFront in front of the WAF. Watch origin RPS stay flat during the wave.',
    startRps: 12,
    rpsGrowth: 0.05,
    mix: floody,
    events: true,
    eventDelay: 12,
    objectives: [
      { id: 'edge', type: 'place', service: 'cloudfront', label: 'Place CloudFront or Shield' },
      { id: 'shieldpath', type: 'path', from: 'internet', to: 'waf', label: 'Keep WAF on the path' },
      { id: 'survive', type: 'survive', n: 55, label: 'Survive 55 seconds of hostile traffic' },
      { id: 'sla', type: 'sla', n: 88, label: 'Hold SLA ≥ 88% for 15s' },
    ],
    failSla: 30,
    recommended: ['shield', 'cloudfront', 'waf', 'alb', 'ec2'],
  },
  {
    id: 'edge',
    kicker: 'Mission 05',
    title: 'Edge First',
    briefing:
      'Most of the internet is asking for files, not SQL. CloudFront should terminate static at the edge; S3 is the origin for misses. If EC2 is serving PNGs, you are burning the wrong resource.',
    stakes: 'Origin offload is performance and cost. Hit ratio is the number that matters.',
    win: 'Static never needed a web server. You proved it with the CDN hit counter.',
    hint: 'Internet → CloudFront, CloudFront → S3 (static) and CloudFront → ALB (the rest).',
    startRps: 22,
    rpsGrowth: 0.06,
    mix: staticHeavy,
    events: true,
    eventDelay: 20,
    objectives: [
      { id: 'cf', type: 'place', service: 'cloudfront', label: 'Place CloudFront' },
      { id: 's3', type: 'place', service: 's3', label: 'Place S3 as the static origin' },
      { id: 'path', type: 'path', from: 'cloudfront', to: 's3', label: 'CloudFront can reach S3' },
      { id: 'serve', type: 'serve', n: 80, label: 'Serve 80 successful requests' },
    ],
    failSla: 40,
    recommended: ['cloudfront', 's3', 'waf', 'alb', 'ec2'],
  },
  {
    id: 'cache-is-king',
    kicker: 'Mission 06',
    title: 'Cache Is King',
    briefing:
      'Reads are dominating. RDS will not survive this QPS. Put ElastiCache in front of the database. Then survive a cache stampede — when hit ratio collapses, the DB sees everyone at once.',
    stakes: 'A cache is not optional at this mix. A stampede is why TTLs and request coalescing exist.',
    win: 'You felt a stampede. The database is the source of truth, not the front door for every GET.',
    hint: 'EC2 → ElastiCache and EC2 → RDS. Reads prefer the cache; misses fall through.',
    startRps: 20,
    rpsGrowth: 0.07,
    mix: readHeavy,
    events: true,
    eventDelay: 18,
    objectives: [
      { id: 'cache', type: 'place', service: 'cache', label: 'Place ElastiCache' },
      { id: 'rds', type: 'place', service: 'rds', label: 'Place RDS' },
      { id: 'path', type: 'path', from: 'ec2', to: 'cache', label: 'Compute can reach the cache' },
      { id: 'sla', type: 'sla', n: 90, label: 'Hold SLA ≥ 90% for 20s' },
    ],
    failSla: 35,
    recommended: ['waf', 'alb', 'ec2', 'cache', 'rds'],
  },
  {
    id: 'async',
    kicker: 'Mission 07',
    title: 'Don’t Block the Hot Path',
    briefing:
      'Writes are arriving in bursts. If every POST waits on RDS, the API latencies climb together. Accept on SQS (HTTP 202) and let workers drain. A queue without a consumer is a black hole; a queue that overflows still drops.',
    stakes: 'Synchronous write spikes melt databases. Async is how checkout survives a flash sale.',
    win: 'The user got “accepted.” The database got a smooth drain. That is the whole pattern.',
    hint: 'API/compute → SQS → EC2/Lambda → RDS. Keep a worker connected or the depth will climb.',
    startRps: 18,
    rpsGrowth: 0.08,
    mix: writeHeavy,
    events: true,
    eventDelay: 14,
    objectives: [
      { id: 'sqs', type: 'place', service: 'sqs', label: 'Place SQS' },
      { id: 'path', type: 'path', from: 'ec2', to: 'sqs', label: 'Compute can enqueue to SQS' },
      { id: 'survive', type: 'survive', n: 50, label: 'Survive 50 seconds of write-heavy traffic' },
      { id: 'sla', type: 'sla', n: 88, label: 'Hold SLA ≥ 88% for 15s' },
    ],
    failSla: 32,
    recommended: ['apigateway', 'alb', 'ec2', 'sqs', 'rds', 'lambda'],
  },
  {
    id: 'production',
    kicker: 'Mission 08',
    title: 'Black Friday',
    briefing:
      'This is the job. Hostile mix, random events, a bill that does not care about your feelings. Build a production path: DNS, Shield, WAF, CloudFront, ALB, compute, cache, data, queue, and something watching it. Hold the SLA. Stay solvent. Score 70 on Well-Architected.',
    stakes: 'Over-provision and you go broke on a quiet minute. Under-protect and the flood writes the invoice.',
    win: 'This is a production-shaped system. Take the debrief seriously — it is the interview answer.',
    hint: 'Canonical path: Route 53 → Shield → WAF → CloudFront → ALB → EC2, with S3, cache, RDS, SQS, CloudWatch.',
    startRps: 18,
    rpsGrowth: 0.12,
    mix: prod,
    events: true,
    eventDelay: 10,
    objectives: [
      { id: 'survive', type: 'survive', n: 90, label: 'Stay up for 90 seconds' },
      { id: 'sla', type: 'sla', n: 93, label: 'Hold SLA ≥ 93% for 25s' },
      { id: 'wa', type: 'wa', n: 70, label: 'Well-Architected score ≥ 70' },
      { id: 'profit', type: 'profit', n: 0, label: 'Finish with a non-negative ledger' },
    ],
    failSla: 28,
    recommended: [
      'route53',
      'shield',
      'waf',
      'cloudfront',
      'alb',
      'ec2',
      'cache',
      'rds',
      's3',
      'sqs',
      'cloudwatch',
    ],
  },
  {
    id: 'shop-catalog',
    kicker: 'Store 01',
    title: 'The Catalog',
    briefing:
      'The shop is open and everyone is browsing. Product images and PDPs are mostly files, not SQL. CloudFront should terminate the photos; S3 is the origin for misses. Put a cache beside compute for the product reads that still get through. If EC2 is serving JPEGs, you already lost.',
    stakes: 'A product photo from origin is a self-inflicted bill.',
    win: 'Static never needed a web server. The catalog is an edge problem.',
    hint: 'Internet → CloudFront → S3 for assets. CloudFront → ALB → EC2 → ElastiCache for product reads.',
    startRps: 24,
    rpsGrowth: 0.06,
    mix: browse,
    events: false,
    objectives: [
      { id: 'cf', type: 'place', service: 'cloudfront', label: 'Place CloudFront' },
      { id: 's3', type: 'place', service: 's3', label: 'Place S3 as the image origin' },
      { id: 'cache', type: 'place', service: 'cache', label: 'Place ElastiCache for product reads' },
      { id: 'path', type: 'path', from: 'cloudfront', to: 's3', label: 'CloudFront can reach S3' },
      { id: 'serve', type: 'serve', n: 90, label: 'Serve 90 successful requests' },
    ],
    failSla: 40,
    recommended: ['cloudfront', 's3', 'waf', 'alb', 'ec2', 'cache'],
  },
  {
    id: 'shop-search',
    kicker: 'Store 02',
    title: 'The Search Box',
    briefing:
      'Typeahead is a different shape of traffic. Search packets cost more than a GET. If every keystroke is SELECT LIKE on RDS, browse takes down buy. Cache the hot queries. Hide the database behind compute. Never put RDS on the public internet.',
    stakes: 'A typeahead that hits RDS is how the store takes itself down.',
    win: 'Search is its own path. The catalog cache is not optional once people start typing.',
    hint: 'ALB → EC2 → ElastiCache, with RDS only on a cache miss. Do not wire Internet → RDS.',
    startRps: 16,
    rpsGrowth: 0.05,
    mix: seeking,
    events: false,
    objectives: [
      { id: 'cache', type: 'place', service: 'cache', label: 'Place ElastiCache' },
      { id: 'rds', type: 'place', service: 'rds', label: 'Place RDS behind compute' },
      { id: 'path', type: 'path', from: 'ec2', to: 'cache', label: 'Compute can reach the cache' },
      { id: 'sla', type: 'sla', n: 90, label: 'Hold SLA ≥ 90% for 20s' },
    ],
    failSla: 35,
    recommended: ['waf', 'alb', 'ec2', 'lambda', 'cache', 'rds'],
  },
  {
    id: 'shop-checkout',
    kicker: 'Store 03',
    title: 'Place the Order',
    briefing:
      'Checkout is a write burst. If every POST /order waits on RDS, latency climbs together and the sale dies. Accept on SQS (HTTP 202) and let a worker drain. DynamoDB is the cart; RDS is the ledger. A queue without a consumer is a black hole.',
    stakes: 'Checkout that waits on SQL is a flash-sale outage with extra steps.',
    win: 'The customer got “accepted.” The ledger got a smooth drain. That is checkout.',
    hint: 'Compute → SQS → worker (EC2/Lambda) → RDS. Cart state belongs on DynamoDB, not on the PDP path.',
    startRps: 18,
    rpsGrowth: 0.09,
    mix: checkout,
    events: true,
    eventDelay: 12,
    objectives: [
      { id: 'sqs', type: 'place', service: 'sqs', label: 'Place SQS for orders' },
      { id: 'ddb', type: 'place', service: 'dynamodb', label: 'Place DynamoDB for the cart' },
      { id: 'path', type: 'path', from: 'ec2', to: 'sqs', label: 'Compute can enqueue to SQS' },
      { id: 'survive', type: 'survive', n: 50, label: 'Survive 50 seconds of checkout traffic' },
      { id: 'sla', type: 'sla', n: 88, label: 'Hold SLA ≥ 88% for 20s' },
    ],
    failSla: 32,
    recommended: ['apigateway', 'alb', 'ec2', 'lambda', 'sqs', 'dynamodb', 'rds'],
  },
  {
    id: 'shop-flash',
    kicker: 'Store 04',
    title: 'Flash Sale',
    briefing:
      'The SKU just dropped. Browse, search, and checkout hit the same wire. A flash-sale event will fire — writes spike, then a lull still invoices. Edge the catalog, cache the reads, queue the orders. Hold the SLA. Stay solvent.',
    stakes: 'The store you designed has to hold when everyone wants the same thing.',
    win: 'That is an e-commerce architecture. Catalog at the edge, search off the SQL, checkout accepted not finished.',
    hint: 'CloudFront + S3, cache, SQS workers, WAF. Do not buy ten more EC2s when the flood is actually buyers.',
    startRps: 20,
    rpsGrowth: 0.11,
    mix: sale,
    events: true,
    eventDelay: 10,
    objectives: [
      { id: 'survive', type: 'survive', n: 80, label: 'Stay up for 80 seconds' },
      { id: 'sla', type: 'sla', n: 90, label: 'Hold SLA ≥ 90% for 20s' },
      { id: 'profit', type: 'profit', n: 0, label: 'Finish with a non-negative ledger' },
      { id: 'wa', type: 'wa', n: 65, label: 'Well-Architected score ≥ 65' },
    ],
    failSla: 30,
    recommended: [
      'cloudfront',
      'waf',
      'alb',
      'ec2',
      'cache',
      's3',
      'sqs',
      'dynamodb',
      'rds',
      'cloudwatch',
    ],
  },
];

export const CORE_MISSION_COUNT = 8;

export function trackStart(index: number): number {
  return index < CORE_MISSION_COUNT ? 0 : CORE_MISSION_COUNT;
}

export function trackEnd(index: number): number {
  return index < CORE_MISSION_COUNT ? CORE_MISSION_COUNT : MISSIONS.length;
}

/** Core curriculum unlocks in order. Storefront is a separate track — every shop mission is open. */
export function isMissionLocked(index: number, completed: string[]): boolean {
  if (index < 0 || index >= MISSIONS.length) return true;
  if (index >= CORE_MISSION_COUNT) return false;
  if (index === 0) return false;
  return !completed.includes(MISSIONS[index - 1].id);
}

export function nextMissionInTrack(index: number): number | null {
  const end = trackEnd(index);
  const next = index + 1;
  return next < end ? next : null;
}
