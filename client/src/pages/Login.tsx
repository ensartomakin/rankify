import { useState } from 'react';
import { login, register } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { setAuth } = useAuth();
  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = mode === 'login'
        ? await login(email, password)
        : await register(email, password, name || undefined);
      setAuth(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex" style={{ background: 'var(--bg)' }}>

      {/* Left — Charleston dark green panel */}
      <div className="hidden lg:flex flex-col w-[400px] shrink-0 relative overflow-hidden"
        style={{ background: '#1E3309' }}>

        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(226,50,96,0.18) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 100%, rgba(132,154,40,0.22) 0%, transparent 65%)' }} />

        {/* Logo */}
        <div className="relative z-10 px-10 pt-10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#E23260' }} />
          <span className="text-sm font-semibold tracking-tight font-serif" style={{ color: '#FFFFFF' }}>
            Rankify
          </span>
        </div>

        {/* Main copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-6"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            T-Soft Sıralama Motoru
          </div>
          <h1 className="font-serif leading-[1.1] mb-5"
            style={{ fontSize: '40px', fontWeight: 400, color: '#FFFFFF' }}>
            Akıllı<br />
            Kategori<br />
            Sıralama
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', maxWidth: '260px' }}>
            Stok, satış, yenilik ve yorum kriterlerine göre ürünlerinizi otomatik sıralayın.
          </p>

          {/* Feature list */}
          <div className="mt-10 space-y-4">
            {[
              { label: 'Smart Mix algoritması',    color: '#E23260' },
              { label: 'Ağırlıklı kriter sistemi', color: '#849A28' },
              { label: 'Anlık önizleme',            color: '#FCA9AA' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.75)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom mark */}
        <div className="relative z-10 px-10 pb-10">
          <div className="flex items-center gap-3">
            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.15)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>01</span>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[360px] animate-fade-up">

          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#E23260' }} />
            <span className="text-sm font-semibold font-serif" style={{ color: 'var(--tx1)' }}>Rankify</span>
          </div>

          <h2 className="font-serif mb-1" style={{ fontSize: '28px', fontWeight: 400, color: 'var(--tx1)', lineHeight: 1.2 }}>
            {mode === 'login' ? 'Hoş geldiniz' : 'Hesap oluştur'}
          </h2>
          <p className="text-[13px] mb-8" style={{ color: 'var(--tx2)' }}>
            {mode === 'login' ? 'Hesabınıza giriş yapın' : 'Yeni bir Rankify hesabı oluşturun'}
          </p>

          {/* Mode toggle */}
          <div className="flex rounded-full p-0.5 mb-7"
            style={{ background: 'var(--surface3)', border: '1px solid var(--border)' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 rounded-full text-[13px] font-medium transition-all"
                style={mode === m
                  ? { background: '#E23260', color: '#FFFFFF', boxShadow: '0 1px 6px rgba(226,50,96,0.35)' }
                  : { color: 'var(--tx2)', background: 'transparent' }
                }>
                {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input type="text" placeholder="Ad Soyad"
                value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--tx1)',
                  fontFamily: 'Inter, sans-serif',
                }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E23260'; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              />
            )}
            <input type="email" placeholder="E-posta adresi" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--tx1)',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E23260'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            />
            <input type="password" placeholder="Şifre" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--tx1)',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E23260'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            />

            {error && (
              <div className="px-4 py-3 rounded-xl text-[13px]"
                style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl text-[13px] font-semibold transition-all mt-1"
              style={loading
                ? { background: 'var(--surface3)', cursor: 'not-allowed', color: 'var(--tx3)', border: '1px solid var(--border)' }
                : { background: '#E23260', color: '#FFFFFF', border: 'none', cursor: 'pointer', boxShadow: '0 3px 16px rgba(226,50,96,0.38)' }
              }>
              {loading ? 'Bekleniyor…' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </button>
          </form>

          {/* Step dots — palette colors */}
          <div className="flex items-center justify-center gap-1.5 mt-10">
            {(['#E23260', '#849A28', '#FCA9AA'] as const).map((color, i) => (
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
