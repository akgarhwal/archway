import { create } from 'zustand';
import {
  connectNodes,
  createInitialState,
  deleteSelection,
  disconnectEdge,
  goLive,
  moveNode,
  placeNode,
  simulate,
  titleState,
  upgradeNode,
} from '../sim/engine';
import type { GameState, ServiceId } from '../types';

const SAVE_KEY = 'buildsystem-save-v1';
const PROGRESS_KEY = 'buildsystem-progress-v1';

function loadProgress(): string[] {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as { completed?: string[] };
    return p.completed ?? [];
  } catch {
    return [];
  }
}

function saveProgress(completed: string[]) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ completed }));
}

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (!s || !s.nodes) return null;
    s.packets = [];
    s.placing = null;
    s.liveStarted = s.liveStarted ?? s.mode !== 'live';
    s.peakMoney = s.peakMoney ?? s.money;
    s.slaFailFor = s.slaFailFor ?? 0;
    if (s.metrics) {
      if (typeof s.metrics.seenTotal !== 'number') {
        s.metrics.seenTotal = (s.metrics.servedTotal ?? 0) + (s.metrics.blocked ?? 0) + (s.metrics.failed ?? 0);
      }
      if (!s.metrics.seen) {
        s.metrics.seen = {
          static: 0,
          read: 0,
          write: 0,
          upload: 0,
          search: 0,
          malicious: 0,
          ddos: 0,
        };
      }
    }
    return s;
  } catch {
    return null;
  }
}

export function persistGame(s: GameState) {
  if (s.screen === 'title' || s.screen === 'how' || s.screen === 'missions') return;
  const blob = { ...s, packets: [], placing: null, toasts: [] };
  localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  saveProgress(s.completed);
}

export function hasSave(): boolean {
  return !!localStorage.getItem(SAVE_KEY);
}

interface Actions {
  tick: (dt: number) => void;
  setScreen: (screen: GameState['screen']) => void;
  startMission: (index: number) => void;
  beginPlay: () => void;
  startSandbox: () => void;
  startLive: () => void;
  goLive: () => void;
  continueSave: () => void;
  setSpeed: (speed: GameState['speed']) => void;
  setPlacing: (id: ServiceId | null) => void;
  placeAt: (service: ServiceId, x: number, y: number) => string | null;
  connect: (source: string, target: string) => string | null;
  select: (id: string | null) => void;
  move: (id: string, x: number, y: number) => void;
  remove: () => void;
  disconnect: (id: string) => void;
  upgrade: () => string | null;
  dismissCoach: () => void;
  dismissToast: (id: string) => void;
  resetToTitle: () => void;
}

export const useGame = create<GameState & Actions>((set, get) => ({
  ...titleState(loadProgress()),

  tick: (dt) => {
    set((s) => simulate(s, dt));
  },

  setScreen: (screen) => set({ screen }),

  startMission: (index) => {
    const completed = get().completed;
    const s = createInitialState('mission', index);
    s.completed = completed;
    s.screen = 'briefing';
    s.speed = 0;
    set(s);
  },

  beginPlay: () => set({ screen: 'play', speed: 1 }),

  startSandbox: () => {
    const completed = get().completed;
    const s = createInitialState('sandbox', 0);
    s.completed = completed;
    s.screen = 'play';
    s.speed = 1;
    set(s);
  },

  startLive: () => {
    const completed = get().completed;
    const s = createInitialState('live', 0);
    s.completed = completed;
    s.screen = 'play';
    s.speed = 0;
    s.liveStarted = false;
    s.mode = 'live';
    set(s);
  },

  goLive: () => {
    const next = goLive(get());
    set({
      liveStarted: true,
      speed: 1,
      simTime: next.simTime,
      loseReason: null,
      won: false,
      coach: next.coach,
      seenCoach: next.seenCoach,
      toasts: next.toasts,
      mode: 'live',
      screen: 'play',
    });
  },

  continueSave: () => {
    const s = loadSave();
    if (!s) return;
    set({
      ...s,
      packets: [],
      placing: null,
      speed: s.screen === 'play' ? 1 : s.speed,
      completed: Array.from(new Set([...(s.completed ?? []), ...loadProgress()])),
    });
  },

  setSpeed: (speed) => {
    const s = get();
    if (s.mode === 'live' && !s.liveStarted) return;
    if (s.mode === 'live' && s.liveStarted && speed === 0) return;
    set({ speed });
  },

  setPlacing: (id) => set({ placing: id, selectedId: id ? null : get().selectedId }),

  placeAt: (service, x, y) => {
    const res = placeNode(get(), service, x, y);
    if ('error' in res) return res.error;
    set(res);
    return null;
  },

  connect: (source, target) => {
    const res = connectNodes(get(), source, target);
    if ('error' in res) return res.error;
    set(res);
    return null;
  },

  select: (id) => set({ selectedId: id, placing: null }),

  move: (id, x, y) => set(moveNode(get(), id, x, y)),

  remove: () => set(deleteSelection(get())),

  disconnect: (id) => set(disconnectEdge(get(), id)),

  upgrade: () => {
    const id = get().selectedId;
    if (!id) return 'Nothing selected';
    const res = upgradeNode(get(), id);
    if ('error' in res) return res.error;
    set(res);
    return null;
  },

  dismissCoach: () => set({ coach: null }),

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  resetToTitle: () => set(titleState(get().completed.length ? get().completed : loadProgress())),
}));
