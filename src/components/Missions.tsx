import { CORE_MISSION_COUNT, isMissionLocked, MISSIONS } from '../data/missions';
import { useGame } from '../store/gameStore';
import type { Mission } from '../types';

function MissionCard({ m, index }: { m: Mission; index: number }) {
  const completed = useGame((s) => s.completed);
  const startMission = useGame((s) => s.startMission);
  const locked = isMissionLocked(index, completed);
  const done = completed.includes(m.id);

  return (
    <button
      type="button"
      className={`mission-card ${locked ? 'locked' : ''}`}
      disabled={locked}
      onClick={() => !locked && startMission(index)}
    >
      <span className="kicker">
        {m.kicker}
        {done && <span className="done-pill">Cleared</span>}
      </span>
      <h3>{m.title}</h3>
      <p>{m.stakes}</p>
    </button>
  );
}

export function Missions() {
  const setScreen = useGame((s) => s.setScreen);
  const core = MISSIONS.slice(0, CORE_MISSION_COUNT);
  const store = MISSIONS.slice(CORE_MISSION_COUNT);

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
        {core.map((m, i) => (
          <MissionCard key={m.id} m={m} index={i} />
        ))}
      </div>

      <section className="mission-track">
        <div className="kicker">Storefront</div>
        <h2>Now design the shop.</h2>
        <p className="screen-narrow">
          E-commerce is the same primitives under a real product. One lesson each: catalog at the
          edge, search off the SQL, checkout accepted not finished, then a flash sale. This track
          is separate from the eight — every shop mission is open.
        </p>
        <div className="shop-tease" aria-hidden="true">
          <div>
            <b>01</b>
            Catalog
            <small>CloudFront + S3</small>
          </div>
          <span>→</span>
          <div>
            <b>02</b>
            Search
            <small>cache, not LIKE</small>
          </div>
          <span>→</span>
          <div>
            <b>03</b>
            Checkout
            <small>SQS 202</small>
          </div>
          <span>→</span>
          <div>
            <b>04</b>
            Flash sale
            <small>hold the ledger</small>
          </div>
        </div>
        <div className="mission-grid">
          {store.map((m, i) => (
            <MissionCard key={m.id} m={m} index={CORE_MISSION_COUNT + i} />
          ))}
        </div>
      </section>
    </div>
  );
}
