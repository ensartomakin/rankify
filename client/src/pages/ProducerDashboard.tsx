import { useEffect, useState } from 'react';
import {
  listTenants, createTenant, updateTenant, deleteTenant,
  listTenantUsers, createTenantUser, deleteTenantUser, impersonateTenant,
  type Tenant, type TenantUser,
} from '../api/producer';
import { useAuth } from '../context/AuthContext';

// ── Yardımcı bileşenler ──────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={active
        ? { background: 'rgba(132,154,40,0.12)', color: '#849A28', border: '1px solid rgba(132,154,40,0.3)' }
        : { background: 'var(--surface2)', color: 'var(--tx3)', border: '1px solid var(--border)' }
      }>
      {active ? 'Aktif' : 'Pasif'}
    </span>
  );
}

function Spinner() {
  return (
    <span className="w-4 h-4 border-2 rounded-full animate-spin inline-block"
      style={{ borderColor: 'var(--border)', borderTopColor: 'var(--acc)' }} />
  );
}

// ── Tenant satırı ────────────────────────────────────────────────────────────

function TenantRow({ tenant, onSelect, onToggle, onDelete }: {
  tenant: Tenant;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface2)]"
      style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>{tenant.name}</span>
          <Badge active={tenant.isActive} />
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--tx3)' }}>
          /{tenant.slug} · {tenant.userCount ?? 0}/{tenant.maxUsers} kullanıcı
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onSelect}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
          style={{ background: 'var(--acc-bg)', color: 'var(--acc)', border: '1px solid rgba(226,50,96,0.2)' }}>
          Yönet
        </button>
        <button onClick={onToggle}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
          style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
          {tenant.isActive ? 'Pasifleştir' : 'Aktifleştir'}
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: 'var(--tx3)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--err-tx)';
            (e.currentTarget as HTMLElement).style.background = 'var(--err-bg)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--tx3)';
            (e.currentTarget as HTMLElement).style.background = '';
          }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Yeni Tenant formu ────────────────────────────────────────────────────────

function NewTenantForm({ onCreated, onCancel }: { onCreated: (t: Tenant) => void; onCancel: () => void }) {
  const [name,     setName]     = useState('');
  const [slug,     setSlug]     = useState('');
  const [maxUsers, setMaxUsers] = useState(5);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function autoSlug(n: string) {
    return n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const tenant = await createTenant({ name, slug, maxUsers });
      onCreated(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally { setLoading(false); }
  }

  const inputSt = { background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)' };
  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all';

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>Yeni Marka Ekle</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--tx2)' }}>Marka Adı</label>
          <input required value={name} onChange={e => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }}
            placeholder="Örnek A.Ş." className={inputCls} style={inputSt} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--tx2)' }}>Slug</label>
          <input required value={slug} onChange={e => setSlug(e.target.value)}
            placeholder="ornek-as" className={inputCls} style={inputSt} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--tx2)' }}>Maks. Kullanıcı</label>
        <input type="number" min={1} max={100} value={maxUsers} onChange={e => setMaxUsers(parseInt(e.target.value, 10))}
          className={inputCls} style={inputSt} />
      </div>
      {error && (
        <div className="px-4 py-3 rounded-xl text-[13px]"
          style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
          İptal
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={loading ? { background: 'var(--surface2)', cursor: 'not-allowed' } : { background: '#E23260' }}>
          {loading ? <Spinner /> : 'Ekle'}
        </button>
      </div>
    </form>
  );
}

// ── Tenant detay paneli ──────────────────────────────────────────────────────

