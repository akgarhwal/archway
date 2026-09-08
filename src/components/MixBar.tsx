import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KIND_COLOR, KIND_META } from '../data/catalog';
import { money } from '../lib/format';
import { currentMix } from '../sim/engine';
import { mixFocus } from '../sim/mixFocus';
import { useGame } from '../store/gameStore';
import { KINDS, LEGIT, type RequestKind } from '../types';

const TIP_W = 248;
const TIP_GAP = 8;
const LABEL_MIN = 0.09;

function MixSeg({ kind, share }: { kind: RequestKind; share: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const meta = KIND_META[kind];
  const pct = Math.round(share * 100);
  const silent = share < 0.005;

  const show = () => {
    const el = ref.current;
    if (!el || silent) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, r.right > vw * 0.62 ? r.right - TIP_W : r.left), vw - TIP_W - 8);
    const below = r.bottom + TIP_GAP;
    const top = vh - below < 150 ? Math.max(8, r.top - TIP_GAP - 132) : below;
    setPos({ top, left });
  };

  const earn = KIND_META[kind].earn;
  const pay = LEGIT.includes(kind) ? 'Served' : 'Blocked';

  return (
    <div
      ref={ref}
      className={`mix-seg${silent ? ' silent' : ''}`}
      style={{ flexGrow: share, flexBasis: 0, background: KIND_COLOR[kind] }}
      tabIndex={silent ? -1 : 0}
      aria-hidden={silent}
      aria-label={silent ? undefined : `${meta.label} ${pct}%`}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
    >
      {share >= LABEL_MIN && (
        <span>
          {meta.label} {pct}%
        </span>
      )}
      {pos &&
        createPortal(
          <div className="tip tip-float" role="tooltip" style={{ top: pos.top, left: pos.left }}>
            <b>
              {meta.label} · {pct}%
            </b>
            <p>{meta.hint}</p>
            <small>
              {pay} {money(earn, 2)} each · {pct}% of ingress
            </small>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MixBar() {
  const mode = useGame((s) => s.mode);
  const missionIndex = useGame((s) => s.missionIndex);
  const event = useGame((s) => s.event);
  const mix = currentMix({ mode, missionIndex, event });
  const focus = mixFocus(mix, event?.type ?? null);
  const eventMix = event?.mix;

  return (
    <div className="mixbar" role="region" aria-label="Request mix">
      <div className="mixbar-row">
        <span className="lbl">Mix</span>
        <div className={`mixbar-track${eventMix ? ' event' : ''}`}>
          {KINDS.map((k) => (
            <MixSeg key={k} kind={k} share={mix[k]} />
          ))}
        </div>
        {eventMix && event ? <span className="mixbar-flag">{event.title}</span> : null}
      </div>
      <p className="mixbar-focus">{focus}</p>
    </div>
  );
}
