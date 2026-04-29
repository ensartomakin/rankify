import { useEffect, useState } from 'react';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Configs } from './pages/Configs';
import { Audit } from './pages/Audit';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { fetchCredentials } from './api/settings';
import type { SavedConfig } from './api/config';

type Page = 'dashboard' | 'configs' | 'audit' | 'settings' | 'users';

function AppShell() {
  const { user, sessionReady } = useAuth();
  const [page,       setPage]       = useState<Page>('dashboard');
  const [prefill,    setPrefill]    = useState<SavedConfig | undefined>();
  const [configured, setConfigured] = useState<boolean | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!user) return;
    fetchCredentials()
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, [user]);

  if (!sessionReady) return null; // cookie doğrulanana kadar flash yok
  if (!user) return <Login />;

  function handleEdit(config: SavedConfig) {
    setPrefill(config);
    setPage('dashboard');
  }

  function handlePageChange(p: Page) {
    if (p !== 'dashboard') setPrefill(undefined);
    setPage(p);
  }

  return (
    <div className="flex h-full w-full" style={{ background: 'var(--bg)', gap: '20px', padding: 'clamp(6px,2vw,12px) clamp(6px,2vw,16px) clamp(6px,2vw,12px) clamp(6px,2vw,12px)' }}>
      <Sidebar
        current={page}
        onChange={handlePageChange}
        credentialsConfigured={configured ?? true}
        isSuperAdmin={isSuperAdmin}
      />

      {/* On mobile: full width, no left sidebar gap, add bottom padding for tab bar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl pb-[60px] md:pb-0"
        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', boxShadow: '0 4px 24px rgba(226,50,96,0.12)' }}>
        {configured === false && page !== 'settings' && (
          <div className="shrink-0 flex items-center justify-between px-6 py-2.5 text-sm"
            style={{ background: 'var(--warn-bg)', borderBottom: '1px solid var(--warn-bd)', color: 'var(--warn-tx)' }}>
            <span>⚠️ T-Soft bağlantı bilgileri tanımlı değil — sıralama çalışmaz.</span>
            {isSuperAdmin && (
              <button
                onClick={() => handlePageChange('settings')}
                className="underline text-xs font-semibold transition-colors"
                style={{ color: 'var(--warn-tx)' }}
              >
                Ayarlara git →
              </button>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {page === 'dashboard' && <Dashboard prefill={prefill} />}
          {page === 'configs'   && <Configs onEdit={handleEdit} />}
          {page === 'audit'     && <Audit />}
          {page === 'settings'  && <Settings onSaved={() => setConfigured(true)} />}
          {page === 'users'     && isSuperAdmin && <Users />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
