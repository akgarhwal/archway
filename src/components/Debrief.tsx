import { MISSIONS, nextMissionInTrack } from '../data/missions';
import { quoteForEnd } from '../data/quotes';
import { clock, money, pct } from '../lib/format';
import { sla, wellArchitected } from '../sim/score';
import { persistGame, useGame } from '../store/gameStore';
import { TrafficBill } from './TrafficBill';

export function Debrief() {
  const state = useGame();
  const m = state.mode === 'mission' ? MISSIONS[state.missionIndex] : null;
  const s = sla(state);
  const wa = wellArchitected(state);
  const next = state.mode === 'mission' ? nextMissionInTrack(state.missionIndex) : null;
  const hasNext = next != null;

  const tips = debriefTips(state.won, state.loseReason, wa.total, s);
  const end = quoteForEnd(state.won, state.loseReason, state.seed, state.simTime);

  return (
    <div className="screen">
      <div className="debrief-hero screen-narrow">
        <div>
          <div className="kicker">{state.won ? 'Architecture held' : 'Incident review'}</div>
          <h1>
            {state.won
              ? m?.title ?? 'Sandbox'
              : state.mode === 'live'
                ? 'Taken offline'
                : 'The system blinked'}
          </h1>
          <p>
            {state.won
              ? m?.win
              : state.loseReason ?? 'You left the console. The bill did not.'}
          </p>
        </div>
        <div className="big-num">{wa.total}</div>
      </div>
      <div className="brief-grid screen-narrow" style={{ marginTop: 8 }}>
        <div className="panel">
          <h3>Scoreboard</h3>
          <div className="stat-grid">
            <div className="stat">
              <div className="lbl">Ledger</div>
              <div className="val">{money(state.money)}</div>
            </div>
            <div className="stat">
              <div className="lbl">SLA</div>
              <div className="val">{pct(s)}</div>
            </div>
            <div className="stat">
              <div className="lbl">Breaches</div>
              <div className="val">{state.metrics.breaches}</div>
            </div>
            <div className="stat">
              <div className="lbl">CDN hits</div>
              <div className="val">{state.metrics.cdnHits}</div>
            </div>
            {state.mode === 'live' && (
              <>
                <div className="stat">
                  <div className="lbl">Survived</div>
                  <div className="val">{clock(state.simTime)}</div>
                </div>
                <div className="stat">
                  <div className="lbl">Peak ledger</div>
                  <div className="val">{money(state.peakMoney)}</div>
                </div>
              </>
            )}
          </div>
          <h3 style={{ marginTop: 16 }}>Traffic and bill</h3>
          <TrafficBill layout="grid" />
          <div className="cta-row">
            {state.won && hasNext && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (next != null) state.startMission(next);
                }}
              >
                Next mission
              </button>
            )}
            {!state.won && state.mode === 'mission' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => state.startMission(state.missionIndex)}
              >
                Retry
              </button>
            )}
            {state.mode === 'live' && (
              <button type="button" className="btn btn-primary" onClick={() => state.startLive()}>
                Run production again
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                persistGame(state);
                state.resetToTitle();
              }}
            >
              Home
            </button>
          </div>
        </div>
        <div className="panel">
          <h3>What a senior would say</h3>
          <ul className="tips">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <figure className={`hourly-quote end-quote ${state.won ? 'win' : 'loss'}`}>
            <span className="kicker">{state.won ? 'Takeaway' : 'Postmortem'}</span>
            <blockquote>“{end.quote.text}”</blockquote>
            <figcaption>
              — {end.quote.author}
              {end.quote.note ? <em> · {end.quote.note}</em> : null}
            </figcaption>
            <p className="end-quote-kick">{end.kick}</p>
          </figure>
        </div>
      </div>
    </div>
  );
}

function debriefTips(won: boolean, lose: string | null, wa: number, s: number): string[] {
  const out: string[] = [];
  if (lose?.includes('Bankrupt')) {
    out.push('Right-size. A fortress that never sees traffic is just a very expensive idle loop.');
  }
  if (lose?.includes('SLA')) {
    out.push('Headroom lives below 80% utilization. Past that, latency is not linear — it cliffs.');
  }
  if (s < 95) out.push('Failed legitimate requests are refunds. Protect the happy path before you decorate the diagram.');
  if (wa < 70) {
    out.push('Well-Architected is a path: edge security, two compute targets, cache/CDN offload, a queue for writes, something watching.');
  }
  out.push('WAF inspects. ALB spreads. They are not interchangeable.');
  out.push('DDoS is absorbed at Shield/CloudFront, not paid for on Lambda.');
  out.push('Never wire a database to the Internet node. That drawing is the breach.');
  if (won) out.push('You felt the pattern instead of memorizing it. That is the interview.');
  return out.slice(0, 5);
}
