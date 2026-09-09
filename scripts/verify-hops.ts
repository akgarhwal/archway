import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  APIGW_HOPS,
  CACHE_MISS_HOPS,
  CDN_ORIGIN_HOPS,
  CDN_STATIC_HOPS,
  DNS_HOPS,
  HOP_TABLE,
  INTERNET_HOPS,
  READ_HOPS,
  SHIELD_HOPS,
  WAF_HOPS,
  WRITE_HOPS,
  cdnHops,
  computeHops,
  firstMatchAny,
  firstOf,
} from '../src/sim/hops';
import type { RequestKind, ServiceId } from '../src/types';

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function nodes(...ids: ServiceId[]) {
  return ids.map((service) => ({ service }));
}

const CASES: { name: string; order: readonly ServiceId[]; wiredFirst: ServiceId[]; want: ServiceId }[] = [
  { name: 'Internet prefers Route 53 over a direct EC2', order: INTERNET_HOPS, wiredFirst: ['ec2', 'route53'], want: 'route53' },
  { name: 'Internet prefers WAF over Lambda', order: INTERNET_HOPS, wiredFirst: ['lambda', 'waf'], want: 'waf' },
  { name: 'Internet prefers CloudFront over S3', order: INTERNET_HOPS, wiredFirst: ['s3', 'cloudfront'], want: 'cloudfront' },
  { name: 'DNS prefers Shield over origin', order: DNS_HOPS, wiredFirst: ['ec2', 'shield'], want: 'shield' },
  { name: 'Shield prefers WAF over a parallel EC2', order: SHIELD_HOPS, wiredFirst: ['ec2', 'waf'], want: 'waf' },
  { name: 'WAF prefers CloudFront over Lambda', order: WAF_HOPS, wiredFirst: ['lambda', 'cloudfront'], want: 'cloudfront' },
  { name: 'WAF prefers ALB over S3', order: WAF_HOPS, wiredFirst: ['s3', 'alb'], want: 'alb' },
  { name: 'API Gateway prefers ALB over Lambda', order: APIGW_HOPS, wiredFirst: ['lambda', 'alb'], want: 'alb' },
  { name: 'CDN static prefers S3 over ALB', order: CDN_STATIC_HOPS, wiredFirst: ['alb', 's3'], want: 's3' },
  { name: 'CDN origin prefers ALB over S3', order: CDN_ORIGIN_HOPS, wiredFirst: ['s3', 'alb'], want: 'alb' },
  { name: 'reads prefer cache over DDB/RDS', order: READ_HOPS, wiredFirst: ['rds', 'dynamodb', 'cache'], want: 'cache' },
  { name: 'reads fall through to DDB if no cache', order: READ_HOPS, wiredFirst: ['rds', 'dynamodb'], want: 'dynamodb' },
  { name: 'writes prefer SQS over DDB', order: WRITE_HOPS, wiredFirst: ['dynamodb', 'sqs'], want: 'sqs' },
  { name: 'cache miss prefers DDB over RDS', order: CACHE_MISS_HOPS, wiredFirst: ['rds', 'dynamodb'], want: 'dynamodb' },
];

for (const c of CASES) {
  const cands = nodes(...c.wiredFirst);
  const got = firstOf(cands, c.order)?.service;
  must(got === c.want, `${c.name}: got ${got}, want ${c.want} (wired ${c.wiredFirst.join(' → ')})`);

  const trap = firstMatchAny(cands, c.order)?.service;
  if (trap !== c.want) {
    must(
      firstOf(cands, c.order)?.service === c.want,
      `${c.name}: firstMatchAny would have picked ${trap}; firstOf must still pick ${c.want}`,
    );
  }
}

must(firstOf(nodes('rds', 'cache'), READ_HOPS)?.service === 'cache', 'READ_HOPS cache over rds');
must(firstMatchAny(nodes('rds', 'cache'), READ_HOPS)?.service === 'rds', 'document the old bug: rds wins if we find-any');

must(computeHops('read') === READ_HOPS, 'read hops');
must(computeHops('search') === READ_HOPS, 'search hops');
must(computeHops('write') === WRITE_HOPS, 'write hops');
must(computeHops('static')?.length === 1 && computeHops('static')![0] === 's3', 'static → s3');
must(computeHops('malicious') === undefined, 'attacks are not data-plane hops');
must(cdnHops('static') === CDN_STATIC_HOPS, 'cdn static');
must(cdnHops('read') === CDN_ORIGIN_HOPS, 'cdn read');
must(cdnHops('write') === CDN_ORIGIN_HOPS, 'cdn write');

for (const [from, order] of Object.entries(HOP_TABLE)) {
  must(order.length > 0, `${from} hop list is empty`);
  const seen = new Set<string>();
  for (const id of order) {
    must(!seen.has(id), `${from} hop list duplicates ${id}`);
    seen.add(id);
  }
}

const kinds: RequestKind[] = ['static', 'read', 'write', 'upload', 'search'];
for (const kind of kinds) {
  const order = computeHops(kind);
  must(order !== undefined, `compute hops missing for ${kind}`);
  const reversed = [...order].reverse();
  must(firstOf(nodes(...reversed), order)?.service === order[0], `${kind}: first in order wins even if wired last`);
}

const engine = readFileSync(fileURLToPath(new URL('../src/sim/engine.ts', import.meta.url)), 'utf8');
must(engine.includes("from './hops'"), 'engine must import hop tables from hops.ts');
must(
  !/cands\.find\(\((?:n|c)\)\s*=>\s*\w+\.includes\(\1\.service\)/.test(engine.replace(/\s+/g, '')),
  'engine must not use cands.find(n => ids.includes(n.service)) — that picks wire order, not hop order',
);

console.log('HOPS OK', CASES.length, 'preference cases');
