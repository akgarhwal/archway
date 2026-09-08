import { CATALOG, SIZE_LABEL, UPGRADE_COST } from '../data/catalog';
import { money, pct, rps } from '../lib/format';
import { capacityRps, opexPerMin, saleRefund } from '../sim/engine';
import { wellArchitected } from '../sim/score';
import { useGame } from '../store/gameStore';

const PILLAR_LABEL: Record<string, string> = {
  operational: 'Ops',
  security: 'Security',
  reliability: 'Reliability',
  performance: 'Perf',
  cost: 'Cost',
  sustainability: 'Sustain',
};

export function Inspector() {
  const state = useGame();
  const node = state.nodes.find((n) => n.id === state.selectedId);
  const edge = state.edges.find((e) => e.id === state.selectedId);
  const wa = wellArchitected(state);
  const coach = state.coach;

  return (
    <aside className="inspector">
      <div className="side-h">Inspector</div>
      {coach && (
        <div className="coach">
          <h3>Architect coach — {coach.title}</h3>
          <p>{coach.body}</p>
          <p className="lesson">{coach.lesson}</p>
          <button type="button" className="btn" onClick={() => state.dismissCoach()}>
            Got it
          </button>
        </div>
      )}
      <div className="body">
        {node ? (
          <NodeInspect />
        ) : edge ? (
          <div className="empty-insp">
            <strong>Edge selected.</strong> Packets only travel wires you draw. Parallel edges from
            Internet split traffic — a naked origin beside a WAF is a bypass.
            <div className="row-btns">
              <button type="button" className="btn" onClick={() => state.remove()}>
                Delete wire
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-insp">
            Select a component to upgrade, delete, or read why it exists. Click a catalog card, then
            click the canvas to place. Drag a handle to wire the request path.
          </div>
        )}

        <div className="wa">
          <div className="wa-head">
            <span className="lbl" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 11, color: 'var(--faint)' }}>
              Well-Architected
            </span>
            <b>{wa.total}</b>
          </div>
          {Object.entries(wa.pillars).map(([k, v]) => (
            <div className="pillar" key={k}>
              <span>{PILLAR_LABEL[k] ?? k}</span>
              <div className="track">
                <i style={{ width: `${v}%` }} />
              </div>
              <span className="mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function NodeInspect() {
  const state = useGame();
  const node = state.nodes.find((n) => n.id === state.selectedId);
  if (!node) return null;
  const def = CATALOG[node.service];
  const rt = state.runtime[node.id];
  const isNet = node.service === 'internet';
  const utilPct = (rt?.utilization ?? 0) * 100;
  const errUpgrade = () => {
    const e = state.upgrade();
    if (e && e !== 'Nothing selected') {
      /* keep silent — button disabled when broke */
    }
  };

  return (
    <>
      <div className="insp-title">
        <div>
          <h2>{def.name}</h2>
          <p>{def.aws}</p>
        </div>
      </div>
      <div className="stat-grid">
        {isNet ? (
          <>
            <div className="stat">
              <div className="lbl">Ingress</div>
              <div className="val">{rps(rt?.emaRps ?? 0)} rps</div>
            </div>
            <div className="stat">
              <div className="lbl">Served</div>
              <div className="val">{state.metrics.servedTotal}</div>
            </div>
            <div className="stat">
              <div className="lbl">Blocked</div>
              <div className="val">{state.metrics.blocked}</div>
            </div>
            <div className="stat">
              <div className="lbl">Failed</div>
              <div className="val">{state.metrics.failed}</div>
            </div>
          </>
        ) : (
          <>
            <div className="stat">
              <div className="lbl">Utilization</div>
              <div className="val">{pct(utilPct, utilPct < 10 ? 1 : 0)}</div>
            </div>
            <div className="stat">
              <div className="lbl">RPS / cap</div>
              <div className="val">
                {rps(rt?.emaRps ?? 0)} / {capacityRps(node).toFixed(0)}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">Latency</div>
              <div className="val">{(rt?.latency ?? def.latency).toFixed(0)} ms</div>
            </div>
            <div className="stat">
              <div className="lbl">Opex</div>
              <div className="val">{money(opexPerMin(node), 1)}/min</div>
            </div>
            <div className="stat">
              <div className="lbl">Processed</div>
              <div className="val">{rt?.processed ?? 0}</div>
            </div>
            <div className="stat">
              <div className="lbl">Dropped</div>
              <div className="val">{rt?.dropped ?? 0}</div>
            </div>
          </>
        )}
        {(def.id === 'cache' || def.id === 'cloudfront') && (
          <>
            <div className="stat">
              <div className="lbl">Hits</div>
              <div className="val">{rt?.hits ?? 0}</div>
            </div>
            <div className="stat">
              <div className="lbl">Misses</div>
              <div className="val">{rt?.misses ?? 0}</div>
            </div>
          </>
        )}
        {def.id === 'sqs' && (
          <div className="stat">
            <div className="lbl">Queue depth</div>
            <div className="val">{Math.round(rt?.queueDepth ?? 0)}</div>
          </div>
        )}
        {def.upgradable && (
          <div className="stat">
            <div className="lbl">Size</div>
            <div className="val">{SIZE_LABEL[node.size]}</div>
          </div>
        )}
      </div>
      <p className="copy">
        <strong>What it is. </strong>
        {def.blurb}
      </p>
      <p className="copy">
        <strong>When you use it. </strong>
        {def.when}
      </p>
      <div className="row-btns">
        {def.upgradable && node.size < 3 && (
          <button type="button" className="btn btn-primary" onClick={errUpgrade}>
            Upgrade {SIZE_LABEL[node.size + 1]} · {money(UPGRADE_COST[node.size + 1])}
          </button>
        )}
        {node.service !== 'internet' && (
          <button type="button" className="btn" onClick={() => state.remove()}>
            Sell 50% · {money(saleRefund(node))}
          </button>
        )}
      </div>
      <Wires nodeId={node.id} />
    </>
  );
}

function Wires({ nodeId }: { nodeId: string }) {
  const state = useGame();
  const outs = state.edges.filter((e) => e.source === nodeId);
  const ins = state.edges.filter((e) => e.target === nodeId);
  if (!outs.length && !ins.length) {
    return <p className="copy">No wires yet. Drag a handle to connect.</p>;
  }
  const name = (id: string) => {
    const n = state.nodes.find((x) => x.id === id);
    return n ? CATALOG[n.service].short : id;
  };
  return (
    <div className="wire-list">
      <div className="lbl" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11, color: 'var(--faint)', margin: '12px 0 6px' }}>
        Connections
      </div>
      {ins.map((e) => (
        <div className="wire-row" key={e.id}>
          <span>
            ← {name(e.source)}
          </span>
          <button type="button" className="btn" onClick={() => state.disconnect(e.id)}>
            Disconnect
          </button>
        </div>
      ))}
      {outs.map((e) => (
        <div className="wire-row" key={e.id}>
          <span>
            → {name(e.target)}
          </span>
          <button type="button" className="btn" onClick={() => state.disconnect(e.id)}>
            Disconnect
          </button>
        </div>
      ))}
    </div>
  );
}
