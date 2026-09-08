import { CATALOG } from '../data/catalog';
import { MISSIONS } from '../data/missions';
import { useGame } from '../store/gameStore';

export function Briefing() {
  const index = useGame((s) => s.missionIndex);
  const beginPlay = useGame((s) => s.beginPlay);
  const setScreen = useGame((s) => s.setScreen);
  const m = MISSIONS[index];
  if (!m) return null;

  return (
    <div className="screen">
      <button type="button" className="btn btn-ghost" onClick={() => setScreen('missions')}>
        ← Missions
      </button>
      <div className="kicker" style={{ marginTop: 18 }}>
        {m.kicker}
      </div>
      <h1>{m.title}</h1>
      <div className="brief-grid">
        <div>
          <p>{m.briefing}</p>
          <p>
            <strong style={{ color: 'var(--text)' }}>Stakes. </strong>
            {m.stakes}
          </p>
          <p>
            <strong style={{ color: 'var(--amber)' }}>Hint. </strong>
            {m.hint}
          </p>
          <div className="cta-row">
            <button type="button" className="btn btn-primary" onClick={beginPlay}>
              Open console
            </button>
          </div>
        </div>
        <div className="panel">
          <h3>Objectives</h3>
          <ul className="obj-list">
            {m.objectives.map((o) => (
              <li key={o.id}>○ {o.label}</li>
            ))}
          </ul>
          <h3 style={{ marginTop: 16 }}>Recommended</h3>
          <div>
            {m.recommended.map((id) => (
              <span className="chip" key={id}>
                {CATALOG[id].name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
