import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Flame, Send, Users, WifiOff, X } from 'lucide-react';
import { ANSWER_STYLES, Background, ErrorNote, LangSwitch, Shape, Spinner } from '../components/ui.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import Podium from '../components/Podium.jsx';
import ResultsTable from '../components/ResultsTable.jsx';
import TimerBar from '../components/TimerBar.jsx';
import { clearSession, loadSession } from './Join.jsx';
import { emit } from '../lib/socket.js';
import { imgSrc } from '../lib/api.js';
import { useGameConnection, useRemaining } from '../lib/useGame.js';
import { useI18n } from '../lib/i18n.jsx';

const Screen = ({ children, k }) => (
  <motion.div key={k} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col items-center justify-center gap-5 px-4 py-6 text-center">{children}</motion.div>
);

function Question({ state }) {
  const { t, err } = useI18n();
  const remaining = useRemaining(state);
  const q = state.question;
  const [sel, setSel] = useState([]);
  const [sent, setSent] = useState(state.answered);
  const [error, setError] = useState('');
  useEffect(() => { setSent(state.answered); }, [state.answered]);
  const send = async (ids) => {
    if (sent || state.paused) return;
    setSent(true); setSel(ids); setError('');
    const res = await emit('player:answer', { answerIds: ids });
    if (res.error && res.error !== 'ALREADY_ANSWERED') { setSent(false); setError(err(res.error)); }
  };
  const pick = (id) => {
    if (sent || state.paused) return;
    if (!q.multi) return send([id]);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const chosen = sent ? (state.myAnswerIds?.length ? state.myAnswerIds : sel) : sel;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col gap-3 px-3 py-3">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <div className="flex items-center justify-between text-sm font-extrabold text-white/80">
          <span>{state.index + 1} {t('game.of')} {state.totalQuestions}</span>
          <span className="tabular-nums font-display text-2xl text-white">{Math.ceil(remaining / 1000)}</span>
        </div>
        <TimerBar remainingMs={remaining} totalMs={q.timeLimit * 1000} />
        <div className="card text-center font-display text-xl leading-snug sm:text-3xl">{q.text}</div>
        {q.imageUrl && <img src={imgSrc(q.imageUrl)} alt="" className="mx-auto max-h-40 rounded-2xl object-contain sm:max-h-64" />}
        {q.multi && !sent && <p className="text-sm font-extrabold text-white/70">{t('game.selectMulti')}</p>}
      </div>
      {state.paused && <div className="mx-auto rounded-2xl bg-white px-6 py-3 font-display text-2xl text-ink">{t('game.paused')}</div>}
      <div className={`mx-auto grid w-full max-w-3xl flex-1 gap-3 ${q.answers.length > 4 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} auto-rows-fr`}>
        {q.answers.map((a, i) => { const s = ANSWER_STYLES[i]; const on = chosen.includes(a.id); return (
          <button key={a.id} disabled={sent || state.paused} onClick={() => pick(a.id)} aria-pressed={on}
            className={`relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-lg font-extrabold shadow-pop transition active:translate-y-1 active:shadow-none sm:text-2xl ${s.bg} ${s.dark ? 'text-ink' : 'text-white'} ${sent && !on ? 'opacity-35' : ''} ${on ? 'ring-8 ring-white' : ''}`}>
            <Shape kind={s.shape} className="h-8 w-8 sm:h-10 sm:w-10" /><span className="break-words">{a.text}</span>
            {on && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-ink"><Check className="h-4 w-4" /></span>}
          </button>); })}
      </div>
      {q.multi && !sent && <button onClick={() => sel.length && send(sel)} disabled={!sel.length} className="btn-green mx-auto w-full max-w-3xl !py-4 text-xl"><Send className="h-5 w-5" />{t('game.submit')}</button>}
      {sent && <p className="mx-auto inline-flex items-center gap-2 text-lg font-extrabold"><Spinner className="h-5 w-5" />{t('game.submitted')}</p>}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function Countdown({ state }) {
  const { t } = useI18n();
  const remaining = useRemaining(state);
  const n = Math.max(1, Math.ceil(remaining / 1000));
  return <>
    <p className="font-display text-3xl">{t('game.question')} {state.index + 1}</p>
    <p className="text-xl font-extrabold text-white/80">{t('game.getReady')}</p>
    <AnimatePresence mode="popLayout"><motion.div key={n} initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} className="font-display text-9xl text-sun">{n}</motion.div></AnimatePresence>
  </>;
}

function Result({ state }) {
  const { t } = useI18n();
  const y = state.you;
  const status = !y?.answered ? 'time' : y.isCorrect ? 'ok' : 'bad';
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`w-full max-w-md rounded-3xl p-8 shadow-pop ${status === 'ok' ? 'bg-mint' : status === 'bad' ? 'bg-coral' : 'bg-white/15'}`}>
      <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-white/25">{status === 'ok' ? <Check className="h-12 w-12" /> : <X className="h-12 w-12" />}</div>
      <h2 className="font-display text-4xl">{status === 'ok' ? t('res.correct') : status === 'bad' ? t('res.wrong') : t('res.timeUp')}</h2>
      {status === 'ok' && <p className="mt-2 font-display text-5xl">+{y.points} <span className="text-2xl">{t('res.plus')}</span></p>}
      {y?.streak >= 2 && <p className="mt-2 inline-flex items-center gap-1 rounded-xl bg-white/25 px-3 py-1 font-extrabold"><Flame className="h-5 w-5" />{t('res.streak')} {y.streak}{y.streakBonus > 0 && ` (+${y.streakBonus})`}</p>}
      <div className="mt-5 flex justify-center gap-3 text-sm font-extrabold">
        <span className="rounded-xl bg-black/20 px-3 py-2">{t('results.score')}: <b className="tabular-nums">{y?.score ?? 0}</b></span>
        {y?.rank && <span className="rounded-xl bg-black/20 px-3 py-2">{t('res.rank')}: <b>{y.rank}</b></span>}
      </div>
    </motion.div>
  );
}