function TenantDetail({ tenant, onBack, onImpersonate }: {
  tenant: Tenant;
  onBack: () => void;
  onImpersonate: (t: Tenant) => void;
}) {
  const [users,      setUsers]      = useState<TenantUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [name,       setName]       = useState('');
  const [role,       setRole]       = useState<'super_admin' | 'user'>('super_admin');
  const [formErr,    setFormErr]    = useState('');
  const [formLoad,   setFormLoad]   = useState(false);
  const [impLoad,    setImpLoad]    = useState(false);

  useEffect(() => {
    listTenantUsers(tenant.id).then(setUsers).finally(() => setLoading(false));
  }, [tenant.id]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(''); setFormLoad(true);
    try {
      const u = await createTenantUser(tenant.id, { email, password, name: name || undefined, role });
      setUsers(prev => [...prev, u]);
      setShowForm(false);
      setEmail(''); setPassword(''); setName('');
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Hata');
    } finally { setFormLoad(false); }
  }

  async function handleDeleteUser(uid: number) {
    await deleteTenantUser(tenant.id, uid);
    setUsers(prev => prev.filter(u => u.id !== uid));
  }

  async function handleImpersonate() {
    setImpLoad(true);
    try { onImpersonate(tenant); }
    finally { setImpLoad(false); }
  }

  const inputSt  = { background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)' };
  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg" style={{ background: 'var(--surface2)', color: 'var(--tx2)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--tx1)' }}>{tenant.name}</h2>
          <div className="text-xs" style={{ color: 'var(--tx3)' }}>/{tenant.slug}</div>
        </div>
        <button onClick={handleImpersonate} disabled={impLoad}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold"
          style={{ background: 'rgba(226,50,96,0.1)', color: '#E23260', border: '1px solid rgba(226,50,96,0.25)' }}>
          {impLoad ? <Spinner /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
          Bu Markaya Giriş Yap
        </button>
      </div>

      {/* Kullanıcı listesi */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>
            Kullanıcılar ({users.length}/{tenant.maxUsers})
          </span>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: '#E23260', color: '#fff' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Kullanıcı Ekle
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddUser} className="px-5 py-4 space-y-3"
            style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ad Soyad"
                className={inputCls} style={inputSt} />
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-posta"
                className={inputCls} style={inputSt} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Şifre (min 8 karakter)" className={inputCls} style={inputSt} />
              <select value={role} onChange={e => setRole(e.target.value as 'super_admin' | 'user')}
                className={inputCls} style={inputSt}>
                <option value="super_admin">Süper Admin</option>
                <option value="user">Kullanıcı</option>
              </select>
            </div>
            {formErr && (
              <div className="px-3 py-2 rounded-xl text-[12px]"
                style={{ background: 'var(--err-bg)', color: 'var(--err-tx)' }}>{formErr}</div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--surface)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
                İptal
              </button>
              <button type="submit" disabled={formLoad}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#E23260' }}>
                {formLoad ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--tx2)' }}>
            <Spinner /> Yükleniyor…
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--tx3)' }}>
            Henüz kullanıcı yok
          </div>
        ) : users.map((u, idx) => (
          <div key={u.id} className="flex items-center gap-4 px-5 py-3"
            style={{ background: 'var(--surface)', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold"
              style={{
                background: u.role === 'super_admin' ? '#E23260' : 'var(--surface2)',
                color: u.role === 'super_admin' ? '#fff' : 'var(--tx2)',
              }}>
              {(u.name ?? u.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--tx1)' }}>{u.name ?? u.email.split('@')[0]}</div>
              <div className="text-[11px]" style={{ color: 'var(--tx3)' }}>{u.email}</div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={u.role === 'super_admin'
                ? { background: 'rgba(226,50,96,0.1)', color: '#E23260' }
                : { background: 'var(--surface2)', color: 'var(--tx2)' }}>
              {u.role === 'super_admin' ? 'Süper Admin' : 'Kullanıcı'}
            </span>
            {u.role !== 'super_admin' && (
              <button onClick={() => handleDeleteUser(u.id)}
                className="p-1.5 rounded-lg" style={{ color: 'var(--tx3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--err-tx)'; (e.currentTarget as HTMLElement).style.background = 'var(--err-bg)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tx3)'; (e.currentTarget as HTMLElement).style.background = ''; }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ana sayfa ────────────────────────────────────────────────────────────────

export function ProducerDashboard() {
  const { setAuth, logout } = useAuth();
  const [tenants,     setTenants]     = useState<Tenant[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [selected,    setSelected]    = useState<Tenant | null>(null);
  const [impErr,      setImpErr]      = useState('');

  useEffect(() => {
    listTenants().then(setTenants).finally(() => setLoading(false));
  }, []);

  function handleCreated(t: Tenant) {
    setTenants(prev => [{ ...t, userCount: 0 }, ...prev]);
    setShowForm(false);
  }

  async function handleToggle(tenant: Tenant) {
    const updated = await updateTenant(tenant.id, { isActive: !tenant.isActive });
    setTenants(prev => prev.map(t => t.id === updated.id ? { ...updated, userCount: t.userCount } : t));
  }

  async function handleDelete(tenant: Tenant) {
    if (!confirm(`"${tenant.name}" markasını ve tüm kullanıcılarını silmek istediğinize emin misiniz?`)) return;
    await deleteTenant(tenant.id);
    setTenants(prev => prev.filter(t => t.id !== tenant.id));
    if (selected?.id === tenant.id) setSelected(null);
  }

  async function handleImpersonate(tenant: Tenant) {
    setImpErr('');
    try {
      const res = await impersonateTenant(tenant.id);
      setAuth(res.token, { ...res.user, role: 'super_admin', tenantId: tenant.id });
    } catch (err) {
      setImpErr(err instanceof Error ? err.message : 'Hata');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: '#E23260' }} />
          <span className="font-serif text-sm font-semibold" style={{ color: 'var(--tx1)' }}>Rankify</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(226,50,96,0.1)', color: '#E23260' }}>Üretici Paneli</span>
        </div>
        <button onClick={logout} className="text-[13px] font-semibold" style={{ color: 'var(--tx2)' }}>
          Çıkış Yap
        </button>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-8 space-y-6">
        {/* Başlık */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>Markalar</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--tx2)' }}>
              {tenants.length} marka · Toplam kullanıcı: {tenants.reduce((s, t) => s + (t.userCount ?? 0), 0)}
            </p>
          </div>
          {!selected && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#E23260', boxShadow: '0 3px 12px rgba(226,50,96,0.3)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Marka Ekle
            </button>
          )}
        </div>

        {impErr && (
          <div className="px-4 py-3 rounded-xl text-[13px]"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            {impErr}
          </div>
        )}

        {showForm && (
          <NewTenantForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        )}

        {selected ? (
          <TenantDetail
            tenant={selected}
            onBack={() => setSelected(null)}
            onImpersonate={handleImpersonate}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: 'var(--tx2)' }}>
            <Spinner /> Yükleniyor…
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-2xl py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--tx2)' }}>Henüz marka yok</div>
            <div className="text-[13px]" style={{ color: 'var(--tx3)' }}>İlk markanızı ekleyerek başlayın</div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-widest"
              style={{ background: 'var(--surface)', color: 'var(--tx3)', borderBottom: '1px solid var(--border)' }}>
              Tüm Markalar
            </div>
            {tenants.map(t => (
              <TenantRow
                key={t.id}
                tenant={t}
                onSelect={() => setSelected(t)}
                onToggle={() => handleToggle(t)}
                onDelete={() => handleDelete(t)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
