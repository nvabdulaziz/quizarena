import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import TeacherLayout from '../components/TeacherLayout.jsx';
import ResultsTable from '../components/ResultsTable.jsx';
import { ErrorNote, PageLoader } from '../components/ui.jsx';
import { api, download } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

export default function Results() {
  const { id } = useParams();
  const { t, err } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/games/${id}/results`).then(setData).catch((e) => setError(err(e.code))); }, [id, err]);
  const dl = (fmt) => download(`/api/games/${id}/export.${fmt}`, `results-${data.game.pin}.${fmt}`).catch((e) => setError(err(e.code)));
  return (
    <TeacherLayout>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/history" className="btn-ghost !py-2"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
        <h1 className="font-display text-3xl">{data?.game.quizTitle}</h1>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!data && !error && <PageLoader />}
      {data && <>
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => dl('xlsx')} className="btn-green !py-2 text-sm"><Download className="h-4 w-4" />{t('podium.exportXlsx')}</button>
          <button onClick={() => dl('csv')} className="btn-primary !py-2 text-sm"><Download className="h-4 w-4" />{t('podium.exportCsv')}</button>
        </div>
        <ResultsTable rows={data.results} />
      </>}
    </TeacherLayout>
  );
}
