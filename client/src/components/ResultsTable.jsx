import { useI18n } from '../lib/i18n.jsx';

export default function ResultsTable({ rows }) {
  const { t } = useI18n();
  return (
    <div className="overflow-hidden rounded-3xl bg-white text-ink shadow-pop">
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-grape-50 text-sm"><tr>
            <th className="px-4 py-3">{t('results.rank')}</th><th className="px-4 py-3">{t('results.nick')}</th>
            <th className="px-4 py-3 text-right">{t('results.score')}</th><th className="hidden px-4 py-3 text-right sm:table-cell">{t('results.correct')}</th><th className="hidden px-4 py-3 text-right sm:table-cell">{t('results.answered')}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id || r.nickname} className={`border-t border-ink/5 font-bold ${r.isYou ? 'bg-sun/30' : ''}`}>
                <td className="px-4 py-2.5">{r.rank}</td><td className="max-w-[10rem] truncate px-4 py-2.5 sm:max-w-none">{r.nickname}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.score}</td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{r.correct ?? '–'}</td><td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{r.answered ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
