import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/authApi';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  startDemo: () => void;
  logout: () => void;
  isDemo: boolean;
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    if (token === 'demo-local-session') {
      setUser({ _id: 'demo-pm', name: 'Maya Pratap', email: 'maya@pratap.ai', role: 'Super Admin', department: 'Operations' });
      setIsDemo(true);
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
    setIsDemo(false);
    sessionStorage.removeItem(ACK_STORAGE_KEY);
    setUser({ _id: result._id, name: result.name, email: result.email, role: result.role });
  }, []);

  const startDemo = useCallback(() => {
    localStorage.setItem('token', 'demo-local-session');
    sessionStorage.removeItem(ACK_STORAGE_KEY);
    setIsDemo(true);
    setUser({ _id: 'demo-pm', name: 'Maya Pratap', email: 'maya@pratap.ai', role: 'Super Admin', department: 'Operations' });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem(ACK_STORAGE_KEY);
    setUser(null);
    setIsDemo(false);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, startDemo, logout, isDemo }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