export default function Play() {
  const { t, err } = useI18n();
  const nav = useNavigate();
  const session = useMemo(loadSession, []);
  const { state, conn, fatal } = useGameConnection(() => emit('player:rejoin', { pin: session?.pin, token: session?.token }));
  useEffect(() => { if (fatal && fatal !== 'RATE_LIMITED') clearSession(); }, [fatal]);
  if (!session) return <Navigate to="/join" replace />;

  if (fatal) return (
    <Background><Screen k="fatal">
      <p className="font-display text-3xl">{fatal === 'KICKED' ? t('game.kicked') : err(fatal)}</p>
      <Link to="/join" onClick={() => nav('/join')} className="btn-primary">{t('nav.join')}</Link>
    </Screen></Background>
  );

  const y = state?.you;
  let body;
  if (!state) body = <Screen k="load"><Spinner className="h-10 w-10" /></Screen>;
  else if (state.phase === 'question') body = <Question key={state.index} state={state} />;
  else body = (
    <Screen k={state.phase}>
      {state.phase === 'lobby' && <>
        <motion.div animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="grid h-24 w-24 place-items-center rounded-3xl bg-mint shadow-pop"><Check className="h-14 w-14" /></motion.div>
        <h1 className="font-display text-4xl">{t('wait.in')}</h1>
        <p className="rounded-2xl bg-white px-6 py-3 font-display text-3xl text-ink">{y?.nickname || session.nickname}</p>
        <p className="inline-flex items-center gap-2 font-extrabold text-white/80"><Users className="h-5 w-5" />{state.playerCount} {t('wait.players')}</p>
      </>}
      {state.phase === 'countdown' && <Countdown state={state} />}
      {state.phase === 'results' && <Result state={state} />}
      {state.phase === 'leaderboard' && <>
        <h2 className="font-display text-4xl">{t('lb.title')}</h2>
        <Leaderboard entries={state.top} youId={y?.id} />
        {y?.rank > 5 && <p className="rounded-2xl bg-sun px-5 py-3 font-extrabold text-ink">{t('lb.you')}: #{y.rank} · {y.score}</p>}
      </>}
      {state.phase === 'finished' && <div className="w-full">
        <h2 className="mb-6 font-display text-5xl">{t('podium.title')}</h2>
        <Podium podium={state.podium} youId={y?.id} />
        {y?.rank && <p className="mx-auto mt-6 w-fit rounded-2xl bg-sun px-6 py-3 font-display text-2xl text-ink">{t('podium.yourPlace')}: {y.rank} · {y.score}</p>}
        <div className="mx-auto mt-6 max-w-xl text-left"><h3 className="mb-2 text-center font-display text-2xl">{t('podium.full')}</h3>
          <ResultsTable rows={state.ranking.map((r) => ({ ...r, isYou: r.id === y?.id }))} /></div>
        <Link to="/" onClick={clearSession} className="btn-ghost mt-6">{t('podium.home')}</Link>
      </div>}
    </Screen>
  );

  return (
    <Background>
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="max-w-[50%] truncate rounded-xl bg-white/10 px-3 py-1.5 text-sm font-extrabold">{y?.nickname || session.nickname}</span>
        <div className="flex items-center gap-2">
          {y && state?.phase !== 'lobby' && <span className="rounded-xl bg-sun px-3 py-1.5 text-sm font-extrabold tabular-nums text-ink">{y.score}</span>}
          <LangSwitch className="!py-1.5" />
        </div>
      </div>
      {conn === 'offline' && <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-coral py-2 text-sm font-extrabold"><WifiOff className="h-4 w-4" />{t('game.reconnecting')}</div>}
      {body}
    </Background>
  );
}
