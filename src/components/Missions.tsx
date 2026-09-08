import { MISSIONS } from '../data/missions';
import { useGame } from '../store/gameStore';

export function Missions() {
  const completed = useGame((s) => s.completed);
  const startMission = useGame((s) => s.startMission);
  const setScreen = useGame((s) => s.setScreen);

  return (
    <div className="screen">
      <button type="button" className="btn btn-ghost" onClick={() => setScreen('title')}>
        ← Home
      </button>
      <div className="kicker" style={{ marginTop: 18 }}>
        Curriculum
      </div>
      <h1>Eight systems, one bill.</h1>
      <p className="screen-narrow">
        Each mission isolates a high-level design idea, then the last one puts them on the same
        wire. Missions unlock in order. Sandbox is always available from the title screen.
      </p>
      <div className="mission-grid">
        {MISSIONS.map((m, i) => {
          const locked = i > 0 && !completed.includes(MISSIONS[i - 1].id);
          const done = completed.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`mission-card ${locked ? 'locked' : ''}`}
              disabled={locked}
              onClick={() => !locked && startMission(i)}
            >
              <span className="kicker">
                {m.kicker}
                {done && <span className="done-pill">Cleared</span>}
              </span>
              <h3>{m.title}</h3>
              <p>{m.stakes}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
