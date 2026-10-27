import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket.js';

/** Maps server clock to local clock so countdowns agree across devices. */
export function useServerClock(state) {
  const offset = useRef(0);
  if (state?.serverNow) offset.current = state.serverNow - Date.now();
  return () => Date.now() + offset.current;
}

/** Remaining ms until `endsAt` (server time), ticking ~10x/s. Frozen when paused. */
export function useRemaining(state) {
  const now = useServerClock(state);
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(h);
  }, []);
  if (!state) return 0;
  if (state.paused) return state.remainingMs ?? 0;
  if (!state.endsAt) return 0;
  return Math.max(0, state.endsAt - now());
}

/** Subscribes to authoritative game state; `join` is called on every (re)connect to (re)attach. */
export function useGameConnection(join) {
  const [state, setState] = useState(null);
  const [conn, setConn] = useState('connecting'); // connecting | online | offline
  const [fatal, setFatal] = useState('');
  const joinRef = useRef(join);
  joinRef.current = join;

  useEffect(() => {
    const s = getSocket();
    const onState = (st) => setState(st);
    const onConnect = async () => {
      const res = await joinRef.current();
      if (res?.error) setFatal(res.error); else { setConn('online'); setFatal(''); }
    };
    const onDisc = () => setConn('offline');
    const onKicked = () => setFatal('KICKED');
    const onCounts = (c) => setState((st) => (st ? { ...st, playerCount: c.playerCount, answeredCount: c.answeredCount } : st));
    s.on('game:state', onState); s.on('connect', onConnect); s.on('disconnect', onDisc); s.on('player:kicked', onKicked); s.on('game:counts', onCounts);
    if (s.connected) onConnect(); else s.connect();
    return () => { s.off('game:state', onState); s.off('connect', onConnect); s.off('disconnect', onDisc); s.off('player:kicked', onKicked); s.off('game:counts', onCounts); };
  }, []);

  return { state, conn, fatal };
}
