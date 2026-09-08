import type { EventType, Mix } from '../types';

/** Copy under the mix bar — what this workload wants you to buy. */
export function mixFocus(mix: Mix, event?: EventType | null): string {
  switch (event) {
    case 'ddos':
      return 'Most of this is garbage. Do not scale origin to eat it.';
    case 'flash':
      return 'Writes just became half the wire. Queue them or RDS dies.';
    case 'stampede':
      return 'Hit ratio cratered. Every read is now a database read.';
    case 'spike':
      return 'Legitimate surge. Headroom and two targets, or latency cliffs.';
    case 'poison':
      return 'Crafted attacks. A saturated WAF will start failing open.';
    case 'neighbor':
      return 'One instance just lost capacity. Never run a single EC2.';
    case 'lull':
      return 'Users went quiet. Idle boxes still invoice.';
    default:
      break;
  }
  const attack = (mix.malicious || 0) + (mix.ddos || 0);
  if ((mix.ddos || 0) >= 0.15) {
    return 'Flood on the wire. Absorb at Shield / CDN, not more EC2.';
  }
  if (attack >= 0.15) {
    return 'Hostile wire. WAF/Shield before more origin.';
  }
  if ((mix.static || 0) >= 0.45) {
    return 'Mostly files. CDN hits never touch EC2.';
  }
  if ((mix.read || 0) >= 0.55) {
    return 'Read-heavy. Cache in front of RDS.';
  }
  if ((mix.write || 0) >= 0.3) {
    return 'Write burst. Queue it or the database becomes the hot path.';
  }
  if ((mix.search || 0) >= 0.35) {
    return 'Search-heavy. This query does not belong as a LIKE on RDS.';
  }
  return 'Mixed product. CDN for files, cache for reads, queue for writes, edge for garbage.';
}
