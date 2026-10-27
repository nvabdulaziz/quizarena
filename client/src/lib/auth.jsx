import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/api/auth/me').then((d) => setTeacher(d.teacher)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(async (mode, body) => {
    const d = await api(`/api/auth/${mode}`, { method: 'POST', body });
    setToken(d.token); setTeacher(d.teacher);
  }, []);
  const logout = useCallback(() => { setToken(null); setTeacher(null); }, []);

  return <Ctx.Provider value={{ teacher, loading, authenticate, logout }}>{children}</Ctx.Provider>;
}
