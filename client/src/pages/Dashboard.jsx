import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Eye, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import TeacherLayout from '../components/TeacherLayout.jsx';
import { ErrorNote, Modal, PageLoader, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
import { emit, getSocket } from '../lib/socket.js';

export default function Dashboard() {
  const { t, err } = useI18n();
  const nav = useNavigate();
  const [quizzes, setQuizzes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [hostFor, setHostFor] = useState(null);
  const [streak, setStreak] = useState(100);

  const load = useCallback(() => api('/api/quizzes').then((d) => setQuizzes(d.quizzes)).catch((e) => setError(err(e.code))), [err]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy('new');
    try { const d = await api('/api/quizzes', { method: 'POST', body: { title: t('dash.untitled') } }); nav(`/quiz/${d.quiz.id}/edit`); }
    catch (e) { setError(err(e.code)); setBusy(''); }
  };
  const dup = async (id) => { setBusy(id); try { await api(`/api/quizzes/${id}/duplicate`, { method: 'POST' }); await load(); } catch (e) { setError(err(e.code)); } setBusy(''); };
  const del = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    setBusy(id); try { await api(`/api/quizzes/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(err(e.code)); } setBusy('');
  };
  const host = async () => {
    setBusy('host'); setError('');
    const s = getSocket();
    if (!s.connected) { s.connect(); await new Promise((r) => (s.connected ? r() : s.once('connect', r))); }
    const res = await emit('host:create', { quizId: hostFor.id, streakBonus: streak });
    setBusy('');
    if (res.error) return setError(err(res.error));
    nav(`/host/${res.pin}`);
  };

  return (
    <TeacherLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">{t('dash.title')}</h1>
        <button onClick={create} disabled={busy === 'new'} className="btn-primary">{busy === 'new' ? <Spinner className="h-5 w-5" /> : <Plus className="h-5 w-5" />}{t('dash.new')}</button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!quizzes && !error && <PageLoader />}
      {quizzes?.length === 0 && (
        <div className="glass mt-4 grid place-items-center gap-4 px-6 py-16 text-center">
          <p className="text-xl font-extrabold text-white/80">{t('dash.empty')}</p>
          <button onClick={create} className="btn-primary"><Plus className="h-5 w-5" />{t('dash.new')}</button>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quizzes?.map((q, i) => (
          <motion.div key={q.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card flex flex-col gap-3">
            <div>
              <h3 className="line-clamp-2 font-display text-2xl leading-tight">{q.title}</h3>
              <p className="mt-1 text-sm font-bold text-ink/60">{q.questionCount} {t('common.questions')} · {q.gameCount} {t('dash.games')}</p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <button onClick={() => { setHostFor(q); setError(''); }} disabled={q.questionCount === 0} className="btn-green flex-1 !py-2"><Play className="h-4 w-4" />{t('dash.host')}</button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link to={`/quiz/${q.id}/edit`} className="btn bg-grape-50 !px-3 !py-2 text-grape-700 hover:bg-grape-100"><Pencil className="h-4 w-4" />{t('common.edit')}</Link>
              <Link to={`/quiz/${q.id}/preview`} className="btn bg-grape-50 !px-3 !py-2 text-grape-700 hover:bg-grape-100"><Eye className="h-4 w-4" />{t('dash.preview')}</Link>
              <button onClick={() => dup(q.id)} disabled={busy === q.id} aria-label={t('common.duplicate')} title={t('common.duplicate')} className="btn bg-grape-50 !px-3 !py-2 text-grape-700 hover:bg-grape-100"><Copy className="h-4 w-4" /></button>
              <button onClick={() => del(q.id)} disabled={busy === q.id} aria-label={t('common.delete')} title={t('common.delete')} className="btn bg-coral/10 !px-3 !py-2 text-coral hover:bg-coral/20"><Trash2 className="h-4 w-4" /></button>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal open={!!hostFor} onClose={() => setHostFor(null)} title={t('dash.hostOptions')}>
        <p className="mb-3 font-extrabold">{hostFor?.title}</p>
        <label className="mb-1 block text-sm font-extrabold" htmlFor="streak">{t('dash.streakBonus')}</label>
        <input id="streak" type="number" min={0} max={500} step={10} value={streak} onChange={(e) => setStreak(Number(e.target.value))} className="input !bg-grape-50" />
        <ErrorNote>{error}</ErrorNote>
        <button onClick={host} disabled={busy === 'host'} className="btn-green mt-4 w-full">{busy === 'host' ? <Spinner className="h-5 w-5" /> : <Play className="h-5 w-5" />}{t('dash.startLobby')}</button>
      </Modal>
    </TeacherLayout>
  );
}
