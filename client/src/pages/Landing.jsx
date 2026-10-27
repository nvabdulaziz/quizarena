import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, PencilRuler, Radio, Trophy, Users } from 'lucide-react';
import { Background, Logo, LangSwitch } from '../components/ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Landing() {
  const { t } = useI18n();
  const { teacher } = useAuth();
  const feats = [[PencilRuler, 'f1', 'bg-sky'], [Users, 'f2', 'bg-mint'], [Trophy, 'f3', 'bg-bubble']];
  return (
    <Background>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <LangSwitch />
          {teacher ? <Link to="/dashboard" className="btn-primary !py-2 text-sm">{t('nav.dashboard')}</Link>
            : <Link to="/login" className="btn-ghost !py-2 text-sm">{t('nav.login')}</Link>}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 text-center sm:pt-20">
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl leading-tight sm:text-7xl">
          Quiz<span className="text-sun">Arena</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mx-auto mt-4 max-w-xl text-lg font-bold text-white/85 sm:text-xl">{t('app.tagline')}</motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
          <Link to="/join" className="group card flex flex-col items-center gap-3 !p-8 transition hover:-translate-y-1">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-mint text-white"><Radio className="h-8 w-8" /></span>
            <span className="font-display text-2xl">{t('landing.student')}</span>
            <span className="rounded-xl bg-ink px-4 py-2 text-sm font-extrabold text-white group-hover:bg-grape-600">{t('nav.join')}</span>
          </Link>
          <Link to={teacher ? '/dashboard' : '/register'} className="group card flex flex-col items-center gap-3 !p-8 transition hover:-translate-y-1">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-bubble text-white"><GraduationCap className="h-8 w-8" /></span>
            <span className="font-display text-2xl">{t('landing.teacher')}</span>
            <span className="rounded-xl bg-ink px-4 py-2 text-sm font-extrabold text-white group-hover:bg-grape-600">{teacher ? t('nav.dashboard') : t('nav.register')}</span>
          </Link>
        </motion.div>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {feats.map(([Icon, k, bg], i) => (
            <motion.div key={k} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass p-5">
              <span className={`mb-3 grid h-11 w-11 place-items-center rounded-xl ${bg}`}><Icon className="h-6 w-6" /></span>
              <h3 className="font-display text-xl">{t(`landing.${k}.t`)}</h3>
              <p className="mt-1 font-semibold text-white/75">{t(`landing.${k}.d`)}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </Background>
  );
}
