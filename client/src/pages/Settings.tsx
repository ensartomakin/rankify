import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCredentials, saveCredentials, testCredentials, fetchFieldMapping, saveFieldMapping, type CredentialsPayload, type FieldMappingInfo } from '../api/settings';
import { fetchGa4Status, fetchGa4AuthUrl, openGa4OAuthPopup, saveGa4PropertyId, deleteGa4Credentials, testGa4Connection, syncGa4Metrics, type Ga4Status } from '../api/ga4';
import { formatDateTime, formatRelative } from '../utils/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Users } from './Users';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';
type SectionId  = 'baglanti' | 'alan-eslemesi' | 'ga4' | 'kullanicilar' | 'guvenlik';

interface Props { onSaved?: () => void; }

export { getStoredThreshold } from '../utils/threshold';

const RANGE_LABELS: Record<string, string> = {
  '1d': 'Son 1 gün', '3d': 'Son 3 gün', '7d': 'Son 7 gün', '14d': 'Son 14 gün', '21d': 'Son 21 gün',
  '30d': 'Son 30 gün', '60d': 'Son 60 gün', '90d': 'Son 90 gün',
};
const GA4_METRICS = ['Görüntülenme', 'Sepete Ekleme', 'Dönüşüm Oranı'];

/* ─── Small building blocks ─────────────────────────────────────────────── */
const inputCls = 'w-full h-11 px-3.5 rounded-lg text-sm focus:outline-none transition-colors';
const inputSt  = { background: 'var(--input-bg)', border: '1px solid var(--border-strong)', color: 'var(--tx1)' };
const btnBase  = 'h-10 px-4 rounded-lg text-caption font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap';
const primarySt = (off: boolean): React.CSSProperties => off
  ? { background: 'var(--cta-bg)', color: 'var(--cta-tx)', opacity: 0.5, cursor: 'not-allowed', border: '1px solid transparent' }
  : { background: 'var(--cta-bg)', color: 'var(--cta-tx)', cursor: 'pointer', border: '1px solid transparent' };
const outlineSt = (off: boolean): React.CSSProperties => ({
  background: 'transparent', color: off ? 'var(--tx3)' : 'var(--tx1)', border: '1px solid var(--border-strong)',
  cursor: off ? 'not-allowed' : 'pointer',
});

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" aria-hidden="true" />;
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-caption font-medium" style={{ color: 'var(--tx2)' }}>{label}</span>
      {children}
      {hint && <span className="block text-label" style={{ color: 'var(--tx3)' }}>{hint}</span>}
    </label>
  );
}

