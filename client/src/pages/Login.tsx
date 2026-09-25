import { useEffect, useState } from 'react';
import { login, register, getSetupStatus } from '../api/auth';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register';

export function Login() {
  const { setAuth } = useAuth();
  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    getSetupStatus()
      .then(s => { if (s.needsSetup) setMode('register'); })
      .catch(() => {});
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = mode === 'register'
        ? await register(email, password, name || undefined)
        : await login(email, password);
      setAuth(res.token ?? '', res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg)',
    border: '1px solid var(--border-strong)',
    color: 'var(--tx1)',
    fontFamily: "'Work Sans', sans-serif",
  };

  return (
    <div className="h-full flex" style={{ background: 'var(--bg)' }}>

      {/* Sol panel — Deep Space Violet hero stage */}
      <div className="hidden lg:flex flex-col w-[400px] shrink-0 relative overflow-hidden"
        style={{ background: 'var(--sb-bg)' }}>

        <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, var(--hero-glow-teal) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 100%, var(--hero-glow-violet) 0%, transparent 65%)' }} />

        <div className="relative z-10 px-10 pt-10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--acc)' }} />
          <span className="text-sm font-semibold tracking-tight font-serif" style={{ color: 'var(--sb-tx-act)' }}>
            Rankify
          </span>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
          <h1 className="font-serif leading-[1.1] mb-5"
            style={{ fontSize: 'var(--text-display)', color: 'var(--sb-tx-act)' }}>
            Akıllı<br />
            Kategori<br />
            <em>Sıralama</em>
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--hero-tx-muted)', maxWidth: '260px', letterSpacing: '-0.028em' }}>
            Stok, satış, yenilik ve yorum kriterlerine göre ürünlerinizi otomatik sıralayın.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { label: 'Smart Mix algoritması',    color: 'var(--acc)' },
              { label: 'Ağırlıklı kriter sistemi', color: 'var(--hero-dot-2)' },
              { label: 'Anlık önizleme',            color: 'var(--hero-dot-3)' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[length:var(--text-caption)]" style={{ color: 'var(--hero-tx-soft)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-10 pb-10">
          <div className="flex items-center gap-3">
            <div style={{ height: '1px', flex: 1, background: 'var(--hero-rule)' }} />
            <span className="text-mini font-medium" style={{ color: 'var(--hero-tx-faint)' }}>01</span>
          </div>
        </div>
      </div>

      {/* Sağ — form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[400px] flex flex-col gap-6 animate-fade-up">

          <div className="lg:hidden flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--acc)' }} />
            <span className="text-sm font-semibold font-serif" style={{ color: 'var(--tx1)' }}>Rankify</span>
          </div>

          {/* Sekme geçişi — tab radius per spec is 8px, not pill */}
          <div className="flex rounded-lg p-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 h-9 flex items-center justify-center rounded-lg text-[length:var(--text-caption)] font-medium transition-all"
                style={mode === m
                  ? { background: 'var(--cta-bg)', color: 'var(--cta-tx)' }
                  : { background: 'transparent', color: 'var(--tx2)', cursor: 'pointer' }
                }
              >
                {m === 'login' ? 'Giriş Yap' : 'Üye Ol'}
              </button>
            ))}
          </div>

          {mode === 'register' ? (
            <div className="flex flex-col gap-1.5">
              <h2 className="font-serif" style={{ fontSize: 'var(--text-title)', color: 'var(--tx1)', lineHeight: 1.2 }}>
                Hesap Oluştur
              </h2>
              <p className="text-[length:var(--text-caption)]" style={{ color: 'var(--tx2)' }}>
                Kendi mağazanızı yönetmek için üye olun
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <h2 className="font-serif" style={{ fontSize: 'var(--text-title)', color: 'var(--tx1)', lineHeight: 1.2 }}>
                Hoş geldiniz
              </h2>
              <p className="text-[length:var(--text-caption)]" style={{ color: 'var(--tx2)' }}>
                Hesabınıza giriş yapın
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'register' && (
              <input type="text" placeholder="Ad Soyad"
                value={name} onChange={e => setName(e.target.value)}
                className="w-full h-11 px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx1)'; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
              />
            )}
            <input type="email" placeholder="E-posta adresi" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
              style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx1)'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
            />
            <input type="password" placeholder="Şifre" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
              style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx1)'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
            />

            {error && (
              <div className="px-4 py-3 rounded-lg text-[length:var(--text-caption)]"
                style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-11 flex items-center justify-center rounded-lg text-[length:var(--text-caption)] font-medium transition-all"
              style={loading
                ? { background: 'var(--surface3)', cursor: 'not-allowed', color: 'var(--tx3)', border: '1px solid var(--border)' }
                : { background: 'var(--cta-bg)', color: 'var(--cta-tx)', border: 'none', cursor: 'pointer' }
              }>
              {loading ? 'Bekleniyor…' : mode === 'register' ? 'Üye Ol' : 'Giriş Yap'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5">
            {(['var(--acc)', 'var(--hero-dot-2)', 'var(--hero-dot-3)'] as const).map((color, i) => (
              <div key={i} className="rounded-full transition-all"
                style={{
                  width: i === 0 ? '20px' : '6px',
                  height: '6px',
                  background: color,
                }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
