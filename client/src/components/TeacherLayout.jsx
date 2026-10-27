import { Link, NavLink, useNavigate } from 'react-router-dom';
import { History, LayoutGrid, LogOut } from 'lucide-react';
import { Background, Logo, LangSwitch } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function TeacherLayout({ children }) {
  const { t } = useI18n();
  const { teacher, logout } = useAuth();
  const nav = useNavigate();
  const link = ({ isActive }) => `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold ${isActive ? 'bg-white text-ink' : 'bg-white/10 hover:bg-white/20'}`;
  return (
    <Background>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Logo to="/dashboard" />
        <nav className="flex flex-wrap items-center gap-2">
          <NavLink to="/dashboard" className={link}><LayoutGrid className="h-4 w-4" />{t('nav.dashboard')}</NavLink>
          <NavLink to="/history" className={link}><History className="h-4 w-4" />{t('nav.history')}</NavLink>
          <LangSwitch />
          <button onClick={() => { logout(); nav('/'); }} className="btn-ghost !px-3 !py-2 text-sm" title={teacher?.email}><LogOut className="h-4 w-4" />{t('nav.logout')}</button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
    </Background>
  );
}
