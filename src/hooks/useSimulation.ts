import { useEffect } from 'react';
import { persistGame, useGame } from '../store/gameStore';

export function useSimulation() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let saveAcc = 0;

    const loop = (now: number) => {
      const raw = Math.min(0.12, (now - last) / 1000);
      last = now;
      const state = useGame.getState();
      if (state.screen === 'play' && state.speed > 0) {
        acc += raw * state.speed;
        while (acc >= 0.1) {
          acc -= 0.1;
          useGame.getState().tick(0.1);
        }
      }
      saveAcc += raw;
      if (saveAcc > 4) {
        saveAcc = 0;
        persistGame(useGame.getState());
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const g = useGame.getState();
      if (e.code === 'Space' && g.screen === 'play') {
        e.preventDefault();
        if (g.mode === 'live' && g.liveStarted) return;
        if (g.mode === 'live' && !g.liveStarted) return;
        g.setSpeed(g.speed === 0 ? 1 : 0);
      }
      if (e.key === '1') g.setSpeed(1);
      if (e.key === '2') g.setSpeed(2);
      if (e.key === '4') g.setSpeed(4);
      if (e.key === 'Escape') {
        if (g.placing) g.setPlacing(null);
        else g.select(null);
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && g.selectedId) {
        e.preventDefault();
        g.remove();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
