import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Background, ErrorNote, LangSwitch, Logo, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { emit, getSocket } from '../lib/socket.js';
import { useI18n } from '../lib/i18n.jsx';

export const saveSession = (s) => { try { localStorage.setItem('qa_player', JSON.stringify(s)); } catch { /* ignore */ } };
export const loadSession = () => { try { return JSON.parse(localStorage.getItem('qa_player')); } catch { return null; } };
export const clearSession = () => { try { localStorage.removeItem('qa_player'); } catch { /* ignore */ } };

export default function Join() {
  const { pin: pinParam } = useParams();
  const { t, err } = useI18n();
  const nav = useNavigate();
  const [pin, setPin] = useState(pinParam && /^\d{6}$/.test(pinParam) ? pinParam : '');
  const [step, setStep] = useState('pin');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const checkPin = async (value) => {
    setBusy(true); setError('');
    try {
      const d = await api(`/api/public/pin/${value}`);
      if (!d.open) throw Object.assign(new Error(), { code: 'GAME_STARTED' });
      if (d.full) throw Object.assign(new Error(), { code: 'ROOM_FULL' });
      setStep('nick');
    } catch (e) { setError(err(e.code)); } finally { setBusy(false); }
  };
  // Arrived through the QR code: validate the PIN automatically.
  useEffect(() => { if (pin.length === 6 && pinParam) checkPin(pin); /* eslint-disable-next-line */ }, []);

  const submitPin = (e) => { e.preventDefault(); if (/^\d{6}$/.test(pin)) checkPin(pin); else setError(err('INVALID_PIN')); };
  const submitNick = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const s = getSocket();
    if (!s.connected) { s.connect(); await new Promise((r) => (s.connected ? r() : s.once('connect', r))); }
    const res = await emit('player:join', { pin, nickname: nick });
    setBusy(false);
    if (res.error) return setError(err(res.error));
    saveSession({ pin: res.pin, token: res.token, nickname: res.nickname });
    nav('/play');
  };

  return (
    <Background>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5"><Logo /><LangSwitch /></header>
      <div className="mx-auto grid max-w-sm px-4 pb-16 pt-6">
        <AnimatePresence mode="wait">
          {step === 'pin' ? (
            <motion.form key="pin" onSubmit={submitPin} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} className="card space-y-4 !p-7 text-center">
              <h1 className="font-display text-3xl">{t('join.pin')}</h1>
              <input autoFocus inputMode="numeric" pattern="\d{6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('join.pinPlaceholder')} aria-label="PIN"
                className="input !bg-grape-50 text-center font-display text-4xl tracking-[0.3em]" />
              <ErrorNote>{error}</ErrorNote>
              <button disabled={busy || pin.length !== 6} className="btn-pink w-full">{busy && <Spinner className="h-5 w-5" />}{busy ? t('join.checking') : t('join.enter')}</button>
            </motion.form>
          ) : (
            <motion.form key="nick" onSubmit={submitNick} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className="card space-y-4 !p-7 text-center">
              <h1 className="font-display text-3xl">{t('join.nickname')}</h1>
              <p className="font-extrabold text-ink/50">PIN {pin}</p>
              <input autoFocus value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder={t('join.nickPlaceholder')} aria-label={t('join.nickname')} className="input !bg-grape-50 text-center text-xl" />
              <ErrorNote>{error}</ErrorNote>
              <button disabled={busy || !nick.trim()} className="btn-green w-full">{busy && <Spinner className="h-5 w-5" />}{t('join.go')}</button>
              <button type="button" onClick={() => { setStep('pin'); setError(''); }} className="inline-flex items-center gap-1 text-sm font-extrabold text-ink/60 hover:underline"><ArrowLeft className="h-4 w-4" />{t('common.back')}</button>
            </motion.form>
          )}
        </AnimatePresence>
        <Link to="/" className="mt-6 text-center text-sm font-bold text-white/60 hover:text-white">{t('app.name')}</Link>
      </div>
    </Background>
  );
}
