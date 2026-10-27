import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Copy, Eye, FileDown, GripVertical, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react';
import TeacherLayout from '../components/TeacherLayout.jsx';
import { ANSWER_STYLES, ErrorNote, Modal, PageLoader, Shape, Spinner } from '../components/ui.jsx';
import { api, download, imgSrc } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';

const TIMES = [5, 10, 15, 20, 30, 60, 120];
let uid = 0;
const nid = () => `k${Date.now().toString(36)}${uid++}`;
const blankQuestion = () => ({ key: nid(), text: '', imageUrl: null, timeLimit: 20, points: 1000, answers: [0, 1, 2, 3].map(() => ({ key: nid(), text: '', isCorrect: false })) });
const withKeys = (q) => ({ ...q, key: q.id || nid(), answers: q.answers.map((a) => ({ ...a, key: a.id || nid() })) });
const complete = (q) => { const f = q.answers.filter((a) => a.text.trim()); return !!q.text.trim() && f.length >= 2 && f.some((a) => a.isCorrect); };
const toPayload = (title, description, questions) => ({
  title: title.trim() || 'Untitled', description,
  questions: questions.map((q) => ({ text: q.text, imageUrl: q.imageUrl || null, timeLimit: q.timeLimit, points: q.points, answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })) })),
});

