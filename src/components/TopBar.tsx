import { MISSIONS } from '../data/missions';
import { clock, money, pct, rps } from '../lib/format';
import { currentRps } from '../sim/engine';
import { burnPerMin, sla } from '../sim/score';
import { persistGame, useGame } from '../store/gameStore';

export function TopBar() {
  const state = useGame();
  const s = sla(state);
  const burn = burnPerMin(state);
  const series = state.moneySeries;
  const net =
    series.length >= 2 ? (series[series.length - 1] - series[series.length - 2]) / 0.5 : 0;
  const incoming = Object.values(state.runtime).reduce((a, n) => a + (n.emaRps || 0), 0);
  const inet = state.runtime['n_internet']?.emaRps ?? incoming;
  const mission = state.mode === 'mission' ? MISSIONS[state.missionIndex] : null;
  const modeLabel =
    mission ? mission.title : state.mode === 'live' ? (state.liveStarted ? 'Production' : 'Staging') : 'Sandbox';
  const target = currentRps(state);
  const netCls = net >= 0 ? 'up' : 'down';
  const slaCls = s >= 95 ? 'up' : s >= 80 ? 'warn' : 'down';

  return (
    <header className="topbar">
      <div className="top-brand">
        <div className="mark">A</div>
        Archway
        <small>{modeLabel}</small>
      </div>
      <div className="meters">
        <div className="meter">
          <span className="lbl">Ledger</span>
          <span className={`val ${state.money < 1500 ? 'down' : ''}`}>{money(state.money)}</span>
        </div>
        <div className="meter">
          <span className="lbl">Net / sec</span>
          <span className={`val ${netCls}`}>
            {net >= 0 ? '+' : ''}
            {money(net, 1)}
          </span>
        </div>
        <div className="meter">
          <span className="lbl">Burn / min</span>
          <span className="val">{money(burn, 1)}</span>
        </div>
        <div className="meter">
          <span className="lbl">SLA</span>
          <span className={`val ${slaCls}`}>{pct(s)}</span>
        </div>
        <div className="meter">
          <span className="lbl">Ingress</span>
          <span className="val">
            {rps(state.mode === 'live' && !state.liveStarted ? 0 : inet)}
            {state.mode === 'live' && state.liveStarted ? ` / ${rps(target)}` : ''} rps
          </span>
        </div>
        <div className="meter">
          <span className="lbl">Sim time</span>
          <span className="val">{clock(state.simTime)}</span>
        </div>
        <div className={`event-pill ${state.event ? (state.event.type === 'ddos' || state.event.type === 'poison' ? 'hot' : 'warn') : ''}`}>
          {state.event
            ? `Now · ${state.event.title} · ${Math.ceil(state.event.remaining)}s`
            : 'Quiet'}
        </div>
      </div>
      <div className="controls">
        {!(state.mode === 'live' && state.liveStarted) && (
          <button
            type="button"
            className={`icon-btn ${state.speed === 0 ? 'active' : ''}`}
            onClick={() => state.setSpeed(state.speed === 0 ? 1 : 0)}
            title="Space — pause"
          >
            {state.speed === 0 ? '▶' : '⏸'}
          </button>
        )}
        {state.mode === 'live' && state.liveStarted && (
          <span className="event-pill hot" title="Production cannot pause">
            PROD
          </span>
        )}
        {([1, 2, 4] as const).map((sp) => (
          <button
            key={sp}
            type="button"
            className={`icon-btn ${state.speed === sp ? 'active' : ''}`}
            onClick={() => state.setSpeed(sp)}
            disabled={state.mode === 'live' && !state.liveStarted}
          >
            {sp}×
          </button>
        ))}
        <button
          type="button"
          className="icon-btn"
          title="Home"
          onClick={() => {
            persistGame(useGame.getState());
            state.resetToTitle();
          }}
        >
          ⌂
        </button>
      </div>
    </header>
  );
}
