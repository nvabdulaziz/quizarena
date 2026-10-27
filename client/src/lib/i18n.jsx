import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dict } from './dict.js';

const Ctx = createContext(null);
export const useI18n = () => useContext(Ctx);
export const LANGS = [{ code: 'uz', label: "O'zbek" }, { code: 'ru', label: 'Русский' }, { code: 'en', label: 'English' }];

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => { try { return localStorage.getItem('qa_lang') || 'uz'; } catch { return 'uz'; } });
  const setLang = useCallback((l) => { setLangState(l); try { localStorage.setItem('qa_lang', l); } catch { /* ignore */ } }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback((key, vars) => {
    let s = dict[lang]?.[key] ?? dict.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);
  // Server error codes -> localized message
  const err = useCallback((code) => dict[lang]?.[`err.${code}`] ?? dict[lang]?.['err.SERVER_ERROR'], [lang]);

  return <Ctx.Provider value={{ lang, setLang, t, err }}>{children}</Ctx.Provider>;
}
