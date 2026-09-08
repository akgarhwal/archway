import { useVisitCount } from '../hooks/useVisitCount';
import { count } from '../lib/format';
import { hasSave, useGame } from '../store/gameStore';

export function TitleScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const startSandbox = useGame((s) => s.startSandbox);
  const startLive = useGame((s) => s.startLive);
  const continueSave = useGame((s) => s.continueSave);
  const saved = hasSave();
  const visits = useVisitCount();

  return (
    <div className="title">
      <div className="title-left">
        <div className="brand-row">
          <div className="mark">A</div>
          Archway · high-level design lab
        </div>
        <h1>
          Defend the
          <br />
          origin.
        </h1>
        <p className="lede">
          A frontend-only AWS-shaped tycoon for learning HLD. Legitimate requests are revenue.
          Idle infra is rent. Attacks that reach origin are a bill and a breach. Wire Route 53,
          Shield, WAF, CloudFront, ALB, compute, cache, data, queues — then watch packets choose
          a path.
        </p>
        <div className="cta-row">
          {saved && (
            <button type="button" className="btn btn-primary" onClick={continueSave}>
              Continue
            </button>
          )}
          <button
            type="button"
            className={saved ? 'btn' : 'btn btn-primary'}
            onClick={() => setScreen('missions')}
          >
            Missions
          </button>
          <button type="button" className="btn" onClick={startLive}>
            Production
          </button>
          <button type="button" className="btn" onClick={startSandbox}>
            Sandbox
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setScreen('how')}>
            How a request works
          </button>
        </div>
        <div className="kpi-row">
          <div className="kpi">
            <b>14</b>
            <span>AWS-named services</span>
          </div>
          <div className="kpi">
            <b>08</b>
            <span>curriculum missions</span>
          </div>
          <div className="kpi">
            <b>$7.2k</b>
            <span>starting grant</span>
          </div>
          <div className="kpi">
            <b>6</b>
            <span>Well-Architected pillars</span>
          </div>
        </div>
        {visits != null && (
          <p className="visit-meta">
            {count(visits)} visit{visits === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <div className="title-right">
        <div className="hero-card">
          <h3>Canonical request path</h3>
          <div className="pipe">
            {[
              ['Users', '#5ce1e6'],
              ['Route 53', '#8b7cf6'],
              ['Shield + WAF', '#ff6b6b'],
              ['CloudFront', '#c084fc'],
              ['ALB → EC2', '#f5a524'],
              ['Cache / RDS / S3 / SQS', '#62b2ff'],
            ].map(([name, color], i, arr) => (
              <div className="pipe-row" key={name}>
                <div className="pipe-node">
                  <i style={{ background: color }} />
                  {name}
                </div>
                {i < arr.length - 1 && <div className="pipe-arrow">↓</div>}
              </div>
            ))}
          </div>
          <p className="hero-note">
            A cache hit never touches RDS. A WAF drop never becomes a breach. A DDoS that lands on
            Lambda is a bill you wrote yourself. That is the whole game.
          </p>
        </div>
      </div>
    </div>
  );
}
