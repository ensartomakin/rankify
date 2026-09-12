import { useEffect, useState } from 'react';
import { listUsers, createUser, deleteUser, type UserItem } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Pill, Button, Spinner, KpiStrip } from '../components/ui';

const MAX_REGULAR_USERS = 3;

function RoleBadge({ role }: { role: UserItem['role'] }) {
  if (role === 'super_admin') {
    return (
      <Pill variant="accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        Süper Admin
      </Pill>
    );
  }
  return <Pill variant="neutral">Kullanıcı</Pill>;
}

interface AddUserFormProps {
  onAdd: (user: UserItem) => void;
  onCancel: () => void;
}

function AddUserForm({ onAdd, onCancel }: AddUserFormProps) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await createUser(email, password, name || undefined);
      onAdd(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition-all';
  const inputSt  = { background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)' };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg p-6 space-y-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--acc-bg)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--tx3)' }}>
          Yeni Kullanıcı
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>Ad Soyad</label>
          <input type="text" placeholder="Ad Soyad"
            value={name} onChange={e => setName(e.target.value)}
            className={inputCls} style={inputSt}
            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc)'; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>E-posta</label>
          <input type="email" placeholder="kullanici@sirket.com" required
            value={email} onChange={e => setEmail(e.target.value)}
            className={inputCls} style={inputSt}
            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc)'; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>Şifre</label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} placeholder="En az 8 karakter" required
            value={password} onChange={e => setPassword(e.target.value)}
            className={inputCls + ' pr-16'} style={inputSt}
            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc)'; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }} />
          <button type="button" onClick={() => setShowPass(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
            style={{ color: 'var(--tx2)' }}>
            {showPass ? 'Gizle' : 'Göster'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-[13px]"
          style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>İptal</Button>
        <Button type="submit" variant="primary" fullWidth disabled={loading} loading={loading}>
          {loading ? 'Ekleniyor…' : 'Kullanıcı Ekle'}
        </Button>
      </div>
    </form>
  );
}

export function Users() {
  const { user: currentUser } = useAuth();
  const [users,      setUsers]      = useState<UserItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteErr,  setDeleteErr]  = useState('');

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleAdded(user: UserItem) {
    setUsers(prev => [...prev, user]);
    setShowForm(false);
  }

  async function handleDelete(id: number) {
    setDeletingId(id); setDeleteErr('');
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'Silme hatası');
    } finally {
      setDeletingId(null);
    }
  }

  const regularCount = users.filter(u => u.role === 'user').length;
  const canAdd = regularCount < MAX_REGULAR_USERS;

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-sm" style={{ color: 'var(--tx2)' }}>
      <Spinner size={20} />
      Yükleniyor…
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div style={{ paddingLeft: '28px', paddingRight: '28px' }}>
        <PageHeader
          eyebrow="Ekip"
          title="Kullanıcılar"
          action={!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              disabled={!canAdd}
              title={!canAdd ? `En fazla ${MAX_REGULAR_USERS} kullanıcı eklenebilir` : undefined}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Kullanıcı Ekle
            </Button>
          )}
        />
      </div>

      <KpiStrip items={[
        { label: 'Toplam Hesap', value: `${users.length} / 4` },
        { label: 'Kullanıcı Kotası', value: `${regularCount} / ${MAX_REGULAR_USERS}` },
        { label: 'Süper Admin', value: users.filter(u => u.role === 'super_admin').length, tone: 'var(--acc-tx)' },
      ]} />

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto py-6 space-y-6 animate-fade-up" style={{ paddingLeft: '28px', paddingRight: '28px' }}>

        {/* Kullanıcı ekleme formu */}
        {showForm && (
          <AddUserForm
            onAdd={handleAdded}
            onCancel={() => setShowForm(false)}
          />
        )}

        {deleteErr && (
          <div className="px-4 py-3 rounded-lg text-[13px]"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            {deleteErr}
          </div>
        )}

        {/* Kullanıcı listesi */}
        <div className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)' }}>
          {users.map((u, idx) => {
            const isCurrentUser = u.id === currentUser?.id;
            const isDeleting    = deletingId === u.id;
            const initials = (u.name ?? u.email).slice(0, 2).toUpperCase();

            return (
              <div key={u.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors"
                style={{
                  background: 'var(--surface)',
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={{
                    background: u.role === 'super_admin' ? 'var(--acc)' : 'var(--surface2)',
                    color: u.role === 'super_admin' ? '#FFFFFF' : 'var(--tx2)',
                    border: u.role === 'super_admin' ? '1px solid var(--acc-hov)' : '1px solid var(--border)',
                  }}>
                  {initials}
                </div>

                {/* Bilgi */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--tx1)' }}>
                      {u.name ?? u.email.split('@')[0]}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--surface2)', color: 'var(--tx3)', border: '1px solid var(--border)' }}>
                        Siz
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--tx3)' }}>{u.email}</div>
                </div>

                {/* Rol */}
                <RoleBadge role={u.role} />

                {/* Sil butonu — super_admin silinemez, kendi hesabınızı silemezsiniz */}
                {u.role !== 'super_admin' && !isCurrentUser && (
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={isDeleting}
                    className="p-2 rounded-lg transition-all shrink-0"
                    style={{ color: 'var(--tx3)' }}
                    title="Kullanıcıyı sil"
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--err-tx)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--err-bg)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--tx3)';
                      (e.currentTarget as HTMLElement).style.background = '';
                    }}
                  >
                    {isDeleting ? (
                      <span className="w-4 h-4 border-2 rounded-full animate-spin block"
                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--err-tx)' }} />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bilgi notu */}
        <div className="rounded-lg px-5 py-4 text-xs space-y-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: 'var(--tx2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Yetki Sistemi
          </div>
          <div style={{ color: 'var(--tx3)' }}>Süper admin API bağlantı bilgilerini düzenleyebilir.</div>
          <div style={{ color: 'var(--tx3)' }}>Kullanıcılar sıralama, kategori ve zamanlama işlemlerini yönetebilir.</div>
          <div style={{ color: 'var(--tx3)' }}>Sisteme en fazla 1 süper admin + 3 kullanıcı eklenebilir.</div>
        </div>
      </div>
      </div>
    </div>
  );
}
