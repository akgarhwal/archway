import type { PlacedNode, RequestKind, ServiceId } from '../types';

/** Canonical next-hop lists. Walk these in order; never “first neighbor that matches any of them”. */
export const INTERNET_HOPS = [
  'route53',
  'shield',
  'waf',
  'cloudfront',
  'apigateway',
  'alb',
  'ec2',
  'lambda',
  's3',
  'sqs',
  'cache',
  'rds',
  'dynamodb',
] as const satisfies readonly ServiceId[];

export const DNS_HOPS = [
  'shield',
  'waf',
  'cloudfront',
  'apigateway',
  'alb',
  'ec2',
  'lambda',
] as const satisfies readonly ServiceId[];

export const SHIELD_HOPS = ['waf', 'cloudfront', 'apigateway', 'alb', 'ec2'] as const satisfies readonly ServiceId[];

export const WAF_HOPS = [
  'cloudfront',
  'apigateway',
  'alb',
  'ec2',
  'lambda',
  's3',
] as const satisfies readonly ServiceId[];

export const APIGW_HOPS = ['alb', 'lambda', 'ec2', 'sqs'] as const satisfies readonly ServiceId[];

export const CDN_STATIC_HOPS = ['s3', 'alb', 'apigateway', 'ec2', 'lambda'] as const satisfies readonly ServiceId[];

export const CDN_ORIGIN_HOPS = ['apigateway', 'alb', 'ec2', 'lambda', 's3'] as const satisfies readonly ServiceId[];

export const READ_HOPS = ['cache', 'dynamodb', 'rds'] as const satisfies readonly ServiceId[];

export const WRITE_HOPS = ['sqs', 'dynamodb', 'rds'] as const satisfies readonly ServiceId[];

export const OBJECT_HOPS = ['s3'] as const satisfies readonly ServiceId[];

export const CACHE_MISS_HOPS = ['dynamodb', 'rds'] as const satisfies readonly ServiceId[];

export const HOP_TABLE = {
  internet: INTERNET_HOPS,
  route53: DNS_HOPS,
  shield: SHIELD_HOPS,
  waf: WAF_HOPS,
  apigateway: APIGW_HOPS,
} as const;

type HopCand = Pick<PlacedNode, 'service'>;

/**
 * First connected hop in `ids` order.
 * Two of the same service: the one that appears first in `cands` (wired first).
 */
export function firstOf<T extends HopCand>(cands: T[], ids: readonly ServiceId[]): T | undefined {
  for (const id of ids) {
    const n = cands.find((c) => c.service === id);
    if (n) return n;
  }
  return undefined;
}

/** The anti-pattern that stole cache hits: first neighbor whose service is *anywhere* in the list. */
export function firstMatchAny<T extends HopCand>(cands: T[], ids: readonly ServiceId[]): T | undefined {
  return cands.find((n) => (ids as readonly string[]).includes(n.service));
}

export function computeHops(kind: RequestKind): readonly ServiceId[] | undefined {
  if (kind === 'static' || kind === 'upload') return OBJECT_HOPS;
  if (kind === 'read' || kind === 'search') return READ_HOPS;
  if (kind === 'write') return WRITE_HOPS;
  return undefined;
}

export function cdnHops(kind: RequestKind): readonly ServiceId[] {
  return kind === 'static' || kind === 'upload' ? CDN_STATIC_HOPS : CDN_ORIGIN_HOPS;
}
