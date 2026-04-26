import { useAuth } from '../context/AuthContext';

type Page = 'dashboard' | 'configs' | 'audit' | 'settings';

interface Props {
  current: Page;
  onChange: (p: Page) => void;
  credentialsConfigured?: boolean;
}

const LINKS: { key: Page; label: string }[] = [
  { key: 'dashboard', label: 'Sıralama' },
  { key: 'configs',   label: 'Kategoriler' },
  { key: 'audit',     label: 'Geçmiş' },
  { key: 'settings',  label: 'Ayarlar' },
];

export function Navbar({ current, onChange, credentialsConfigured }: Props) {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <span className="font-bold text-slate-900 text-lg tracking-tight">Rankify</span>

      <div className="flex gap-1">
        {LINKS.map(l => (
          <button
            key={l.key}
            onClick={() => onChange(l.key)}
            className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              current === l.key
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {l.label}
            {l.key === 'settings' && !credentialsConfigured && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 hidden sm:block">
          {user?.name ?? user?.email}
        </span>
        <button
          onClick={logout}
          className="text-sm text-slate-400 hover:text-red-500 transition-colors"
        >
          Çıkış
        </button>
      </div>
    </nav>
  );
}
