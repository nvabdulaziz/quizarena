import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';

const rankColor = ['bg-sun text-ink', 'bg-slate-300 text-ink', 'bg-orange-400 text-ink'];

export default function Leaderboard({ entries, youId, big = false }) {
  return (
    <ol className="mx-auto w-full max-w-2xl space-y-2.5">
      {entries.map((e, i) => (
        <motion.li layout key={e.id} initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26, delay: i * 0.08 }}
          className={`flex items-center gap-3 rounded-2xl px-4 shadow-pop ${big ? 'py-4' : 'py-3'} ${e.id === youId ? 'bg-sun text-ink' : 'bg-white text-ink'}`}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-xl ${rankColor[e.rank - 1] || 'bg-grape-100 text-grape-700'}`}>{e.rank}</span>
          <span className={`min-w-0 flex-1 truncate font-extrabold ${big ? 'text-2xl' : 'text-lg'}`}>{e.nickname}</span>
          {e.streak >= 2 && <span className="inline-flex items-center gap-0.5 rounded-lg bg-coral/15 px-2 py-1 text-sm font-extrabold text-coral" title="streak"><Flame className="h-4 w-4" />{e.streak}</span>}
          <span aria-label="rank change" className={`inline-flex w-9 items-center justify-end text-sm font-extrabold ${e.movement > 0 ? 'text-mint' : e.movement < 0 ? 'text-coral' : 'text-ink/30'}`}>
            {e.movement > 0 ? <ArrowUp className="h-4 w-4" /> : e.movement < 0 ? <ArrowDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}{e.movement !== 0 && Math.abs(e.movement)}
          </span>
          <motion.span key={e.score} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={`tabular-nums font-display ${big ? 'text-3xl' : 'text-2xl'}`}>{e.score}</motion.span>
        </motion.li>
      ))}
    </ol>
  );
}
