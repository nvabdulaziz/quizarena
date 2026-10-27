import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Languages, X } from 'lucide-react';
import { useI18n, LANGS } from '../lib/i18n.jsx';

/* Four+ answer styles: distinct color AND shape so colour-blind players can tell them apart. */
export const ANSWER_STYLES = [
  { bg: 'bg-coral', shape: 'triangle' },
  { bg: 'bg-sky', shape: 'diamond' },
  { bg: 'bg-sun', shape: 'circle', dark: true },
  { bg: 'bg-mint', shape: 'square' },
  { bg: 'bg-bubble', shape: 'star' },
  { bg: 'bg-grape-300', shape: 'hex' },
];

export function Shape({ kind, className = 'h-8 w-8' }) {
  const p = { viewBox: '0 0 24 24', fill: 'currentColor', className, 'aria-hidden': true };
  switch (kind) {
    case 'triangle': return <svg {...p}><path d="M12 3 22 20H2z" /></svg>;
    case 'diamond': return <svg {...p}><path d="M12 1 23 12 12 23 1 12z" /></svg>;
    case 'circle': return <svg {...p}><circle cx="12" cy="12" r="10" /></svg>;
    case 'square': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /></svg>;
    case 'star': return <svg {...p}><path d="m12 2 3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z" /></svg>;
    default: return <svg {...p}><path d="M7 2h10l5 10-5 10H7L2 12z" /></svg>;
  }
}

export function Background({ children, className = '' }) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-br from-grape-900 via-grape-800 to-[#4b1a9e] ${className}`}>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-10 h-72 w-72 animate-drift rounded-full bg-bubble/25 blur-3xl" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 animate-drift rounded-full bg-sky/25 blur-3xl [animation-delay:-6s]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 animate-drift rounded-full bg-sun/15 blur-3xl [animation-delay:-11s]" />
        {[['8%', '18%', 'triangle', 'text-coral/30', '0s'], ['86%', '14%', 'diamond', 'text-sky/30', '-2s'], ['14%', '72%', 'circle', 'text-sun/30', '-4s'], ['90%', '70%', 'square', 'text-mint/30', '-1s']].map(([l, tp, s, c, d], i) => (
          <div key={i} className={`absolute animate-float ${c}`} style={{ left: l, top: tp, animationDelay: d }}><Shape kind={s} className="h-14 w-14" /></div>
        ))}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

export function Logo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2 font-display text-2xl tracking-wide ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-sun text-ink shadow-popsm"><Shape kind="triangle" className="h-5 w-5" /></span>
      QuizArena
    </Link>
  );
}

export function LangSwitch({ className = '' }) {
  const { lang, setLang } = useI18n();
  return (
    <label className={`relative inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-extrabold hover:bg-white/20 ${className}`}>
      <Languages className="h-4 w-4" aria-hidden />
      <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)} className="cursor-pointer appearance-none bg-transparent pr-1 outline-none">
        {LANGS.map((l) => <option key={l.code} value={l.code} className="text-ink">{l.label}</option>)}
      </select>
    </label>
  );
}

export function Spinner({ className = 'h-6 w-6' }) { return <Loader2 className={`animate-spin ${className}`} aria-hidden />; }

export function PageLoader() {
  const { t } = useI18n();
  return <div className="grid min-h-[50vh] place-items-center"><div className="flex items-center gap-3 font-bold text-white/80"><Spinner /> {t('common.loading')}</div></div>;
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div role="alert" className="rounded-2xl bg-coral/90 px-4 py-3 text-sm font-bold text-white">{children}</div>;
}

export function Modal({ open, onClose, title, children, wide }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            className={`card max-h-[90vh] w-full overflow-auto ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-ink/60 hover:bg-ink/10"><X className="h-5 w-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

