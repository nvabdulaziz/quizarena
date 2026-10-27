import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock } from 'lucide-react';
import TeacherLayout from '../components/TeacherLayout.jsx';
import { ANSWER_STYLES, ErrorNote, PageLoader, Shape } from '../components/ui.jsx';
import { api, imgSrc } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

export default function Preview() {
  const { id } = useParams();
  const { t, err } = useI18n();
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');
  const [i, setI] = useState(0);
  useEffect(() => { api(`/api/quizzes/${id}`).then((d) => setQuiz(d.quiz)).catch((e) => setError(err(e.code))); }, [id, err]);

  if (error) return <TeacherLayout><ErrorNote>{error}</ErrorNote></TeacherLayout>;
  if (!quiz) return <TeacherLayout><PageLoader /></TeacherLayout>;
  const q = quiz.questions[i];
  return (
    <TeacherLayout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to={`/quiz/${id}/edit`} className="btn-ghost !py-2"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
        <h1 className="font-display text-3xl">{t('preview.title')}: {quiz.title}</h1>
      </div>
      {!q ? <div className="glass p-10 text-center font-extrabold">{t('edit.noQuestions')}</div> : (
        <div className="glass p-5 sm:p-8">
          <div className="mb-4 flex items-center justify-between font-extrabold text-white/80">
            <span>{t('game.question')} {i + 1} {t('game.of')} {quiz.questions.length}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{q.timeLimit} {t('common.seconds')} · {q.points} {t('common.points')}</span>
          </div>
          <div className="card mb-4 text-center font-display text-2xl sm:text-4xl">{q.text}</div>
          {q.imageUrl && <img src={imgSrc(q.imageUrl)} alt="" className="mx-auto mb-4 max-h-64 rounded-2xl object-contain" />}
          <div className="grid gap-3 sm:grid-cols-2">
            {q.answers.map((a, k) => { const s = ANSWER_STYLES[k]; return (
              <div key={a.id} className={`flex items-center gap-3 rounded-2xl p-4 text-lg font-extrabold shadow-pop ${s.bg} ${s.dark ? 'text-ink' : 'text-white'}`}>
                <Shape kind={s.shape} className="h-7 w-7 shrink-0" /><span className="flex-1 break-words">{a.text}</span>
                {a.isCorrect && <span title={t('preview.correct')} className="grid h-8 w-8 place-items-center rounded-full bg-white text-mint"><Check className="h-5 w-5" /></span>}
              </div>); })}
          </div>
          <div className="mt-6 flex justify-between">
            <button disabled={i === 0} onClick={() => setI(i - 1)} className="btn-ghost">←</button>
            <button disabled={i === quiz.questions.length - 1} onClick={() => setI(i + 1)} className="btn-primary">{t('common.next')} →</button>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}