/* Inline result line under a button: ✓ green / ✕ red, optional technical details. */
function ResultLine({ status, message, details }: { status: 'ok' | 'fail' | 'testing' | 'info'; message: string; details?: string }) {
  const [open, setOpen] = useState(false);
  const color = status === 'ok' ? 'var(--ok-tx)' : status === 'fail' ? 'var(--err-tx)' : 'var(--tx2)';
  return (
    <div role="status" className="text-caption" style={{ color }}>
      <span className="inline-flex items-center gap-1.5 font-medium">
        {status === 'testing' ? <Spinner /> : status === 'ok' ? '✓' : status === 'fail' ? '✕' : null}
        {message}
      </span>
      {details && (
        <>
          {' '}
          <button type="button" onClick={() => setOpen(o => !o)} className="underline text-label"
            style={{ background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}>
            {open ? 'Ayrıntıyı gizle' : 'Ayrıntı'}
          </button>
          {open && <div className="mt-1 text-label font-mono break-all" style={{ color: 'var(--tx3)' }}>{details}</div>}
        </>
      )}
    </div>
  );
}

function Section({ title, description, badge, children }: {
  title: string; description?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>{title}</h2>
          {description && <p className="text-caption mt-1" style={{ color: 'var(--tx2)' }}>{description}</p>}
        </div>
        {badge}
      </header>
      {children}
    </section>
  );
}

function StatusChip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label font-semibold shrink-0"
      style={ok
        ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
        : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx3)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {children}
    </span>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export function Settings({ onSaved }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Bağlantı
  const [form,       setForm]       = useState<CredentialsPayload>({ apiUrl: '', storeCode: '', apiUser: '', apiPass: '', apiToken: '' });
  const [savedForm,  setSavedForm]  = useState<CredentialsPayload | null>(null);
  const [configured,      setConfigured]      = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [credsUpdatedAt,  setCredsUpdatedAt]  = useState<string | null>(null);
  const [storeName,       setStoreName]       = useState('');
  const [loading,    setLoading]    = useState(true);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMsg,    setTestMsg]    = useState('');
  const [testDebug,  setTestDebug]  = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMsg,    setSaveMsg]    = useState('');
  const [showPass,   setShowPass]   = useState(false);

  // Alan eşlemesi
  const [fieldMap,       setFieldMap]       = useState<FieldMappingInfo | null>(null);
  const [seasonField,    setSeasonField]    = useState('');
  const [mapSaveStatus,  setMapSaveStatus]  = useState<SaveStatus>('idle');
  const [mapSaveMsg,     setMapSaveMsg]     = useState('');

  // GA4
  const [ga4Status,     setGa4Status]     = useState<Ga4Status | null>(null);
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  const [ga4Editing,    setGa4Editing]    = useState(false);
  const [ga4Connecting, setGa4Connecting] = useState(false);
  const [ga4ConnMsg,    setGa4ConnMsg]    = useState('');
  const [ga4ConnOk,     setGa4ConnOk]     = useState<boolean | null>(null);
  const [ga4PropStatus, setGa4PropStatus] = useState<SaveStatus>('idle');
  const [ga4TestStatus, setGa4TestStatus] = useState<TestStatus>('idle');
  const [ga4TestMsg,    setGa4TestMsg]    = useState('');
  const [ga4SyncStatus, setGa4SyncStatus] = useState<SyncStatus>('idle');
  const [ga4SyncMsg,    setGa4SyncMsg]    = useState('');
  const [confirmGa4Delete, setConfirmGa4Delete] = useState(false);

  // Seçili bölüm — adreste (#ga4 …) tutulur, yenilemede aynı bölüm açılır
  const [section, setSection] = useState<SectionId>(() => {
    const h = window.location.hash.replace('#', '') as SectionId;
    return (['baglanti', 'alan-eslemesi', 'ga4', 'kullanicilar', 'guvenlik'] as SectionId[]).includes(h) ? h : 'baglanti';
  });
  function go(id: SectionId) {
    setSection(id);
    try { history.replaceState(null, '', `#${id}`); } catch { /* ignore */ }
  }

  function refreshGa4() {
    return fetchGa4Status().then(s => {
      setGa4Status(s);
      if (s.propertyId) setGa4PropertyId(s.propertyId);
    }).catch(() => {});
  }

  useEffect(() => {
    Promise.all([
      fetchCredentials().then(data => {
        setConfigured(data.configured);
        setStoreName(data.storeName ?? '');
        if (data.configured) {
          const f = { apiUrl: data.apiUrl, storeCode: data.storeCode, apiUser: data.apiUser, apiPass: '', apiToken: '' };
          setForm(f); setSavedForm(f);
          setTokenConfigured(data.apiToken === '••••••••');
          setCredsUpdatedAt(data.updatedAt ?? null);
        }
      }),
      refreshGa4(),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchFieldMapping()
      .then(info => { setFieldMap(info); setSeasonField(info.mapping.season); })
      .catch(() => setFieldMap(null));
  }, [isSuperAdmin, configured]);

  function set(key: keyof CredentialsPayload, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setTestStatus('idle'); setSaveStatus('idle');
  }

  const canSubmit = Boolean(form.apiUrl && form.storeCode && form.apiUser && (form.apiPass || configured));

  // Kaydedilmemiş değişiklikler (menüde nokta)
  const connDirty = isSuperAdmin && (
    !savedForm
      ? Boolean(form.apiUrl || form.storeCode || form.apiUser || form.apiPass || form.apiToken)
      : form.apiUrl !== savedForm.apiUrl || form.storeCode !== savedForm.storeCode || form.apiUser !== savedForm.apiUser
        || Boolean(form.apiPass) || Boolean(form.apiToken)
  );
  const mapDirty = Boolean(fieldMap && seasonField !== fieldMap.mapping.season);
  const ga4Dirty = Boolean(ga4Status?.configured && ga4PropertyId.trim() !== (ga4Status.propertyId ?? ''));

  async function handleTest() {
    if (!canSubmit) return;
    setTestStatus('testing'); setTestMsg(''); setTestDebug('');
    try {
      const r = await testCredentials(form);
      setTestStatus(r.ok ? 'ok' : 'fail'); setTestMsg(r.message); setTestDebug(r.debug ?? '');
    } catch (err) { setTestStatus('fail'); setTestMsg(err instanceof Error ? err.message : 'Bağlantı testi başarısız'); }
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSaveStatus('saving'); setSaveMsg('');
    try {
      await saveCredentials(form);
      setSaveStatus('saved'); setSaveMsg('Bağlantı bilgileri kaydedildi.');
      setConfigured(true); onSaved?.();
      const f = { ...form, apiPass: '', apiToken: '' };
      if (form.apiToken) setTokenConfigured(true);
      setForm(f); setSavedForm(f);
      setCredsUpdatedAt(new Date().toISOString());
    } catch (err) {
      setSaveStatus('error'); setSaveMsg(err instanceof Error ? err.message : 'Kayıt hatası');
    }
  }

  async function handleSaveFieldMapping() {
    setMapSaveStatus('saving'); setMapSaveMsg('');
    try {
      await saveFieldMapping({ season: seasonField });
      setFieldMap(f => f && { ...f, mapping: { season: seasonField } });
      setMapSaveStatus('saved'); setMapSaveMsg('Alan eşlemesi kaydedildi.');
    } catch (e) {
      setMapSaveStatus('error'); setMapSaveMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  }

  async function handleGa4Connect() {
    setGa4Connecting(true); setGa4ConnMsg(''); setGa4ConnOk(null);
    try {
      const url   = await fetchGa4AuthUrl();
      const email = await openGa4OAuthPopup(url);
      setGa4ConnOk(true); setGa4ConnMsg(`${email} bağlandı`);
      await refreshGa4();
    } catch (err) {
      setGa4ConnOk(false); setGa4ConnMsg(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally { setGa4Connecting(false); }
  }

  async function handleGa4SaveProperty() {
    if (!ga4PropertyId.trim()) return;
    setGa4PropStatus('saving');
    try {
      await saveGa4PropertyId(ga4PropertyId.trim());
      setGa4PropStatus('saved');
      setGa4Status(s => s ? { ...s, ready: true, propertyId: ga4PropertyId.trim() } : s);
      setGa4Editing(false);
    } catch { setGa4PropStatus('error'); }
  }

  async function handleGa4Delete() {
    setConfirmGa4Delete(false);
    try {
      await deleteGa4Credentials();
      setGa4Status(s => s ? { ...s, configured: false, ready: false, googleEmail: null, propertyId: null, lastSync: null, ranges: [] } : s);
      setGa4PropertyId(''); setGa4TestStatus('idle'); setGa4ConnMsg(''); setGa4ConnOk(null); setGa4Editing(false);
    } catch { /* ignore */ }
  }

  async function handleGa4Test() {
    setGa4TestStatus('testing'); setGa4TestMsg('');
    try {
      const r = await testGa4Connection();
      setGa4TestStatus(r.ok ? 'ok' : 'fail'); setGa4TestMsg(r.message);
    } catch { setGa4TestStatus('fail'); setGa4TestMsg('Bağlantı testi başarısız'); }
  }

  async function handleGa4Sync() {
    setGa4SyncStatus('syncing'); setGa4SyncMsg('');
    try {
      const r = await syncGa4Metrics();
      const failed = r.results?.filter(x => x.error) ?? [];
      setGa4SyncStatus(failed.length ? 'error' : 'done');
      setGa4SyncMsg(failed.length
        ? `${r.count} ürün metriği güncellendi; başarısız: ${failed.map(f => RANGE_LABELS[f.range] ?? f.range).join(', ')}`
        : `${r.count} ürün metriği güncellendi.`);
      await refreshGa4();
    } catch (err) {
      setGa4SyncStatus('error'); setGa4SyncMsg(err instanceof Error ? err.message : 'Senkronizasyon hatası');
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-sm" style={{ color: 'var(--tx2)' }}>
      <Spinner /> Yükleniyor…
    </div>
  );

  const nav: { id: SectionId; label: string; dirty?: boolean; show: boolean }[] = [
    { id: 'baglanti',      label: 'Bağlantı',           dirty: connDirty, show: true },
    { id: 'alan-eslemesi', label: 'Alan Eşlemesi',      dirty: mapDirty,  show: isSuperAdmin },
    { id: 'ga4',           label: 'Google Analytics 4', dirty: ga4Dirty,  show: true },
    { id: 'kullanicilar',  label: 'Kullanıcılar',                         show: isSuperAdmin },
    { id: 'guvenlik',      label: 'Güvenlik',                             show: true },
  ];
  const visibleNav = nav.filter(n => n.show);
  const current = visibleNav.some(n => n.id === section) ? section : 'baglanti';
  const readOnly = !isSuperAdmin;
  const ro = { opacity: readOnly ? 0.7 : 1 };
  const ga4Setup = Boolean(ga4Status?.ready) && !ga4Editing;
  const ga4Ranges = (ga4Status?.ranges ?? []).filter(r => r.used || r.lastSync);

  return (
    <div className="h-full overflow-y-auto">
      <ConfirmDialog open={confirmGa4Delete} danger
        title="Google Analytics bağlantısı kaldırılsın mı?"
        description="Google hesabı bağlantısı ve senkronize edilmiş tüm GA4 metrikleri silinir."
        warning={ga4Status?.usedBy && ga4Status.usedBy.length > 0
          ? `Şu ${ga4Status.usedBy.length} kategori GA4 kriteri kullanıyor: ${ga4Status.usedBy.map(c => c.categoryName || c.categoryId).join(', ')}. Bağlantı yeniden kurulana ya da kriterler değiştirilene kadar bu kategoriler sıralanamaz (mağazadaki sıraları korunur).`
          : undefined}
        confirmLabel="Kaldır"
        onConfirm={handleGa4Delete}
        onCancel={() => setConfirmGa4Delete(false)} />

      <div className="py-8 animate-fade-up" style={{ paddingLeft: 'var(--spacing-page)', paddingRight: 'var(--spacing-page)' }}>
        {/* Başlık */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>Ayarlar</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--tx2)' }}>Mağaza bağlantısı, veri kaynakları ve hesaplar</p>
          </div>
          {readOnly && (
            <span className="inline-flex items-center gap-1.5 text-label font-medium px-2.5 py-1 rounded-full"
              style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Salt okunur — yalnızca Süper Admin düzenleyebilir
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          {/* Alt menü: masaüstünde solda dikey, dar ekranda üstte yatay */}
          <nav aria-label="Ayar bölümleri"
            className="w-full md:w-[200px] shrink-0 md:sticky md:top-4 flex md:flex-col gap-1 overflow-x-auto">
            {visibleNav.map(n => {
              const active = n.id === current;
              return (
                <button key={n.id} type="button" onClick={() => go(n.id)} aria-current={active ? 'page' : undefined}
                  className="flex items-center justify-between gap-2 h-9 px-3 rounded-lg text-caption font-semibold text-left whitespace-nowrap transition-colors"
                  style={active
                    ? { background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: 'none', cursor: 'pointer' }
                    : { background: 'transparent', color: 'var(--tx2)', border: 'none', cursor: 'pointer' }}>
                  {n.label}
                  {n.dirty && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--warn-tx)' }}
                      title="Kaydedilmemiş değişiklik" aria-label="Kaydedilmemiş değişiklik" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 min-w-0 w-full max-w-[760px]">
            {/* ── Bağlantı ── */}
            {current === 'baglanti' && (
              <Section title="Bağlantı" description="Mağazanızın altyapısı ve API bilgileri"
                badge={<StatusChip ok={configured}>{configured ? 'Bağlı' : 'Bağlı değil'}</StatusChip>}>
                {readOnly ? (
                  /* Diğer kullanıcılar API ayrıntılarını görmez: kısa özet */
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-caption">
                    <dt style={{ color: 'var(--tx3)' }}>Altyapı</dt>
                    <dd className="font-medium" style={{ color: 'var(--tx1)' }}>T-Soft</dd>
                    <dt style={{ color: 'var(--tx3)' }}>Mağaza</dt>
                    <dd className="font-medium" style={{ color: 'var(--tx1)' }}>{configured ? (storeName || '—') : 'Henüz bağlanmadı — Süper Admin bağlantıyı kurmalı'}</dd>
                  </dl>
                ) : (<>
                <Field label="Altyapı" hint="Diğer altyapılar yakında eklenecek.">
                  <select value="tsoft" disabled className={inputCls} style={{ ...inputSt, opacity: 0.8, cursor: 'not-allowed' }}>
                    <option value="tsoft">T-Soft</option>
                  </select>
                </Field>

                <Field label="API URL" hint={<>Sadece alan adı — örn: <code style={{ color: 'var(--tx2)' }}>https://he-qa.com</code></>}>
                  <input type="url" placeholder="https://markaadi.com" autoComplete="off"
                    value={form.apiUrl} onChange={e => set('apiUrl', e.target.value)}
                    disabled={readOnly} className={inputCls} style={{ ...inputSt, ...ro }} />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Mağaza Kodu">
                    <input type="text" placeholder="STORE01" autoComplete="off"
                      value={form.storeCode} onChange={e => set('storeCode', e.target.value)}
                      disabled={readOnly} className={inputCls} style={{ ...inputSt, ...ro }} />
                  </Field>
                  <Field label="API Kullanıcısı">
                    <input type="text" placeholder="kullanici@markaadi.com" autoComplete="off"
                      value={form.apiUser} onChange={e => set('apiUser', e.target.value)}
                      disabled={readOnly} className={inputCls} style={{ ...inputSt, ...ro }} />
                  </Field>
                </div>

                <Field
                  label={<>V3 API Token{tokenConfigured && <span className="font-normal" style={{ color: 'var(--tx3)' }}> · kayıtlı, değiştirmek için doldurun</span>}</>}
                  hint="T-Soft yönetim paneli → Ayarlar → API Token">
                  <input type="text" autoComplete="off"
                    placeholder={tokenConfigured ? '••••••••' : 'Kalıcı API token — 2FA olmadan V3 erişimi'}
                    value={form.apiToken ?? ''} onChange={e => set('apiToken' as keyof CredentialsPayload, e.target.value)}
                    disabled={readOnly} className={inputCls} style={{ ...inputSt, ...ro }} />
                </Field>

                <Field
                  label={<>API Şifresi{configured && <span className="font-normal" style={{ color: 'var(--tx3)' }}> · değiştirmek için doldurun</span>}</>}
                  hint={<span className="inline-flex items-center gap-1">🔒 AES-256-GCM ile şifrelenir; düz metin olarak saklanmaz ve loglara yazılmaz.</span>}>
                  <span className="relative block">
                    <input type={showPass ? 'text' : 'password'} autoComplete="new-password"
                      placeholder={configured ? '••••••••' : 'Şifrenizi girin'}
                      value={form.apiPass} onChange={e => set('apiPass', e.target.value)}
                      disabled={readOnly} className={inputCls + ' pr-16'} style={{ ...inputSt, ...ro }} />
                    {!readOnly && (
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-label font-semibold"
                        style={{ background: 'transparent', border: 'none', color: 'var(--tx2)', cursor: 'pointer' }}>
                        {showPass ? 'Gizle' : 'Göster'}
                      </button>
                    )}
                  </span>
                </Field>

                {!readOnly && (
                  <div className="flex flex-wrap items-start justify-between gap-3 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex flex-col gap-2 min-w-0">
                      <button type="button" onClick={handleTest} disabled={!canSubmit || testStatus === 'testing'}
                        className={btnBase} style={outlineSt(!canSubmit || testStatus === 'testing')}>
                        {testStatus === 'testing' && <Spinner />} Bağlantıyı Test Et
                      </button>
                      {testStatus !== 'idle' && (
                        <ResultLine status={testStatus === 'testing' ? 'testing' : testStatus}
                          message={testStatus === 'testing' ? 'Test ediliyor…' : testMsg} details={testDebug || undefined} />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button type="button" onClick={handleSave} disabled={!canSubmit || saveStatus === 'saving'}
                        className={btnBase + ' px-6'} style={primarySt(!canSubmit || saveStatus === 'saving')}>
                        {saveStatus === 'saving' && <Spinner />} Kaydet
                      </button>
                      {(saveStatus === 'saved' || saveStatus === 'error') && (
                        <ResultLine status={saveStatus === 'saved' ? 'ok' : 'fail'} message={saveMsg} />
                      )}
                    </div>
                  </div>
                )}
                </>)}
              </Section>
            )}

            {/* ── Alan Eşlemesi ── */}
            {current === 'alan-eslemesi' && (
              <Section title="Alan Eşlemesi" description="Mağazanızdaki hangi alanın hangi ürün bilgisine karşılık geldiği">
                {!fieldMap?.configured ? (
                  <p className="text-caption" style={{ color: 'var(--tx3)' }}>Önce Bağlantı bölümünden mağaza bağlantısını kaydedin.</p>
                ) : (
                  <>
                    <Field label="Sezon etiketi alanı"
                      hint="Sezon ön-sıralamasında kullanılan sezon etiketi ürünün bu alanından okunur.">
                      <select value={seasonField} onChange={e => { setSeasonField(e.target.value); setMapSaveStatus('idle'); }}
                        className={inputCls} style={inputSt}>
                        {fieldMap.options.season.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </Field>
                    <div className="flex flex-col items-end gap-2 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                      <button type="button" onClick={handleSaveFieldMapping}
                        disabled={mapSaveStatus === 'saving' || !mapDirty}
                        className={btnBase + ' px-6'} style={primarySt(mapSaveStatus === 'saving' || !mapDirty)}>
                        {mapSaveStatus === 'saving' && <Spinner />} Kaydet
                      </button>
                      {(mapSaveStatus === 'saved' || mapSaveStatus === 'error') && (
                        <ResultLine status={mapSaveStatus === 'saved' ? 'ok' : 'fail'} message={mapSaveMsg} />
                      )}
                    </div>
                  </>
                )}
              </Section>
            )}

            {/* ── Google Analytics 4 ── */}
            {current === 'ga4' && (
              <Section title="Google Analytics 4"
                description="Ürün bazlı GA4 metriklerini sıralama kriterlerinde kullanın"
                badge={<StatusChip ok={Boolean(ga4Status?.ready)}>{ga4Status?.ready ? 'Kurulu' : ga4Status?.configured ? 'Kurulum eksik' : 'Bağlı değil'}</StatusChip>}>

                {ga4Setup ? (
                  /* Kurulum tamam: tek bakışta özet */
                  <>
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-caption">
                      <dt style={{ color: 'var(--tx3)' }}>Google hesabı</dt>
                      <dd className="font-medium" style={{ color: 'var(--tx1)' }}>{ga4Status?.googleEmail ?? '—'}</dd>
                      <dt style={{ color: 'var(--tx3)' }}>Property ID</dt>
                      <dd className="font-mono" style={{ color: 'var(--tx1)' }}>{ga4Status?.propertyId}</dd>
                      <dt style={{ color: 'var(--tx3)' }}>Senkronizasyon</dt>
                      <dd className="flex flex-col gap-1" style={{ color: 'var(--tx1)' }}>
                        {ga4Ranges.length > 0 ? ga4Ranges.map(r => (
                          <span key={r.range}>
                            {RANGE_LABELS[r.range] ?? r.range}
                            <span style={{ color: 'var(--tx3)' }}> · </span>
                            {r.lastSync
                              ? <span title={formatDateTime(r.lastSync)} className="cursor-help underline decoration-dotted underline-offset-2">{formatRelative(r.lastSync)}</span>
                              : <span style={{ color: 'var(--tx3)' }}>henüz senkronize edilmedi</span>}
                            {!r.used && <span style={{ color: 'var(--tx3)' }}> (kullanılmıyor)</span>}
                          </span>
                        )) : ga4Status?.lastSync ? (
                          <span title={formatDateTime(ga4Status.lastSync)} className="cursor-help underline decoration-dotted underline-offset-2">{formatRelative(ga4Status.lastSync)}</span>
                        ) : <span style={{ color: 'var(--tx3)' }}>Henüz senkronize edilmedi</span>}
                        <span className="text-label" style={{ color: 'var(--tx3)' }}>
                          Kategorilerin kullandığı dönemler her gün 06:00'da ve zamanlanmış sıralamadan önce otomatik güncellenir.
                        </span>
                      </dd>
                      <dt style={{ color: 'var(--tx3)' }}>Metrikler</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {GA4_METRICS.map(m => (
                          <span key={m} className="px-2 py-0.5 rounded-full text-label font-medium"
                            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>{m}</span>
                        ))}
                      </dd>
                    </dl>

                    <div className="flex flex-wrap items-start justify-between gap-3 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="flex flex-wrap gap-2">
                        {isSuperAdmin && (
                          <button type="button" onClick={() => setGa4Editing(true)} className={btnBase} style={outlineSt(false)}>Düzenle</button>
                        )}
                        <div className="flex flex-col gap-2">
                          <button type="button" onClick={handleGa4Test} disabled={ga4TestStatus === 'testing'}
                            className={btnBase} style={outlineSt(ga4TestStatus === 'testing')}>
                            {ga4TestStatus === 'testing' && <Spinner />} Bağlantıyı Test Et
                          </button>
                          {ga4TestStatus !== 'idle' && (
                            <ResultLine status={ga4TestStatus === 'testing' ? 'testing' : ga4TestStatus}
                              message={ga4TestStatus === 'testing' ? 'Test ediliyor…' : ga4TestMsg} />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button type="button" onClick={handleGa4Sync} disabled={ga4SyncStatus === 'syncing'}
                          className={btnBase} style={primarySt(ga4SyncStatus === 'syncing')}>
                          {ga4SyncStatus === 'syncing' && <Spinner />} Şimdi Senkronize Et
                        </button>
                        {ga4SyncStatus !== 'idle' && (
                          <ResultLine status={ga4SyncStatus === 'syncing' ? 'testing' : ga4SyncStatus === 'done' ? 'ok' : 'fail'}
                            message={ga4SyncStatus === 'syncing' ? 'GA4 verileri çekiliyor…' : ga4SyncMsg} />
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Kurulum adımları */
                  <>
                    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <p className="text-caption font-semibold" style={{ color: 'var(--tx1)' }}>
                        {ga4Status?.configured ? `✓ Google hesabı bağlı — ${ga4Status.googleEmail ?? ''}` : '1. Google hesabınızı bağlayın'}
                      </p>
                      {ga4ConnMsg && <ResultLine status={ga4ConnOk ? 'ok' : 'fail'} message={ga4ConnMsg} />}
                      {isSuperAdmin ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={handleGa4Connect} disabled={ga4Connecting}
                            className={btnBase}
                            style={ga4Connecting
                              ? outlineSt(true)
                              : { background: 'var(--google-btn-bg)', color: 'var(--google-btn-tx)', border: '1px solid var(--google-btn-bd)', cursor: 'pointer' }}>
                            {ga4Connecting ? <><Spinner /> Bağlanıyor…</> : (
                              <>
                                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                {ga4Status?.configured ? 'Farklı hesapla yeniden bağlan' : 'Google ile Bağlan'}
                              </>
                            )}
                          </button>
                          {ga4Status?.configured && (
                            <button type="button" onClick={() => setConfirmGa4Delete(true)} className={btnBase}
                              style={{ background: 'transparent', color: 'var(--err-tx)', border: '1px solid var(--err-bd)', cursor: 'pointer' }}>
                              Bağlantıyı Kaldır
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-caption" style={{ color: 'var(--tx3)' }}>
                          {ga4Status?.configured ? 'Süper Admin tarafından bağlandı.' : 'Henüz bağlanmadı — bu adımı Süper Admin tamamlamalı.'}
                        </p>
                      )}
                    </div>

                    {ga4Status?.configured && (
                      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <p className="text-caption font-semibold" style={{ color: 'var(--tx1)' }}>2. GA4 Property ID</p>
                        <Field label="Property ID" hint="analytics.google.com → Yönetici → Mülk Ayarları → Mülk Kimliği (yalnızca rakam)">
                          <input type="text" inputMode="numeric" placeholder="123456789" autoComplete="off"
                            value={ga4PropertyId}
                            onChange={e => { setGa4PropertyId(e.target.value); setGa4PropStatus('idle'); }}
                            disabled={readOnly} className={inputCls} style={{ ...inputSt, ...ro }} />
                        </Field>
                        {ga4PropStatus === 'error' && <ResultLine status="fail" message="Kaydedilemedi" />}
                      </div>
                    )}

                    {isSuperAdmin && ga4Status?.configured && (
                      <div className="flex flex-wrap justify-end gap-2 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                        {ga4Editing && (
                          <button type="button" onClick={() => { setGa4Editing(false); setGa4PropertyId(ga4Status?.propertyId ?? ''); }}
                            className={btnBase} style={outlineSt(false)}>Vazgeç</button>
                        )}
                        <button type="button" onClick={handleGa4SaveProperty}
                          disabled={!ga4PropertyId.trim() || ga4PropStatus === 'saving'}
                          className={btnBase + ' px-6'} style={primarySt(!ga4PropertyId.trim() || ga4PropStatus === 'saving')}>
                          {ga4PropStatus === 'saving' && <Spinner />} Kaydet
                        </button>
                      </div>
                    )}
                  </>
                )}
              </Section>
            )}

            {/* ── Kullanıcılar ── */}
            {current === 'kullanicilar' && isSuperAdmin && (
              <section className="rounded-2xl p-6" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <Users embedded />
              </section>
            )}

            {/* ── Güvenlik ── */}
            {current === 'guvenlik' && (
              <Section title="Güvenlik" description="Bağlantı bilgilerinin nasıl saklandığı ve kimlerin değiştirebildiği">
                <ul className="flex flex-col gap-3 text-caption" style={{ color: 'var(--tx2)' }}>
                  <li>🔒 API şifresi ve V3 token AES-256-GCM ile şifrelenerek saklanır; hiçbir zaman düz metin olarak kaydedilmez veya loglara yazılmaz.</li>
                  <li>👤 Bağlantı, alan eşlemesi, Google Analytics ve kullanıcılar yalnızca Süper Admin tarafından değiştirilebilir. Diğer kullanıcılar bilgileri salt okunur görür; şifre ve token kimseye gösterilmez.</li>
                  <li>🕒 Bağlantı bilgileri son güncelleme:{' '}
                    {credsUpdatedAt
                      ? <span title={formatDateTime(credsUpdatedAt)} className="cursor-help underline decoration-dotted underline-offset-2" style={{ color: 'var(--tx1)' }}>{formatRelative(credsUpdatedAt)}</span>
                      : <span style={{ color: 'var(--tx3)' }}>{configured ? 'bilinmiyor' : 'henüz kaydedilmedi'}</span>}
                  </li>
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
