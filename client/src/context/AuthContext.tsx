import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AuthUser } from '../api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  sessionReady: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);
  // sessionReady: false until the server-side cookie is verified (prevents stale localStorage flash)
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { userId: number; email: string; role: string } | null) => {
        if (data) {
          const fresh: AuthUser = { id: data.userId, email: data.email, role: data.role as AuthUser['role'] };
          localStorage.setItem('user', JSON.stringify(fresh));
          setUser(fresh);
        } else {
          localStorage.removeItem('user');
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setSessionReady(true));
  }, []);

  const setAuth = useCallback((_token: string, u: AuthUser) => {
    // token artık localStorage'da saklanmıyor — httpOnly cookie ile yönetiliyor
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ user, sessionReady, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
