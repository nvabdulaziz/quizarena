import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Trash2 } from 'lucide-react';
import TeacherLayout from '../components/TeacherLayout.jsx';
import { ErrorNote, PageLoader } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

export default function History() {
  const { t, err, lang } = useI18n();
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/api/games').then((d) => setGames(d.games)).catch((e) => setError(err(e.code)));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const del = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try { await api(`/api/games/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(err(e.code)); }
  };
  const fmt = (d) => new Date(d).toLocaleString(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <TeacherLayout>
      <h1 className="mb-6 font-display text-4xl">{t('history.title')}</h1>
      <ErrorNote>{error}</ErrorNote>
      {!games && !error && <PageLoader />}
      {games?.length === 0 && <div className="glass p-10 text-center text-lg font-extrabold">{t('history.empty')}</div>}
      <div className="grid gap-3">
        {games?.map((g) => (
          <div key={g.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl">{g.quizTitle}</h3>
              <p className="text-sm font-bold text-ink/60">{fmt(g.finishedAt || g.createdAt)} · PIN {g.pin} · {g.playerCount} {t('common.players')} · {g.status === 'ABORTED' ? t('history.aborted') : t('history.finished')}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/history/${g.id}`} className="btn-pink !py-2 text-sm"><BarChart3 className="h-4 w-4" />{t('history.view')}</Link>
              <button onClick={() => del(g.id)} aria-label={t('common.delete')} className="btn bg-coral/10 !px-3 !py-2 text-coral hover:bg-coral/20"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </TeacherLayout>
  );
}
