import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import Confetti from './Confetti.jsx';
import { useI18n } from '../lib/i18n.jsx';

const SPOTS = {
  1: { h: 'h-56 sm:h-72', grad: 'from-yellow-300 to-amber-500', medal: '🥇', delay: 2.2, ring: 'ring-yellow-300' },
  2: { h: 'h-40 sm:h-52', grad: 'from-slate-200 to-slate-400', medal: '🥈', delay: 1.1, ring: 'ring-slate-300' },
  3: { h: 'h-28 sm:h-36', grad: 'from-orange-300 to-orange-600', medal: '🥉', delay: 0.2, ring: 'ring-orange-300' },
};

export default function Podium({ podium, youId }) {
  const { t } = useI18n();
  const byRank = (r) => podium.find((p) => p.rank === r) || podium[r - 1];
  // Visual order: 2nd, 1st, 3rd. Ties share a rank, so fall back to position.
  const order = [podium[1] && { p: podium[1], r: 2 }, podium[0] && { p: podium[0], r: 1 }, podium[2] && { p: podium[2], r: 3 }].filter(Boolean);
  const winner = podium[0];
  return (
    <div className="relative">
      <Confetti />
      {winner && (
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 3.2, type: 'spring', stiffness: 160 }} className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 text-lg font-extrabold uppercase tracking-widest text-sun"><Crown className="h-6 w-6" />{t('podium.winner')}</p>
          <p className="break-words font-display text-4xl sm:text-6xl">{winner.nickname}</p>
        </motion.div>
      )}
      <div className="mx-auto flex max-w-2xl items-end justify-center gap-2 sm:gap-4">
        {order.map(({ p, r }) => {
          const spot = SPOTS[r];
          return (
            <div key={p.id} className="flex w-1/3 flex-col items-center">
              <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: spot.delay + 0.7, type: 'spring' }} className="mb-2 text-center">
                <div className="text-4xl sm:text-5xl">{spot.medal}</div>
                <div className={`mx-auto max-w-full truncate rounded-xl px-2 py-1 font-display text-base sm:text-2xl ${p.id === youId ? 'bg-sun text-ink' : ''}`}>{p.nickname}</div>
                <div className="font-extrabold tabular-nums text-white/90">{p.score}</div>
              </motion.div>
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} transition={{ delay: spot.delay, duration: 0.9, ease: 'easeOut' }} className="w-full overflow-hidden">
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ delay: spot.delay, duration: 0.9, ease: 'easeOut' }}
                  className={`${spot.h} flex w-full items-start justify-center rounded-t-3xl bg-gradient-to-b ${spot.grad} pt-3 font-display text-5xl text-ink/80 shadow-glow sm:text-7xl`}>{r}</motion.div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
