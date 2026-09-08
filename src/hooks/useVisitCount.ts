import { useEffect, useState } from 'react';

const NS = 'akgarhwal-archway';
const KEY = 'visits';
const BASE = 'https://abacus.jasoncameron.dev';
const SESSION = 'archway-visit-hit';

let pending: Promise<number | null> | null = null;

function isLocalHost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

async function loadVisitCount(): Promise<number | null> {
  const local = isLocalHost();
  const already = sessionStorage.getItem(SESSION) === '1';
  const path = local || already ? 'get' : 'hit';
  try {
    const res = await fetch(`${BASE}/${path}/${NS}/${KEY}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const n = Number((data as { value?: unknown }).value);
    if (!Number.isFinite(n)) return null;
    if (!local) sessionStorage.setItem(SESSION, '1');
    return Math.max(0, Math.round(n));
  } catch {
    return null;
  }
}

function fetchVisitCount(): Promise<number | null> {
  if (!pending) pending = loadVisitCount();
  return pending;
}

/** Global visit count. Increments once per browser tab session; skipped on localhost. */
export function useVisitCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchVisitCount().then((n) => {
      if (!cancelled && n != null) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}
