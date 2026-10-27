import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { BarChart3, Check, Download, Pause, Play, SkipForward, Square, Trophy, UserX, Users, WifiOff } from 'lucide-react';
import { ANSWER_STYLES, Background, ErrorNote, LangSwitch, Logo, Shape, Spinner } from '../components/ui.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import Podium from '../components/Podium.jsx';
import ResultsTable from '../components/ResultsTable.jsx';
import TimerBar from '../components/TimerBar.jsx';
import { download, imgSrc } from '../lib/api.js';
import { emit } from '../lib/socket.js';
import { useGameConnection, useRemaining } from '../lib/useGame.js';
import { useI18n } from '../lib/i18n.jsx';

function Lobby({ state, act, busy }) {
  const { t } = useI18n();
  const joinUrl = `${window.location.origin}/join/${state.pin}`;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 lg:grid-cols-[22rem_1fr]">
      <div className="card flex flex-col items-center gap-4 !p-6 text-center">
        <p className="text-sm font-extrabold uppercase tracking-widest text-ink/50">{t('wait.joinAt')} <b className="text-ink">{window.location.host}/join</b></p>
        <p className="text-sm font-extrabold text-ink/50">{t('wait.pin')}</p>
        <p className="font-display text-6xl tracking-widest sm:text-7xl" aria-label={`PIN ${state.pin}`}>{state.pin}</p>
        <div className="rounded-2xl bg-white p-3 ring-4 ring-grape-100"><QRCodeSVG value={joinUrl} size={200} level="M" /></div>
        <p className="text-xs font-extrabold text-ink/50">{t('wait.scan')}</p>
      </div>
      <div className="flex min-h-[22rem] flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 font-display text-3xl"><Users className="h-7 w-7" />{state.playerCount} {t('wait.players')}</p>
          <button onClick={() => act('host:start')} disabled={busy || state.playerCount === 0} className="btn-green !px-8 !py-4 text-xl">{busy ? <Spinner className="h-5 w-5" /> : <Play className="h-6 w-6" />}{t('wait.start')}</button>
        </div>
        <div className="glass flex-1 p-4">
          {state.players.length === 0 && <p className="grid h-full place-items-center py-16 text-center text-lg font-extrabold text-white/60">{t('wait.noPlayers')}</p>}
          <div className="flex flex-wrap gap-2.5">
            <AnimatePresence>
              {state.players.map((p) => (
                <motion.span key={p.id} layout initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  className="group inline-flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-lg font-extrabold text-ink shadow-popsm">
                  {p.nickname}
                  <button onClick={() => act('host:kick', { playerId: p.id })} aria-label={`${t('wait.kick')} ${p.nickname}`} title={t('wait.kick')} className="rounded-full p-0.5 text-ink/30 hover:text-coral"><UserX className="h-4 w-4" /></button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Controls({ state, act, busy, onEnd }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {state.phase === 'question' && (state.paused
        ? <button onClick={() => act('host:resume')} className="btn-green !py-2 text-sm"><Play className="h-4 w-4" />{t('game.resume')}</button>
        : <button onClick={() => act('host:pause')} className="btn-ghost !py-2 text-sm"><Pause className="h-4 w-4" />{t('game.pause')}</button>)}
      {state.phase === 'question' && <button onClick={() => act('host:skip')} disabled={busy || state.paused} className="btn-ghost !py-2 text-sm"><SkipForward className="h-4 w-4" />{t('game.skip')}</button>}
      <button onClick={onEnd} className="btn-danger !py-2 text-sm"><Square className="h-4 w-4" />{t('game.end')}</button>
    </div>
  );
}

function QuestionView({ state, act, busy, onEnd }) {
  const { t } = useI18n();
  const remaining = useRemaining(state);
  const q = state.question;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <span className="font-extrabold text-white/80">{t('game.question')} {state.index + 1} {t('game.of')} {state.totalQuestions}</span>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 font-display text-2xl tabular-nums"><Users className="h-5 w-5" />{state.answeredCount ?? 0}/{state.playerCount} {t('game.answered')}</span>
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white font-display text-4xl tabular-nums text-ink">{Math.ceil(remaining / 1000)}</span>
      </div>
      <TimerBar remainingMs={remaining} totalMs={q.timeLimit * 1000} />
      <div className="card text-center font-display text-3xl leading-snug sm:text-5xl">{q.text}</div>
      {q.imageUrl && <img src={imgSrc(q.imageUrl)} alt="" className="mx-auto max-h-72 rounded-3xl object-contain" />}
      {state.paused && <div className="mx-auto rounded-2xl bg-white px-8 py-3 font-display text-3xl text-ink">{t('game.paused')}</div>}
      <div className={`grid gap-3 ${q.answers.length > 4 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {q.answers.map((a, i) => { const s = ANSWER_STYLES[i]; return (
          <div key={a.id} className={`flex items-center gap-4 rounded-2xl p-5 text-2xl font-extrabold shadow-pop sm:text-3xl ${s.bg} ${s.dark ? 'text-ink' : 'text-white'}`}><Shape kind={s.shape} className="h-10 w-10 shrink-0" /><span className="break-words">{a.text}</span></div>); })}
      </div>
      <Controls state={state} act={act} busy={busy} onEnd={onEnd} />
    </div>
  );
}

function ResultsView({ state, act, busy, onEnd }) {
  const { t } = useI18n();
  const q = state.question;
  const max = Math.max(1, ...Object.values(state.counts || {}));
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8">
      <div className="card text-center font-display text-2xl sm:text-4xl">{q.text}</div>
      <h3 className="text-center font-display text-2xl">{t('res.distribution')}</h3>
      <div className={`grid gap-3 ${q.answers.length > 4 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {q.answers.map((a, i) => { const s = ANSWER_STYLES[i]; const n = state.counts?.[a.id] || 0; return (
          <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: a.isCorrect ? 1 : 0.5, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`relative overflow-hidden rounded-2xl p-4 shadow-pop ${s.bg} ${s.dark ? 'text-ink' : 'text-white'} ${a.isCorrect ? 'ring-8 ring-white' : ''}`}>
            <div className="flex items-center gap-3 text-xl font-extrabold"><Shape kind={s.shape} className="h-7 w-7 shrink-0" /><span className="flex-1 break-words">{a.text}</span>
              {a.isCorrect && <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-mint"><Check className="h-5 w-5" /></span>}
              <span className="font-display text-3xl tabular-nums">{n}</span></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/20"><motion.div initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.2 }} className="h-full rounded-full bg-white" /></div>
          </motion.div>); })}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={() => act('host:next')} disabled={busy} className="btn-primary !px-8 !py-4 text-xl"><BarChart3 className="h-6 w-6" />{t('game.showLeaderboard')}</button>
      </div>
      <Controls state={state} act={act} busy={busy} onEnd={onEnd} />
    </div>
  );
}

export default function Host() {
  const { pin } = useParams();
  const { t, err } = useI18n();
  const nav = useNavigate();
  const gameId = useRef(null);
  const { state, conn, fatal } = useGameConnection(async () => {
    const res = await emit('host:rejoin', { pin });
    if (res.gameId) gameId.current = res.gameId;
    return res;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (event, payload) => {
    setBusy(true); setError('');
    const res = await emit(event, payload);
    setBusy(false);
    if (res.error) setError(err(res.error));
  };
  const onEnd = () => { if (window.confirm(t('game.confirmEnd'))) act('host:end'); };
  const dl = (fmt) => download(`/api/games/${gameId.current}/export.${fmt}`, `results-${pin}.${fmt}`).catch((e) => setError(err(e.code)));

  if (fatal) return (
    <Background><div className="grid min-h-screen place-items-center gap-4 p-6 text-center">
      <div><p className="mb-4 font-display text-3xl">{err(fatal)}</p><Link to="/dashboard" className="btn-primary">{t('nav.dashboard')}</Link></div>
    </div></Background>
  );

  const last = state && state.index >= state.totalQuestions - 1;
  return (
    <Background>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Logo to="/dashboard" />
        {state && state.phase !== 'lobby' && <span className="rounded-xl bg-white/10 px-3 py-2 font-extrabold">PIN {state.pin}</span>}
        <div className="flex items-center gap-2">
          {state?.phase === 'lobby' && <button onClick={onEnd} className="btn-ghost !py-2 text-sm"><Square className="h-4 w-4" />{t('common.cancel')}</button>}
          <LangSwitch />
        </div>
      </header>
      {conn === 'offline' && <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-coral py-2 text-sm font-extrabold"><WifiOff className="h-4 w-4" />{t('game.reconnecting')}</div>}
      <div className="mx-auto max-w-6xl px-4"><ErrorNote>{error}</ErrorNote></div>
      {!state && <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-10 w-10" /></div>}
      {state?.phase === 'lobby' && <Lobby state={state} act={act} busy={busy} />}
      {state?.phase === 'countdown' && <div className="grid min-h-[60vh] place-items-center text-center"><div><p className="font-display text-4xl">{t('game.question')} {state.index + 1}</p><p className="mt-2 text-2xl font-extrabold text-white/80">{t('game.getReady')}</p></div></div>}
      {state?.phase === 'question' && <QuestionView state={state} act={act} busy={busy} onEnd={onEnd} />}
      {state?.phase === 'results' && <ResultsView state={state} act={act} busy={busy} onEnd={onEnd} />}
      {state?.phase === 'leaderboard' && (
        <div className="mx-auto max-w-3xl px-4 pb-10 text-center">
          <h2 className="mb-1 font-display text-5xl">{t('lb.title')}</h2><p className="mb-5 font-extrabold text-white/70">{t('lb.top5')}</p>
          <Leaderboard entries={state.top} big />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => act('host:next')} disabled={busy} className="btn-primary !px-8 !py-4 text-xl">{last ? <Trophy className="h-6 w-6" /> : <SkipForward className="h-6 w-6" />}{last ? t('game.finish') : t('game.next')}</button>
          </div>
          <div className="mt-4"><Controls state={state} act={act} busy={busy} onEnd={onEnd} /></div>
        </div>
      )}
      {state?.phase === 'finished' && (
        <div className="mx-auto max-w-4xl px-4 pb-16 text-center">
          <h2 className="mb-6 font-display text-5xl">{t('podium.title')}</h2>
          <Podium podium={state.podium} />
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button onClick={() => dl('xlsx')} className="btn-green !py-2 text-sm"><Download className="h-4 w-4" />{t('podium.exportXlsx')}</button>
            <button onClick={() => dl('csv')} className="btn-primary !py-2 text-sm"><Download className="h-4 w-4" />{t('podium.exportCsv')}</button>
            <button onClick={() => nav('/dashboard')} className="btn-ghost !py-2 text-sm">{t('podium.home')}</button>
          </div>
          <h3 className="mb-3 mt-8 font-display text-3xl">{t('podium.full')}</h3>
          <div className="text-left"><ResultsTable rows={state.ranking} /></div>
        </div>
      )}
    </Background>
  );
}