function QuestionCard({ q, index, onChange, onDuplicate, onDelete, onImage, uploading }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.key });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.85 : 1 };
  const fileRef = useRef(null);
  const ok = complete(q);
  const correctCount = q.answers.filter((a) => a.isCorrect).length;
  const setAnswer = (i, patch) => onChange({ ...q, answers: q.answers.map((a, k) => (k === i ? { ...a, ...patch } : a)) });
  const toggleCorrect = (i) => {
    // Click selects a single answer; click on another with Ctrl/Shift is not needed: use the multi switch below instead.
    const multi = correctCount > 1 || q.multiMode;
    onChange({ ...q, answers: q.answers.map((a, k) => (k === i ? { ...a, isCorrect: multi ? !a.isCorrect : true } : multi ? a : { ...a, isCorrect: false })) });
  };
  const addAnswer = () => q.answers.length < 6 && onChange({ ...q, answers: [...q.answers, { key: nid(), text: '', isCorrect: false }] });
  const removeAnswer = (i) => q.answers.length > 2 && onChange({ ...q, answers: q.answers.filter((_, k) => k !== i) });

  return (
    <div ref={setNodeRef} style={style} className={`card !p-4 sm:!p-5 ${ok ? '' : 'ring-4 ring-sun/70'}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button {...attributes} {...listeners} aria-label={t('edit.drag')} title={t('edit.drag')} className="cursor-grab touch-none rounded-xl p-2 text-ink/50 hover:bg-ink/10 active:cursor-grabbing"><GripVertical className="h-5 w-5" /></button>
        <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-grape-600 px-2 font-display text-lg text-white">{index + 1}</span>
        {!ok && <span className="inline-flex items-center gap-1 text-sm font-extrabold text-amber-600"><AlertTriangle className="h-4 w-4" />{t('edit.invalid')}</span>}
        <div className="ml-auto flex gap-1">
          <button onClick={onDuplicate} aria-label={t('common.duplicate')} title={t('common.duplicate')} className="rounded-xl p-2 text-ink/60 hover:bg-ink/10"><Copy className="h-5 w-5" /></button>
          <button onClick={onDelete} aria-label={t('common.delete')} title={t('common.delete')} className="rounded-xl p-2 text-coral hover:bg-coral/10"><Trash2 className="h-5 w-5" /></button>
        </div>
      </div>

      <textarea aria-label={t('edit.questionText')} placeholder={t('edit.questionText')} value={q.text} maxLength={300} rows={2} onChange={(e) => onChange({ ...q, text: e.target.value })}
        className="input !bg-grape-50 resize-none text-lg" />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-extrabold">
        <label className="inline-flex items-center gap-1.5 rounded-xl bg-grape-50 px-3 py-2"><Clock className="h-4 w-4" />
          <select aria-label={t('edit.timeLimit')} value={q.timeLimit} onChange={(e) => onChange({ ...q, timeLimit: Number(e.target.value) })} className="bg-transparent outline-none">
            {TIMES.map((s) => <option key={s} value={s}>{s} {t('common.seconds')}</option>)}
          </select></label>
        <label className="inline-flex items-center gap-1.5 rounded-xl bg-grape-50 px-3 py-2">{t('edit.points')}
          <select aria-label={t('edit.points')} value={q.points} onChange={(e) => onChange({ ...q, points: Number(e.target.value) })} className="bg-transparent outline-none">
            {[0, 500, 1000, 2000].concat([0, 500, 1000, 2000].includes(q.points) ? [] : [q.points]).map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-grape-50 px-3 py-2">
          <input type="checkbox" checked={correctCount > 1 || !!q.multiMode} disabled={correctCount > 1} onChange={(e) => onChange({ ...q, multiMode: e.target.checked })} className="h-4 w-4 accent-grape-600" />{t('edit.multi')}</label>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImage(f); }} />
        {q.imageUrl ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-grape-50 py-1 pl-1 pr-3">
            <img src={imgSrc(q.imageUrl)} alt="" className="h-8 w-8 rounded-lg object-cover" />
            <button onClick={() => onChange({ ...q, imageUrl: null })} className="inline-flex items-center gap-1 text-coral"><X className="h-4 w-4" />{t('edit.removeImage')}</button>
          </span>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-xl bg-grape-50 px-3 py-2 hover:bg-grape-100">{uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}{t('edit.uploadImage')}</button>
        )}
      </div>
      {q.imageUrl && <img src={imgSrc(q.imageUrl)} alt="" className="mt-3 max-h-48 rounded-2xl object-contain" />}

      <p className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-ink/50">{t('edit.correctHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.answers.map((a, i) => { const s = ANSWER_STYLES[i]; return (
          <div key={a.key} className={`flex items-center gap-2 rounded-2xl p-2 ${s.bg} ${s.dark ? 'text-ink' : 'text-white'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center"><Shape kind={s.shape} className="h-6 w-6" /></span>
            <input aria-label={`${t('edit.answer')} ${i + 1}`} placeholder={`${t('edit.answer')} ${i + 1}`} value={a.text} maxLength={120} onChange={(e) => setAnswer(i, { text: e.target.value })}
              className="min-w-0 flex-1 rounded-xl bg-white/90 px-3 py-2 font-bold text-ink outline-none placeholder:text-ink/40 focus:ring-4 focus:ring-white/60" />
            <button type="button" role="checkbox" aria-checked={a.isCorrect} aria-label={t('preview.correct')} onClick={() => toggleCorrect(i)}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-white ${a.isCorrect ? 'bg-white text-mint' : 'bg-transparent text-transparent hover:text-white/60'}`}><Check className="h-5 w-5" /></button>
            {q.answers.length > 2 && <button onClick={() => removeAnswer(i)} aria-label={t('common.delete')} className="rounded-lg p-1 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>}
          </div>); })}
      </div>
      {q.answers.length < 6 && <button onClick={addAnswer} className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-grape-600 hover:underline"><Plus className="h-4 w-4" />{t('edit.addAnswer')}</button>}
    </div>
  );
}

function ImportModal({ open, onClose, onAdd }) {
  const { t, err } = useI18n();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reset = () => { setRes(null); setError(''); };
  const pick = async (file) => {
    if (!file) return;
    setBusy(true); reset();
    try { const form = new FormData(); form.append('file', file); setRes(await api('/api/quizzes/import/parse', { method: 'POST', form })); }
    catch (e) { setError(e.data?.errors?.[0] ? t(`ie.${e.data.errors[0].code}`) : err(e.code)); } finally { setBusy(false); }
  };
  const close = () => { reset(); onClose(); };
  return (
    <Modal open={open} onClose={close} title={t('import.title')} wide>
      <p className="mb-3 text-sm font-bold text-ink/70">{t('import.hint')}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => download('/api/quizzes/template.xlsx', 'quiz-template.xlsx').catch((e) => setError(err(e.code)))} className="btn bg-grape-50 !py-2 text-sm text-grape-700 hover:bg-grape-100"><FileDown className="h-4 w-4" />{t('edit.template')}</button>
        <label className="btn-pink cursor-pointer !py-2 text-sm"><Upload className="h-4 w-4" />{t('import.choose')}
          <input type="file" hidden accept=".xlsx,.csv,.json" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
      </div>
      {busy && <div className="flex items-center gap-2 font-bold"><Spinner className="h-5 w-5" />{t('common.loading')}</div>}
      <ErrorNote>{error}</ErrorNote>
      {res && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-extrabold text-mint"><CheckCircle2 className="h-5 w-5" />{res.questions.length} {t('import.valid')}</p>
          {res.errors.length > 0 && (
            <div className="rounded-2xl bg-coral/10 p-3">
              <p className="mb-1 flex items-center gap-2 font-extrabold text-coral"><AlertTriangle className="h-4 w-4" />{t('import.errors')} ({res.errors.length}) — {t('import.blocked')}</p>
              <ul className="max-h-40 space-y-0.5 overflow-auto text-sm font-bold text-ink/80">
                {res.errors.map((e, i) => <li key={i}>{e.row > 0 ? `${t('import.row')} ${e.row}: ` : ''}{t(`ie.${e.code}`)}</li>)}
              </ul>
            </div>
          )}
          {res.questions.length === 0 ? <p className="font-bold text-ink/60">{t('import.none')}</p>
            : <button onClick={() => { onAdd(res.questions); close(); }} className="btn-green w-full"><Plus className="h-5 w-5" />{t('import.confirm')} ({res.questions.length})</button>}
        </div>
      )}
    </Modal>
  );
}

export default function Editor() {
  const { id } = useParams();
  const { t, err } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [uploading, setUploading] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const dirtyRef = useRef(false);
  const latest = useRef({});
  const bottomRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    api(`/api/quizzes/${id}`).then(({ quiz }) => { setTitle(quiz.title); setDescription(quiz.description || ''); setQuestions(quiz.questions.map(withKeys)); }).catch((e) => setError(err(e.code)));
  }, [id, err]);

  latest.current = { title, description, questions };
  const save = useCallback(async () => {
    const { title: ti, description: de, questions: qs } = latest.current;
    if (!qs) return;
    dirtyRef.current = false; setStatus('saving');
    try { await api(`/api/quizzes/${id}?draft=1`, { method: 'PUT', body: toPayload(ti, de, qs) }); setStatus(dirtyRef.current ? 'dirty' : 'saved'); setError(''); }
    catch (e) { setStatus('error'); setError(err(e.code)); }
  }, [id, err]);

  // Debounced autosave
  useEffect(() => {
    if (!dirtyRef.current) return undefined;
    const h = setTimeout(save, 1200);
    return () => clearTimeout(h);
  }, [title, description, questions, save]);
  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const mutate = (fn) => { dirtyRef.current = true; setStatus('dirty'); fn(); };
  const updateQ = (key, q) => mutate(() => setQuestions((qs) => qs.map((x) => (x.key === key ? q : x))));
  const addQ = () => { mutate(() => setQuestions((qs) => [...qs, blankQuestion()])); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50); };
  const dupQ = (key) => mutate(() => setQuestions((qs) => { const i = qs.findIndex((x) => x.key === key); const c = { ...qs[i], key: nid(), id: undefined, answers: qs[i].answers.map((a) => ({ ...a, key: nid(), id: undefined })) }; return [...qs.slice(0, i + 1), c, ...qs.slice(i + 1)]; }));
  const delQ = (key) => { if (window.confirm(t('common.confirmDelete'))) mutate(() => setQuestions((qs) => qs.filter((x) => x.key !== key))); };
  const onDragEnd = ({ active, over }) => { if (over && active.id !== over.id) mutate(() => setQuestions((qs) => arrayMove(qs, qs.findIndex((x) => x.key === active.id), qs.findIndex((x) => x.key === over.id)))); };
  const uploadImage = async (key, file) => {
    setUploading(key);
    try { const form = new FormData(); form.append('image', file); const d = await api('/api/quizzes/upload-image', { method: 'POST', form }); setQuestions((qs) => qs.map((x) => (x.key === key ? { ...x, imageUrl: d.url } : x))); dirtyRef.current = true; setStatus('dirty'); }
    catch (e) { setError(err(e.code)); } finally { setUploading(''); }
  };
  const importQs = (qs) => mutate(() => setQuestions((cur) => [...cur, ...qs.map(withKeys)]));
  const incomplete = useMemo(() => (questions || []).filter((q) => !complete(q)).length, [questions]);
  const ids = useMemo(() => (questions || []).map((q) => q.key), [questions]);

  if (!questions && !error) return <TeacherLayout><PageLoader /></TeacherLayout>;
  const badge = { saved: ['text-mint', t('common.saved')], dirty: ['text-sun', t('edit.autosave')], saving: ['text-white/80', t('common.saving')], error: ['text-coral', '!'] }[status];

  return (
    <TeacherLayout>
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-grape-900/90 px-4 py-3 backdrop-blur">
        <Link to="/dashboard" onClick={(e) => { if (dirtyRef.current) { e.preventDefault(); save().then(() => { window.location.assign('/dashboard'); }); } }} className="btn-ghost !px-3 !py-2" aria-label={t('common.back')}><ArrowLeft className="h-5 w-5" /></Link>
        <input aria-label={t('edit.title')} value={title} maxLength={120} onChange={(e) => mutate(() => setTitle(e.target.value))} placeholder={t('edit.title')} className="input-dark min-w-0 flex-1 !py-2 font-display text-xl" />
        <span className={`inline-flex items-center gap-1 text-sm font-extrabold ${badge[0]}`}>{status === 'saving' && <Spinner className="h-4 w-4" />}{badge[1]}</span>
        <button onClick={() => setImportOpen(true)} className="btn-ghost !py-2 text-sm"><Upload className="h-4 w-4" />{t('edit.import')}</button>
        <Link to={`/quiz/${id}/preview`} onClick={(e) => { if (dirtyRef.current) { e.preventDefault(); save().then(() => window.location.assign(`/quiz/${id}/preview`)); } }} className="btn-primary !py-2 text-sm"><Eye className="h-4 w-4" />{t('dash.preview')}</Link>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <input aria-label={t('edit.description')} value={description} maxLength={500} onChange={(e) => mutate(() => setDescription(e.target.value))} placeholder={t('edit.description')} className="input-dark mb-4" />
      {incomplete > 0 && <p className="mb-3 inline-flex items-center gap-2 rounded-xl bg-sun/20 px-3 py-2 text-sm font-extrabold text-sun"><AlertTriangle className="h-4 w-4" />{incomplete} — {t('edit.invalid')}</p>}

      {questions.length === 0 && <div className="glass mb-4 p-10 text-center font-extrabold text-white/80">{t('edit.noQuestions')}</div>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {questions.map((q, i) => <QuestionCard key={q.key} q={q} index={i} uploading={uploading === q.key} onChange={(nq) => updateQ(q.key, nq)} onDuplicate={() => dupQ(q.key)} onDelete={() => delQ(q.key)} onImage={(f) => uploadImage(q.key, f)} />)}
          </div>
        </SortableContext>
      </DndContext>
      <div ref={bottomRef} className="mt-5 flex justify-center">
        <button onClick={addQ} className="btn-pink !px-8 !py-4 text-lg"><Plus className="h-6 w-6" />{t('edit.addQuestion')}</button>
      </div>
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onAdd={importQs} />
    </TeacherLayout>
  );
}
