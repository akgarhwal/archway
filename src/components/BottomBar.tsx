import { KIND_META } from '../data/catalog';
import { evaluateObjectives } from '../sim/engine';
import { moneyDelta } from '../lib/format';
import { useGame } from '../store/gameStore';

export function BottomBar() {
  const state = useGame();
  const objs = evaluateObjectives(state);

  return (
    <footer className="logbar">
      <div className="obj-pane">
        <h4>
          {state.mode === 'sandbox' ? 'Sandbox' : state.mode === 'live' ? 'Production' : 'Objectives'}
        </h4>
        {state.mode === 'sandbox' ? (
          <p className="copy" style={{ margin: 0 }}>
            No fail state. Bankruptcy and SLA still hurt the ledger — they just don’t end the session.
            Build anything. Break it on purpose.
          </p>
        ) : state.mode === 'live' ? (
          <p className="copy" style={{ margin: 0 }}>
            {state.liveStarted
              ? 'Traffic breathes. You cannot pause. Keep adding capacity on the path that is actually failing — not more EC2 in front of a missing WAF.'
              : 'Staging. Wire a production path, then Go live. After that you cannot pause until the bill or the SLA does.'}
          </p>
        ) : (
          objs.map((o) => (
            <div key={o.id} className={`check ${o.done ? 'done' : ''}`}>
              <span className="box">{o.done ? '✓' : ''}</span>
              {o.label}
            </div>
          ))
        )}
      </div>
      <div className="log-pane">
        <h4>Request X-Ray</h4>
        {state.log.length === 0 && (
          <div className="copy">Waiting for packets. Serve, block, or drop — the path is the lesson.</div>
        )}
        {state.log.map((l) => (
          <div key={l.id} className={`log-line ${l.status}`}>
            <span>{l.t.toFixed(1)}s</span>
            <span className="kind-tag">{KIND_META[l.kind].label}</span>
            <span>{l.status}</span>
            <span title={l.reason}>{l.path || l.reason}</span>
            <span>{moneyDelta(l.money)}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
