import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/authApi';
import { DEMO_SESSION_TOKEN } from '../api';
import { DEMO_PERSONAS, type AuthUser, type DemoPersona } from './demoPersonas';

const DEMO_PERSONA_KEY = 'demo-persona';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  startDemo: (persona?: DemoPersona) => void;
  logout: () => void;
  isDemo: boolean;
  demoPersona: DemoPersona | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Session key: an Important Message, once acknowledged, must stay hidden only
// until the next real login (not every page refresh). Clearing this on every
// successful login - and nowhere else - gives exactly that behavior without a
// server-side "seen" table. See ImportantMessageModal.
export const ACK_STORAGE_KEY = 'acknowledgedMessageIds';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [demoPersona, setDemoPersona] = useState<DemoPersona | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    if (token === DEMO_SESSION_TOKEN) {
      const storedPersona = localStorage.getItem(DEMO_PERSONA_KEY) as DemoPersona | null;
      const persona = storedPersona && DEMO_PERSONAS[storedPersona] ? storedPersona : 'ceo';
      setUser(DEMO_PERSONAS[persona]);
      setIsDemo(true);
      setDemoPersona(persona);
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((me) => setUser(me as AuthUser))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    localStorage.setItem('token', result.token);
    localStorage.removeItem(DEMO_PERSONA_KEY);
    setIsDemo(false);
    setDemoPersona(null);
    sessionStorage.removeItem(ACK_STORAGE_KEY);
    setUser({ _id: result._id, name: result.name, email: result.email, role: result.role });
  }, []);

  const startDemo = useCallback((persona: DemoPersona = 'ceo') => {
    localStorage.setItem('token', DEMO_SESSION_TOKEN);
    localStorage.setItem(DEMO_PERSONA_KEY, persona);
    sessionStorage.removeItem(ACK_STORAGE_KEY);
    setIsDemo(true);
    setDemoPersona(persona);
    setUser(DEMO_PERSONAS[persona]);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem(DEMO_PERSONA_KEY);
    sessionStorage.removeItem(ACK_STORAGE_KEY);
    setUser(null);
    setIsDemo(false);
    setDemoPersona(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, startDemo, logout, isDemo, demoPersona }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
