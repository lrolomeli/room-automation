import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [authed, setAuthed] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/api/auth/me')
      .then((data) => {
        if (!alive) return;
        setUser(data?.user || null);
        setAuthed(true);
      })
      .catch(() => {
        if (alive) setAuthed(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    await api.post('/api/auth/login', { username, password });
    const data = await api.get('/api/auth/me').catch(() => null);
    setUser(data?.user || null);
    setAuthed(true);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    setAuthed(false);
  }, []);

  return (
    <SessionContext.Provider value={{ authed, user, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider');
  return ctx;
}
