import { CATALOG, CATEGORY_ORDER } from '../data/catalog';
import { money } from '../lib/format';
import { useGame } from '../store/gameStore';
import type { ServiceId } from '../types';
import { ServiceIcon } from './icons';

export function Catalog() {
  const moneyNow = useGame((s) => s.money);
  const placing = useGame((s) => s.placing);
  const setPlacing = useGame((s) => s.setPlacing);

  return (
    <aside className="catalog">
      <div className="side-h">Service catalog</div>
      <div className="legend">
        <span><i className="pkt-static" style={{ background: '#7dd3fc' }} /> Static</span>
        <span><i style={{ background: '#86efac' }} /> Read</span>
        <span><i style={{ background: '#fbbf24' }} /> Write</span>
        <span><i style={{ background: '#fb7185' }} /> Attack</span>
        <span><i style={{ background: '#f43f5e' }} /> DDoS</span>
      </div>
      {CATEGORY_ORDER.map((g) => {
        const items = Object.values(CATALOG).filter((d) => d.placeable && d.category === g.id);
        return (
          <div className="cat-group" key={g.id}>
            <h4>{g.label}</h4>
            {items.map((d) => {
              const poor = moneyNow < d.capex;
              return (
                <button
                  key={d.id}
                  type="button"
                  draggable={!poor}
                  className={`cat-item ${placing === d.id ? 'active' : ''} ${poor ? 'poor' : ''}`}
                  onClick={() => setPlacing(placing === d.id ? null : (d.id as ServiceId))}
                  onDragStart={(e) => {
                    if (poor) return;
                    e.dataTransfer.setData('application/buildsystem', d.id);
                    e.dataTransfer.effectAllowed = 'copy';
                    setPlacing(d.id);
                  }}
                >
                  <div className="cat-ico" style={{ color: d.color }}>
                    <ServiceIcon id={d.id} />
                  </div>
                  <div>
                    <b>{d.name}</b>
                    <span>{d.rps ? `${d.rps} rps · ${money(d.opexPerMin, 1)}/min` : 'off path'}</span>
                  </div>
                  <em>{money(d.capex)}</em>
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
