import type { ActiveEvent, EventType, Mix } from '../types';

export const EVENT_COPY: Record<
  EventType,
  { title: string; detail: string; duration: number; rpsMul: number; cacheMul: number; mix?: Mix }
> = {
  ddos: {
    title: 'DDoS wave',
    detail: 'Volumetric + L7 flood. Absorb at Shield / CloudFront / WAF — do not scale origin to eat it.',
    duration: 16,
    rpsMul: 3.2,
    cacheMul: 1,
    mix: {
      static: 0.08,
      read: 0.08,
      write: 0.04,
      upload: 0.02,
      search: 0.02,
      malicious: 0.16,
      ddos: 0.6,
    },
  },
  flash: {
    title: 'Flash sale',
    detail: 'Write burst. A queue turns this into 202 Accepted. A naked RDS turns it into 500s.',
    duration: 14,
    rpsMul: 2.1,
    cacheMul: 1,
    mix: {
      static: 0.1,
      read: 0.16,
      write: 0.52,
      upload: 0.1,
      search: 0.04,
      malicious: 0.06,
      ddos: 0.02,
    },
  },
  stampede: {
    title: 'Cache stampede',
    detail: 'Hit ratio collapsed. Every read is now a database read. This is why TTLs and coalescing exist.',
    duration: 10,
    rpsMul: 1.35,
    cacheMul: 0.08,
  },
  spike: {
    title: 'Traffic spike',
    detail: 'Legitimate surge. Headroom and an ALB with two targets, or latency will cliff.',
    duration: 14,
    rpsMul: 2.4,
    cacheMul: 1,
  },
  neighbor: {
    title: 'Noisy neighbor',
    detail: 'One instance just lost ~45% capacity. This is why you never run a single EC2.',
    duration: 16,
    rpsMul: 1,
    cacheMul: 1,
  },
  poison: {
    title: 'Poison packets',
    detail: 'A burst of crafted malicious requests. About 1 in 10 sneak a healthy WAF. CloudFront catches a slice of those; a saturated WAF fails open entirely.',
    duration: 11,
    rpsMul: 1.6,
    cacheMul: 1,
    mix: {
      static: 0.12,
      read: 0.16,
      write: 0.08,
      upload: 0.04,
      search: 0.04,
      malicious: 0.5,
      ddos: 0.06,
    },
  },
  lull: {
    title: 'Traffic lull',
    detail: 'Users went quiet. Idle boxes still invoice. This is why you do not buy ten EC2s on day one.',
    duration: 18,
    rpsMul: 0.42,
    cacheMul: 1,
  },
};

/** Production waits this long so a starter path can earn before the first shock. */
export const LIVE_FIRST_EVENT = 50;

export function eventOrder(elapsed: number, live = false): EventType {
  const cycle: EventType[] = live
    ? ['spike', 'lull', 'ddos', 'flash', 'lull', 'stampede', 'poison', 'neighbor']
    : ['spike', 'ddos', 'flash', 'stampede', 'poison', 'neighbor'];
  // Live used to fire at t=22, which skipped spike (index 1 = lull). Offset so the first live event is spike.
  const i = live
    ? Math.max(0, Math.floor((elapsed - LIVE_FIRST_EVENT) / 18))
    : Math.floor(elapsed / 18);
  return cycle[i % cycle.length];
}

export function makeEvent(
  type: EventType,
  degradeNodeId: string | null,
): ActiveEvent {
  const c = EVENT_COPY[type];
  return {
    type,
    title: c.title,
    detail: c.detail,
    remaining: c.duration,
    duration: c.duration,
    rpsMul: c.rpsMul,
    mix: c.mix,
    cacheMul: c.cacheMul,
    degradeNodeId,
  };
}
