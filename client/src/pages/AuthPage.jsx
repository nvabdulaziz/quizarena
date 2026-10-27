import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Background, ErrorNote, LangSwitch, Logo, Spinner } from '../components/ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function AuthPage({ mode }) {
  const { t, err } = useI18n();
  const { teacher, authenticate } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isReg = mode === 'register';
  if (teacher) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await authenticate(mode, isReg ? f : { email: f.email, password: f.password });
      nav(loc.state?.from || '/dashboard', { replace: true });
    } catch (ex) { setError(err(ex.code)); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Background>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5"><Logo /><LangSwitch /></header>
      <div className="mx-auto grid max-w-md px-4 pb-16 pt-6">
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card space-y-4 !p-7">
          <h1 className="font-display text-3xl">{t(isReg ? 'auth.register' : 'auth.login')}</h1>
          {isReg && <div><label className="mb-1 block text-sm font-extrabold" htmlFor="name">{t('auth.name')}</label><input id="name" className="input !bg-grape-50" required minLength={2} maxLength={80} value={f.name} onChange={set('name')} autoComplete="name" /></div>}
          <div><label className="mb-1 block text-sm font-extrabold" htmlFor="email">{t('auth.email')}</label><input id="email" type="email" className="input !bg-grape-50" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
          <div><label className="mb-1 block text-sm font-extrabold" htmlFor="pw">{t('auth.password')}</label><input id="pw" type="password" className="input !bg-grape-50" required minLength={isReg ? 8 : 1} value={f.password} onChange={set('password')} autoComplete={isReg ? 'new-password' : 'current-password'} /></div>
          <ErrorNote>{error}</ErrorNote>
          <button disabled={busy} className="btn-pink w-full">{busy && <Spinner className="h-5 w-5" />}{t(isReg ? 'auth.register' : 'auth.login')}</button>
          <p className="text-center text-sm font-bold text-ink/70">
            {t(isReg ? 'auth.haveAccount' : 'auth.noAccount')}{' '}
            <Link className="text-grape-600 underline" to={isReg ? '/login' : '/register'}>{t(isReg ? 'auth.login' : 'auth.register')}</Link>
          </p>
          <p className="text-center text-xs font-bold text-ink/50">{t('auth.studentsNote')}</p>
        </motion.form>
      </div>
    </Background>
  );
}
