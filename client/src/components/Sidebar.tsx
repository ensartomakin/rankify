import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

type Page = 'dashboard' | 'configs' | 'audit' | 'settings' | 'users';

interface Props {
  current: Page;
  onChange: (p: Page) => void;
  credentialsConfigured?: boolean;
  isSuperAdmin?: boolean;
}

const NAV: { key: Page; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  {
    key: 'dashboard', label: 'Sıralama',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h4M3 12h10M3 17h6M15 7h6M17 12h4M15 17h6" />
      </svg>
    ),
  },
  {
    key: 'configs', label: 'Kategoriler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    key: 'audit', label: 'Geçmiş',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'settings', label: 'Ayarlar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'users', label: 'Kullanıcılar', adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

export function Sidebar({ current, onChange, credentialsConfigured, isSuperAdmin }: Props) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const initials = (user?.name ?? user?.email ?? 'U').slice(0, 2).toUpperCase();

  return (
    <aside
      className="h-full flex flex-col shrink-0 overflow-hidden transition-all duration-300 rounded-2xl"
      style={{
        width: collapsed ? '68px' : '230px',
        background: 'var(--sb-bg)',
        margin: '0',
      }}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        {/* Logo */}
        {collapsed ? (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#E23260' }}>
              <span className="text-white font-bold text-sm font-serif">R</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#E23260' }}>
              <span className="text-white font-bold text-sm font-serif">R</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight leading-none font-serif" style={{ color: '#1E3309' }}>
                Rankify
              </div>
              <div className="text-[9px] font-semibold mt-0.5 tracking-widest uppercase" style={{ color: '#A04060' }}>
                T-Soft
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle — sağda */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all"
            style={{ color: '#A04060', background: 'rgba(226,50,96,0.08)' }}
            title="Daralt"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Collapsed expand button */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setCollapsed(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: '#A04060', background: 'rgba(226,50,96,0.08)' }}
            title="Genişlet"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}

      {/* Thin divider */}
      <div style={{ height: '1px', background: 'var(--sb-border)', margin: '0 16px 16px' }} />

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] px-2 pb-2 pt-0.5"
            style={{ color: '#A04060' }}>
            Menü
          </div>
        )}

        {NAV.filter(item => !item.adminOnly || isSuperAdmin).map(item => {
          const active = current === item.key;
          const warn   = item.key === 'settings' && !credentialsConfigured;

          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                gap: collapsed ? '0' : '9px',
                padding: collapsed ? '9px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'var(--sb-act-bg)' : 'transparent',
                color: active ? '#1E3309' : 'var(--sb-tx)',
                border: active ? '1px solid #F8CDD5' : '1px solid transparent',
                boxShadow: active ? '0 1px 4px rgba(226,50,96,0.1)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--tx2)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--sb-tx)';
                }
              }}
            >
              {item.icon}
              {!collapsed && <span className="flex-1 text-left text-[13px]">{item.label}</span>}
              {!collapsed && warn && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--tx3)' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-2 pb-2">
        <button
          onClick={toggle}
          title={collapsed ? (theme === 'dark' ? 'Açık Tema' : 'Koyu Tema') : undefined}
          className="w-full flex items-center rounded-lg text-[13px] font-medium transition-all"
          style={{
            gap: collapsed ? '0' : '9px',
            padding: collapsed ? '9px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--sb-tx)',
            border: '1px solid transparent',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--sb-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--tx2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--sb-tx)';
          }}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-[17px] h-[17px] shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
          {!collapsed && (theme === 'dark' ? 'Açık Tema' : 'Koyu Tema')}
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--sb-border)', margin: '0 16px 12px' }} />

      {/* User */}
      <div className="px-2 pb-5">
        <div
          className="flex items-center rounded-lg"
          style={{
            gap: collapsed ? '0' : '9px',
            padding: collapsed ? '8px 0' : '9px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{
              background: '#E23260',
              color: '#FFFFFF',
              border: '1px solid #C82050',
            }}
            title={collapsed ? (user?.name ?? user?.email) : undefined}
          >
            {initials}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate leading-none" style={{ color: '#1E3309' }}>
                  {user?.name ?? user?.email?.split('@')[0]}
                </div>
                <div className="text-[10px] truncate mt-0.5 leading-none" style={{ color: '#A04060' }}>
                  {user?.role === 'super_admin' ? 'Süper Admin' : user?.email}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-md transition-all shrink-0"
                style={{ color: 'var(--sb-tx)' }}
                title="Çıkış"
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--err-tx)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--err-bg)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--sb-tx)';
                  (e.currentTarget as HTMLElement).style.background = '';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </button>
            </>
          )}
        </div>

        {collapsed && (
          <button
            onClick={logout}
            className="w-full flex justify-center p-2 rounded-md transition-all mt-1"
            style={{ color: 'var(--sb-tx)' }}
            title="Çıkış"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--err-tx)';
              (e.currentTarget as HTMLElement).style.background = 'var(--err-bg)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--sb-tx)';
              (e.currentTarget as HTMLElement).style.background = '';
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
