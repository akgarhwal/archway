import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { count, money } from '../lib/format';
import { requestTally } from '../sim/score';
import { useGame } from '../store/gameStore';

function cash(n: number, signed = false) {
  const digits = Math.abs(n) < 100 ? 1 : 0;
  const body = money(n, digits);
  if (signed && n > 0) return `+${body}`;
  return body;
}

type Meter = {
  lbl: string;
  val: string;
  cls: string;
  blurb: string;
  hint: string;
};

const TIP_W = 248;
const TIP_GAP = 8;

function MeterTip({ it, className }: { it: Meter; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, r.right > vw * 0.62 ? r.right - TIP_W : r.left), vw - TIP_W - 8);
    const below = r.bottom + TIP_GAP;
    const top = vh - below < 150 ? Math.max(8, r.top - TIP_GAP - 132) : below;
    setPos({ top, left });
  };

  return (
    <div
      ref={ref}
      className={className}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
    >
      <span className="lbl">{it.lbl}</span>
      <span className={`val ${it.cls}`}>{it.val}</span>
      {pos &&
        createPortal(
          <div className="tip tip-float" role="tooltip" style={{ top: pos.top, left: pos.left }}>
            <b>{it.lbl}</b>
            <p>{it.blurb}</p>
            <small>{it.hint}</small>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function TrafficBill({ layout }: { layout: 'bar' | 'grid' }) {
  const metrics = useGame((s) => s.metrics);
  const t = requestTally(metrics);
  const items: Meter[] = [
    {
      lbl: 'Seen',
      val: count(t.seen),
      cls: '',
      blurb: 'Every packet that arrived on Users — customers, bots, and floods. This is raw ingress, not a score.',
      hint: 'Served + Blocked + Failed should sit close to this number.',
    },
    {
      lbl: 'Served',
      val: count(t.served),
      cls: 'up',
      blurb: 'Successful responses (200 / 202). CDN hits, cache hits, and origin 200s all count. This is how you get paid.',
      hint: 'Green and climbing is the happy path.',
    },
    {
      lbl: 'Blocked',
      val: count(t.blocked),
      cls: t.blocked ? 'warn' : '',
      blurb: 'Attacks stopped at Shield, WAF, or CloudFront. A 403 is a win — cheaper than a breach or an origin bill.',
      hint: 'Amber is good. Compare to Attacks: you want Blocked to catch most of them.',
    },
    {
      lbl: 'Failed',
      val: count(t.failed),
      cls: t.failed ? 'down' : '',
      blurb: 'Legitimate customers you dropped — saturated box, missing hop, or no route. Each one is a refund.',
      hint: 'Keep this near zero. This is what kills SLA.',
    },
    {
      lbl: 'Attacks',
      val: count(t.bad),
      cls: t.bad ? 'down' : '',
      blurb: 'Malicious + DDoS packets that hit the wire, whether you stopped them or not.',
      hint: 'If Attacks is high and Blocked is not, origin is paying for garbage. Fix the edge, not more EC2.',
    },
    {
      lbl: 'Earned',
      val: cash(t.earned),
      cls: 'up',
      blurb: 'Cash from served requests, plus a few cents for a clean block. Same rates in missions, sandbox, and Production.',
      hint: 'Ramps with traffic. Opening minutes look small on purpose.',
    },
    {
      lbl: 'Spent',
      val: cash(t.spent),
      cls: 'down',
      blurb: 'Money that left the wallet: buying boxes, per-minute rent, and fail penalties. Selling a box credits 50% back.',
      hint: 'Capex dominates early. $2k spent against $30 earned is normal right after you buy the path.',
    },
    {
      lbl: 'Net',
      val: cash(t.net, true),
      cls: t.net >= 0 ? 'up' : 'down',
      blurb: 'Earned minus Spent this session. Red at the start means you just bought infrastructure, not that you are bankrupt.',
      hint: 'You lose only if Ledger (top bar) stays below $0 for 6 seconds. Watch that, not this.',
    },
  ];

  if (layout === 'bar') {
    return (
      <div className="tally" role="status" aria-label="Traffic and bill. Hover a meter for what it means.">
        <div className="tally-group">
          {items.slice(0, 5).map((it) => (
            <MeterTip key={it.lbl} it={it} className="tally-item" />
          ))}
        </div>
        <div className="tally-group">
          {items.slice(5).map((it) => (
            <MeterTip key={it.lbl} it={it} className="tally-item" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stat-grid">
      {items.map((it) => (
        <MeterTip key={it.lbl} it={it} className="stat has-tip" />
      ))}
    </div>
  );
}
