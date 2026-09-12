import { useEffect, useState } from 'react';
import { login, register, getSetupStatus } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';

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
    borderRadius: '8px',
    color: 'var(--tx1)',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div className="h-full flex" style={{ background: 'var(--bg)' }}>

      {/* Sol panel — Graphite editorial brand panel, monochrome with a single ember punctuation */}
      <div className="hidden lg:flex flex-col w-[420px] shrink-0 relative overflow-hidden"
        style={{ background: '#202020' }}>

        <div className="relative z-10 px-10 pt-10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--acc)' }} />
          <span className="font-serif text-sm" style={{ color: '#FFFFFF' }}>
            Rankify
          </span>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
          <div className="font-serif text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            T-Soft sıralama motoru
          </div>
          <h1 className="font-serif leading-[0.95]" style={{ fontSize: '36px', color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Akıllı<br />kategori<br />sıralama
          </h1>
          <p className="text-sm leading-relaxed mt-5" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '270px' }}>
            Stok, satış, yenilik ve yorum kriterlerine göre ürünlerinizi otomatik sıralayın.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { label: 'Smart Mix algoritması',    color: 'var(--acc-tx)' },
              { label: 'Ağırlıklı kriter sistemi', color: '#a68a4a' },
              { label: 'Anlık önizleme',            color: 'rgba(255,255,255,0.4)' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-10 pb-10">
          <div className="flex items-center gap-3">
            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.15)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>01</span>
          </div>
        </div>
      </div>

      {/* Sağ — form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[360px] animate-fade-up">

          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--acc)' }} />
            <span className="font-serif text-sm" style={{ color: 'var(--tx1)' }}>Rankify</span>
          </div>

          {/* Sekme geçişi — Navigation Pill Container pattern: Ash bg, fully round */}
          <div className="flex mb-8" style={{ background: 'var(--surface)', borderRadius: '200px', padding: '4px' }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="font-serif flex-1 py-2.5 text-[13px] transition-all"
                style={mode === m
                  ? { background: 'var(--cta-bg)', color: 'var(--cta-tx)', borderRadius: '200px' }
                  : { background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', borderRadius: '200px' }
                }
              >
                {m === 'login' ? 'Giriş Yap' : 'Üye Ol'}
              </button>
            ))}
          </div>

          {mode === 'register' ? (
            <>
              <h2 className="font-serif mb-1" style={{ fontSize: '28px', color: 'var(--tx1)', lineHeight: 1.2 }}>
                Hesap oluştur
              </h2>
              <p className="text-[13px] mb-8" style={{ color: 'var(--tx3)' }}>
                Kendi mağazanızı yönetmek için üye olun
              </p>
            </>
          ) : (
            <>
              <h2 className="font-serif mb-1" style={{ fontSize: '28px', color: 'var(--tx1)', lineHeight: 1.2 }}>
                Hoş geldiniz
              </h2>
              <p className="text-[13px] mb-8" style={{ color: 'var(--tx3)' }}>
                Hesabınıza giriş yapın
              </p>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input type="text" placeholder="Ad Soyad"
                value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx1)'; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
              />
            )}
            <input type="email" placeholder="E-posta adresi" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm focus:outline-none transition-all"
              style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx1)'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
            />
            <input type="password" placeholder="Şifre" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm focus:outline-none transition-all"
              style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx1)'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
            />

            {error && (
              <div className="px-4 py-3 text-[13px]"
                style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading} className="!py-3.5 mt-1">
              {loading ? 'Bekleniyor…' : mode === 'register' ? 'Üye Ol' : 'Giriş Yap'}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-1.5 mt-10">
            {(['var(--acc)', '#816729', '#828282'] as const).map((color, i) => (
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
