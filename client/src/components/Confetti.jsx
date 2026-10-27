import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#ff4d6d', '#3b82f6', '#ffc233', '#22c55e', '#ff5fb2', '#a67df0'];

export default function Confetti({ count = 90 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 2.5, dur: 3.5 + Math.random() * 3,
    size: 6 + Math.random() * 8, rot: Math.random() * 720 - 360, color: COLORS[i % COLORS.length], round: Math.random() > 0.6, drift: Math.random() * 120 - 60,
  })), [count]);
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span key={p.id} className="absolute block" style={{ left: `${p.x}%`, top: -20, width: p.size, height: p.size * (p.round ? 1 : 1.6), background: p.color, borderRadius: p.round ? '50%' : 2 }}
          initial={{ y: -30, opacity: 1, rotate: 0 }} animate={{ y: '110vh', x: p.drift, rotate: p.rot, opacity: [1, 1, 0.9] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'linear' }} />
      ))}
    </div>
  );
}
