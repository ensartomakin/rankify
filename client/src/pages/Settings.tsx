import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCredentials, saveCredentials, testCredentials, fetchSchedule, saveSchedule, type CredentialsPayload, type ScheduleSettings } from '../api/settings';
import { fetchGa4Status, fetchGa4AuthUrl, openGa4OAuthPopup, saveGa4PropertyId, deleteGa4Credentials, testGa4Connection, syncGa4Metrics, type Ga4Status } from '../api/ga4';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface Props { onSaved?: () => void; }

export { getStoredThreshold } from '../utils/threshold';

export function Settings({ onSaved }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [form,       setForm]       = useState<CredentialsPayload>({ apiUrl: '', storeCode: '', apiUser: '', apiPass: '', apiToken: '' });
  const [configured, setConfigured] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMsg,    setTestMsg]    = useState('');
  const [testDebug,  setTestDebug]  = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMsg,    setSaveMsg]    = useState('');
  const [showPass,   setShowPass]   = useState(false);

  const DEFAULT_SCHEDULE: ScheduleSettings = { isEnabled: false, dayHours: {} };
  const [schedule,      setSchedule]      = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [schedSaveStatus, setSchedSave]   = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [schedSaveMsg,    setSchedMsg]    = useState('');

  // GA4 state
  const [ga4Status,     setGa4Status]     = useState<Ga4Status | null>(null);
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  const [ga4Connecting, setGa4Connecting] = useState(false);
  const [ga4ConnMsg,    setGa4ConnMsg]    = useState('');
  const [ga4ConnOk,     setGa4ConnOk]     = useState<boolean | null>(null);
  const [ga4PropStatus, setGa4PropStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [ga4TestStatus, setGa4TestStatus] = useState<TestStatus>('idle');
  const [ga4TestMsg,    setGa4TestMsg]    = useState('');
  const [ga4SyncStatus, setGa4SyncStatus] = useState<SyncStatus>('idle');
  const [ga4SyncMsg,    setGa4SyncMsg]    = useState('');
  const [ga4DateRange,  setGa4DateRange]  = useState('30d');

  useEffect(() => {
    Promise.all([
      fetchCredentials().then(data => {
        setConfigured(data.configured);
        if (data.configured) setForm({ apiUrl: data.apiUrl, storeCode: data.storeCode, apiUser: data.apiUser, apiPass: '' });
      }),
      fetchSchedule().then(s => setSchedule(s)).catch(() => {}),
      fetchGa4Status().then(s => {
        setGa4Status(s);
        if (s.propertyId) setGa4PropertyId(s.propertyId);
      }).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(key: keyof CredentialsPayload, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setTestStatus('idle'); setSaveStatus('idle');
  }

  const canSubmit = form.apiUrl && form.storeCode && form.apiUser && (form.apiPass || configured);

  async function handleTest() {
    if (!canSubmit) return;
    setTestStatus('testing'); setTestMsg(''); setTestDebug('');
    try {
      const r = await testCredentials(form);
      setTestStatus(r.ok ? 'ok' : 'fail'); setTestMsg(r.message); setTestDebug(r.debug ?? '');
    } catch { setTestStatus('fail'); setTestMsg('Bağlantı testi başarısız'); }
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSaveStatus('saving'); setSaveMsg('');
    try {
      await saveCredentials(form);
      setSaveStatus('saved'); setSaveMsg('Bağlantı bilgileri kaydedildi.');
      setConfigured(true); onSaved?.();
      if (form.apiPass) setForm(prev => ({ ...prev, apiPass: '' }));
    } catch (err) {
      setSaveStatus('error'); setSaveMsg(err instanceof Error ? err.message : 'Kayıt hatası');
    }
  }

  async function handleSaveSchedule() {
    setSchedSave('saving'); setSchedMsg('');
    try {
      await saveSchedule(schedule);
      setSchedSave('saved'); setSchedMsg('Zamanlama kaydedildi.');
    } catch (err) {
      setSchedSave('error'); setSchedMsg(err instanceof Error ? err.message : 'Kayıt hatası');
    }
  }

  function toggleHourForDay(day: number, hour: number) {
    setSchedule(prev => {
      const existing = prev.dayHours[day] ?? [];
      const updated  = existing.includes(hour)
        ? existing.filter(h => h !== hour)
        : [...existing, hour].sort((a, b) => a - b);
      const next = { ...prev, dayHours: { ...prev.dayHours, [day]: updated } };
      if (updated.length === 0) delete next.dayHours[day];
      return next;
    });
    setSchedSave('idle');
  }

  function setDayEnabled(day: number, enabled: boolean) {
    setSchedule(prev => {
      const next = { ...prev, dayHours: { ...prev.dayHours } };
      if (!enabled) {
        delete next.dayHours[day];
      } else if (!next.dayHours[day] || next.dayHours[day].length === 0) {
        next.dayHours[day] = [5];
      }
      return next;
    });
    setSchedSave('idle');
  }

  async function handleGa4Connect() {
    setGa4Connecting(true); setGa4ConnMsg(''); setGa4ConnOk(null);
    try {
      const url   = await fetchGa4AuthUrl();
      const email = await openGa4OAuthPopup(url);
      setGa4ConnOk(true); setGa4ConnMsg(`${email} bağlandı`);
      const s = await fetchGa4Status();
      setGa4Status(s);
      if (s.propertyId) setGa4PropertyId(s.propertyId);
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
    } catch { setGa4PropStatus('error'); }
  }

  async function handleGa4Delete() {
    if (!confirm('GA4 bağlantısı ve tüm metrik önbelleği silinsin mi?')) return;
    try {
      await deleteGa4Credentials();
      setGa4Status(s => s ? { ...s, configured: false, ready: false, googleEmail: null, propertyId: null, lastSync: null } : s);
      setGa4PropertyId(''); setGa4TestStatus('idle'); setGa4ConnMsg(''); setGa4ConnOk(null);
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
      const r = await syncGa4Metrics(ga4DateRange);
      setGa4SyncStatus('done'); setGa4SyncMsg(`${r.count} ürün metriği güncellendi.`);
      setGa4Status(s => s ? { ...s, lastSync: new Date().toISOString() } : s);
    } catch (err) {
      setGa4SyncStatus('error'); setGa4SyncMsg(err instanceof Error ? err.message : 'Senkronizasyon hatası');
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all';
  const inputSt  = { background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)' };

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-sm" style={{ color: 'var(--tx2)' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--acc)' }} />
      Yükleniyor…
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 space-y-8 animate-fade-up" style={{ paddingLeft: '28px', paddingRight: '28px' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>
              Bağlantı Ayarları
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--tx2)' }}>
              T-Soft mağaza API bilgilerinizi yapılandırın
            </p>
          </div>
          {configured && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shrink-0"
              style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok-tx)' }} />
              Bağlı
            </div>
          )}
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--acc-bg)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--tx3)' }}>
                API Bilgileri
              </span>
            </div>
            {!isSuperAdmin && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface2)', color: 'var(--tx3)', border: '1px solid var(--border)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Yalnızca Süper Admin düzenleyebilir
              </span>
            )}
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>API URL</label>
            <input type="url" placeholder="https://markaadi.com"
              value={form.apiUrl} onChange={e => set('apiUrl', e.target.value)}
              disabled={!isSuperAdmin}
              className={inputCls} style={{ ...inputSt, opacity: isSuperAdmin ? 1 : 0.6 }} />
            <p className="text-xs" style={{ color: 'var(--tx3)' }}>
              Sadece alan adı — örn: <code style={{ color: 'var(--tx2)' }}>https://he-qa.com</code>
            </p>
          </div>

          {/* Store code + API User */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>Mağaza Kodu</label>
              <input type="text" placeholder="STORE01"
                value={form.storeCode} onChange={e => set('storeCode', e.target.value)}
                disabled={!isSuperAdmin}
                className={inputCls} style={{ ...inputSt, opacity: isSuperAdmin ? 1 : 0.6 }} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>API Kullanıcısı</label>
              <input type="text" placeholder="kullanici@markaadi.com"
                value={form.apiUser} onChange={e => set('apiUser', e.target.value)}
                disabled={!isSuperAdmin}
                className={inputCls} style={{ ...inputSt, opacity: isSuperAdmin ? 1 : 0.6 }} />
            </div>
          </div>

          {/* V3 Token */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>
              V3 API Token
              <span className="ml-2 normal-case font-normal" style={{ color: 'var(--tx3)' }}>
                T-Soft admin → Ayarlar → API Token
              </span>
            </label>
            <input type="text" placeholder="Kalıcı API token — 2FA olmadan V3 erişimi"
              value={form.apiToken ?? ''} onChange={e => set('apiToken' as keyof CredentialsPayload, e.target.value)}
              disabled={!isSuperAdmin}
              className={inputCls} style={{ ...inputSt, opacity: isSuperAdmin ? 1 : 0.6 }} />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>
              API Şifresi
              {configured && <span className="ml-2 font-normal" style={{ color: 'var(--tx3)' }}>(değiştirmek için doldurun)</span>}
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'}
                placeholder={configured ? '••••••••' : 'Şifrenizi girin'}
                value={form.apiPass} onChange={e => set('apiPass', e.target.value)}
                disabled={!isSuperAdmin}
                className={inputCls + ' pr-16'} style={{ ...inputSt, opacity: isSuperAdmin ? 1 : 0.6 }} />
              {isSuperAdmin && (
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium transition-colors"
                  style={{ color: 'var(--tx2)' }}>
                  {showPass ? 'Gizle' : 'Göster'}
                </button>
              )}
            </div>
          </div>

          {/* Test result */}
          {testStatus !== 'idle' && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium flex flex-col gap-1"
              style={testStatus === 'ok'
                ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
                : testStatus === 'fail'
                ? { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
                : { background: 'var(--acc-bg)', border: '1px solid var(--acc-bd)', color: 'var(--acc-tx)' }
              }>
              <div className="flex items-center gap-2">
                {testStatus === 'testing' && (
                  <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                )}
                {testStatus === 'ok' && '✓'}
                {testStatus === 'fail' && '✕'}
                {testStatus === 'testing' ? 'Test ediliyor…' : testMsg}
              </div>
              {testDebug && <div className="text-xs font-mono opacity-60 break-all">{testDebug}</div>}
            </div>
          )}

          {/* Save result */}
          {saveStatus !== 'idle' && saveStatus !== 'saving' && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={saveStatus === 'saved'
                ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
                : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
              }>
              {saveMsg}
            </div>
          )}

          {/* Buttons — sadece super_admin görebilir */}
          {isSuperAdmin && (
            <div className="flex gap-3 pt-1">
              <button onClick={handleTest} disabled={!canSubmit || testStatus === 'testing'}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
                {testStatus === 'testing' ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
              </button>
              <button onClick={handleSave} disabled={!canSubmit || saveStatus === 'saving'}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                style={!canSubmit || saveStatus === 'saving'
                  ? { background: 'var(--surface2)', cursor: 'not-allowed', color: 'var(--tx3)', border: '1px solid var(--border)' }
                  : { background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }
                }>
                {saveStatus === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          )}
        </div>

        {/* Otomatik Zamanlama */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

          {/* Başlık + aktif/pasif toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--acc-bg)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--tx3)' }}>
                  Otomatik Zamanlama
                </span>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx3)' }}>
                  Seçili gün ve saatlerde tüm aktif kategori sıralamalarını otomatik çalıştırır
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium" style={{ color: schedule.isEnabled ? 'var(--ok-tx)' : 'var(--tx3)' }}>
                {schedule.isEnabled ? 'Açık' : 'Kapalı'}
              </span>
              <button
                onClick={() => { setSchedule(prev => ({ ...prev, isEnabled: !prev.isEnabled })); setSchedSave('idle'); }}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                style={{ background: schedule.isEnabled ? 'var(--ok-tx)' : 'var(--border)' }}>
                <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: schedule.isEnabled ? 'translateX(22px)' : 'translateX(4px)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>

          {/* Gün × saat grid — Pazartesi'den başlar */}
          <div className="space-y-3">
            {([
              [1, 'Pazartesi'], [2, 'Salı'], [3, 'Çarşamba'], [4, 'Perşembe'],
              [5, 'Cuma'], [6, 'Cumartesi'], [0, 'Pazar'],
            ] as [number, string][]).map(([day, label]) => {
              const hours   = schedule.dayHours[day] ?? [];
              const enabled = hours.length > 0;
              return (
                <div key={day} className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${enabled ? 'var(--acc-bd)' : 'var(--border)'}`, background: enabled ? 'var(--acc-bg)' : 'var(--surface2)' }}>
                  {/* Gün başlık satırı */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-semibold" style={{ color: enabled ? 'var(--acc-tx)' : 'var(--tx3)' }}>
                      {label}
                    </span>
                    <div className="flex items-center gap-3">
                      {enabled && (
                        <span className="text-[11px]" style={{ color: 'var(--acc-tx)' }}>
                          {hours.map(h => `${String(h).padStart(2,'0')}:00`).join(', ')}
                        </span>
                      )}
                      <button
                        onClick={() => setDayEnabled(day, !enabled)}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                        style={{ background: enabled ? 'var(--acc)' : 'var(--border)' }}>
                        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                          style={{ transform: enabled ? 'translateX(18px)' : 'translateX(3px)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  </div>
                  {/* Saat seçici — sadece gün aktifse */}
                  {enabled && (
                    <div className="px-4 pb-3">
                      <div className="grid grid-cols-8 gap-1.5">
                        {Array.from({ length: 24 }, (_, h) => {
                          const sel = hours.includes(h);
                          return (
                            <button key={h} onClick={() => toggleHourForDay(day, h)}
                              className="h-8 rounded-lg text-[11px] font-semibold tabular-nums transition-all"
                              style={sel
                                ? { background: 'var(--acc)', color: '#fff', border: '1px solid var(--acc)' }
                                : { background: 'var(--surface)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
                              {String(h).padStart(2,'0')}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] mt-2" style={{ color: 'var(--acc-tx)' }}>
                        {hours.length} saat seçili — {label} günü {hours.length} kez çalışır
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Schedule save result */}
          {schedSaveStatus !== 'idle' && schedSaveStatus !== 'saving' && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={schedSaveStatus === 'saved'
                ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
                : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
              {schedSaveMsg}
            </div>
          )}

          <button onClick={handleSaveSchedule} disabled={schedSaveStatus === 'saving'}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={schedSaveStatus === 'saving'
              ? { background: 'var(--surface2)', cursor: 'not-allowed', color: 'var(--tx3)', border: '1px solid var(--border)' }
              : { background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}>
            {schedSaveStatus === 'saving' ? 'Kaydediliyor…' : 'Zamanlamayı Kaydet'}
          </button>
        </div>

        {/* GA4 Entegrasyonu */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

          {/* Başlık */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--acc-bg)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm9.75-9.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v16.5c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0112.75 20.25V3.375zm-4.875 6c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v10.5c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 017.875 19.875v-10.5z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--tx3)' }}>
                  Google Analytics 4
                </span>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx3)' }}>
                  Ürün bazlı CTR, oturum, görüntülenme ve dönüşüm verilerini sıralamaya dahil edin
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isSuperAdmin && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--surface2)', color: 'var(--tx3)', border: '1px solid var(--border)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Yalnızca Süper Admin düzenleyebilir
                </span>
              )}
              {ga4Status?.configured && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok-tx)' }} />
                  {ga4Status.googleEmail ?? 'Bağlı'}
                </div>
              )}
            </div>
          </div>

          {/* Adım 1 — Google hesabı bağla */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--tx2)' }}>
              {ga4Status?.configured ? '✓ Google hesabı bağlandı' : 'Adım 1 — Google hesabınızı bağlayın'}
            </p>

            {ga4ConnMsg && (
              <div className="rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2"
                style={ga4ConnOk
                  ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
                  : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
                }>
                {ga4ConnOk ? '✓' : '✕'} {ga4ConnMsg}
              </div>
            )}

            {isSuperAdmin ? (
              <div className="flex gap-3">
                <button onClick={handleGa4Connect} disabled={ga4Connecting}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={ga4Connecting
                    ? { background: 'var(--surface2)', color: 'var(--tx3)', border: '1px solid var(--border)', cursor: 'not-allowed' }
                    : { background: '#fff', color: '#3c4043', border: '1px solid #dadce0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  }>
                  {ga4Connecting
                    ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Bağlanıyor…</>
                    : <>
                        {/* Google "G" logo */}
                        <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        {ga4Status?.configured ? 'Farklı hesapla yeniden bağlan' : 'Google ile Bağlan'}
                      </>
                  }
                </button>
                {ga4Status?.configured && (
                  <button onClick={handleGa4Delete}
                    className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
                    Kaldır
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs py-2" style={{ color: 'var(--tx3)' }}>
                {ga4Status?.configured
                  ? `Süper Admin tarafından bağlandı: ${ga4Status.googleEmail ?? ''}`
                  : 'Henüz bağlanmadı — Süper Admin bu adımı tamamlamalı.'}
              </p>
            )}
          </div>

          {/* Adım 2 — Property ID (sadece hesap bağlıysa) */}
          {ga4Status?.configured && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--tx2)' }}>
                {ga4Status.ready ? '✓ Property ID ayarlandı' : 'Adım 2 — GA4 Property ID girin'}
              </p>
              <div className="flex gap-3">
                <input type="text" placeholder="123456789"
                  value={ga4PropertyId}
                  onChange={e => { setGa4PropertyId(e.target.value); setGa4PropStatus('idle'); }}
                  disabled={!isSuperAdmin}
                  className={inputCls} style={{ ...inputSt, flex: 1, opacity: isSuperAdmin ? 1 : 0.6 }} />
                {isSuperAdmin && (
                  <button onClick={handleGa4SaveProperty}
                    disabled={!ga4PropertyId.trim() || ga4PropStatus === 'saving'}
                    className="px-5 py-3 rounded-xl text-sm font-semibold text-white shrink-0 transition-all"
                    style={!ga4PropertyId.trim()
                      ? { background: 'var(--surface)', color: 'var(--tx3)', border: '1px solid var(--border)', cursor: 'not-allowed' }
                      : { background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }
                    }>
                    {ga4PropStatus === 'saving' ? '…' : 'Kaydet'}
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--tx3)' }}>
                analytics.google.com → Admin → Mülk Ayarları → Mülk ID (sadece rakam)
              </p>
              {ga4PropStatus === 'saved' && (
                <p className="text-xs font-medium" style={{ color: 'var(--ok-tx)' }}>✓ Kaydedildi</p>
              )}
            </div>
          )}

          {/* Adım 3 — Test + Sync (sadece ready ise) */}
          {ga4Status?.ready && (
            <div className="space-y-3 pt-1">
              {/* Test */}
              {ga4TestStatus !== 'idle' && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
                  style={ga4TestStatus === 'ok'
                    ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
                    : ga4TestStatus === 'fail'
                    ? { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
                    : { background: 'var(--acc-bg)', border: '1px solid var(--acc-bd)', color: 'var(--acc-tx)' }
                  }>
                  {ga4TestStatus === 'testing' && <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
                  {ga4TestStatus === 'ok' && '✓'}{ga4TestStatus === 'fail' && '✕'}
                  {ga4TestStatus === 'testing' ? 'Test ediliyor…' : ga4TestMsg}
                </div>
              )}

              <button onClick={handleGa4Test} disabled={ga4TestStatus === 'testing'}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}>
                Bağlantıyı Test Et
              </button>

              {/* Sync */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--tx2)' }}>Metrik Senkronizasyonu</p>
                  {ga4Status.lastSync && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx3)' }}>
                      Son sync: {new Date(ga4Status.lastSync).toLocaleString('tr-TR')}
                    </p>
                  )}
                </div>
                <select value={ga4DateRange} onChange={e => setGa4DateRange(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>
                  <option value="7d">Son 7 Gün</option>
                  <option value="14d">Son 14 Gün</option>
                  <option value="30d">Son 30 Gün</option>
                  <option value="90d">Son 90 Gün</option>
                </select>
              </div>

              {ga4SyncStatus !== 'idle' && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
                  style={ga4SyncStatus === 'done'
                    ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
                    : ga4SyncStatus === 'error'
                    ? { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
                    : { background: 'var(--acc-bg)', border: '1px solid var(--acc-bd)', color: 'var(--acc-tx)' }
                  }>
                  {ga4SyncStatus === 'syncing' && <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
                  {ga4SyncStatus === 'done' && '✓'}{ga4SyncStatus === 'error' && '✕'}
                  {ga4SyncStatus === 'syncing' ? 'GA4 verileri çekiliyor…' : ga4SyncMsg}
                </div>
              )}

              <button onClick={handleGa4Sync} disabled={ga4SyncStatus === 'syncing'}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                style={ga4SyncStatus === 'syncing'
                  ? { background: 'var(--surface2)', cursor: 'not-allowed', color: 'var(--tx3)', border: '1px solid var(--border)' }
                  : { background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }
                }>
                {ga4SyncStatus === 'syncing' ? 'Senkronize ediliyor…' : 'Şimdi Senkronize Et'}
              </button>

              <div className="flex flex-wrap gap-2">
                {['GA4 · Görüntülenme', 'GA4 · Oturum', 'GA4 · CTR', 'GA4 · Dönüşüm Oranı'].map(label => (
                  <span key={label} className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                    style={{ background: 'var(--acc-bg)', border: '1px solid var(--acc-bd)', color: 'var(--acc-tx)' }}>
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--tx3)' }}>
                Senkronizasyondan sonra bu metrikler sıralama kriterlerinde kullanılabilir hale gelir.
              </p>
            </div>
          )}
        </div>

        {/* Security note */}
        <div className="rounded-xl px-5 py-4 text-xs space-y-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: 'var(--tx2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Güvenlik Notu
          </div>
          <div style={{ color: 'var(--tx3)' }}>API şifreniz AES-256-GCM ile şifrelenerek veritabanında saklanır.</div>
          <div style={{ color: 'var(--tx3)' }}>Hiçbir zaman düz metin olarak kaydedilmez veya loglara yazılmaz.</div>
        </div>
      </div>
    </div>
  );
}
