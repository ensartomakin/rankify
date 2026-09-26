import { useEffect, useRef, useState } from 'react';
import { fetchConfigs, deleteConfig, triggerSaved, saveConfig, type SavedConfig } from '../api/config';
import { fetchAuditLogs } from '../api/audit';
import { CRITERION_LABELS, criteriaColor, type CriterionKey } from '../types';
import { formatPercent, formatDateTime, formatRelative } from '../utils/format';
import { toDraft, fromDraft, scheduleSummary, type ScheduleDraft } from '../utils/schedule';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { Switch } from '../components/Switch';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchIcon } from '../components/SearchIcon';

interface Props { onEdit: (config: SavedConfig) => void; }

type LastRun = NonNullable<SavedConfig['lastRun']>;
type SortOrder = 'newest' | 'oldest';

const SEASON_LABELS: Record<string, string> = { 'yaz-ilkbahar': 'Yaz · İlkbahar', 'kis-sonbahar': 'Kış · Sonbahar' };

/* Criteria saved under a key this version no longer knows (removed or renamed
   criteria from older versions, e.g. ga4Ctr → ga4CartAdds). */
const isKnownCriterion = (key: string) => Object.prototype.hasOwnProperty.call(CRITERION_LABELS, key);
function unknownCriteria(cfg: SavedConfig): { index: number; key: string }[] {
  return cfg.criteria.map((c, index) => ({ index, key: String(c.key) })).filter(c => !isKnownCriterion(c.key));
}

const displayName = (cfg: SavedConfig) => cfg.categoryName || cfg.categoryId;

const tagCls = 'inline-flex items-center gap-1 text-label font-semibold px-2 py-0.5 rounded-full whitespace-nowrap';

export function Configs({ onEdit }: Props) {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [flash,   setFlash]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [sort,    setSort]    = useState<SortOrder>('newest');
  const [search,  setSearch]  = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'run' | 'delete'; cfg: SavedConfig } | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  // Older API versions send no lastRun; derive it from the recent run history instead.
  const [fallbackRuns, setFallbackRuns] = useState<Record<string, LastRun>>({});

  async function load() {
    setLoading(true);
    try {
      const list = await fetchConfigs();
      setConfigs(list);
      if (list.length > 0 && !('lastRun' in list[0])) {
        fetchAuditLogs(undefined, 200).then(logs => {
          const map: Record<string, LastRun> = {};
          for (const l of logs) if (!map[l.categoryId]) map[l.categoryId] = { ranAt: l.ranAt, status: l.status, triggeredBy: l.triggeredBy };
          setFallbackRuns(map);
        }).catch(() => {});
      }
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function showFlash(msg: string, ok: boolean) {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  }

  async function handleTrigger(categoryId: string) {
    setBusy(categoryId);
    try { await triggerSaved(categoryId); showFlash('Sıralama başlatıldı.', true); }
    catch { showFlash('Tetikleme hatası.', false); }
    finally { setBusy(null); }
  }

  async function handleDelete(categoryId: string) {
    setBusy(categoryId);
    try { await deleteConfig(categoryId); setConfigs(p => p.filter(c => c.categoryId !== categoryId)); showFlash('Silindi.', true); }
    catch { showFlash('Silme hatası.', false); }
    finally { setBusy(null); }
  }

  const lastRunOf = (cfg: SavedConfig): LastRun | null =>
    cfg.lastRun !== undefined ? cfg.lastRun : (fallbackRuns[cfg.categoryId] ?? null);

  // Newest/oldest by last save; older APIs without updatedAt fall back to id (creation order).
  const savedKey = (c: SavedConfig) => c.updatedAt ?? String(c.id).padStart(12, '0');
  const q = search.trim().toLocaleLowerCase('tr-TR');
  const visible = configs
    .filter(c => !q || displayName(c).toLocaleLowerCase('tr-TR').includes(q) || c.categoryId.includes(q))
    .sort((a, b) => sort === 'newest' ? savedKey(b).localeCompare(savedKey(a)) : savedKey(a).localeCompare(savedKey(b)));

  const confirmUnknown = confirm ? unknownCriteria(confirm.cfg) : [];

  return (
    <div className="h-full flex flex-col">
      <ConfirmDialog open={confirm?.kind === 'run'}
        title="Sıralama çalıştırılsın mı?"
        description={confirm ? `"${displayName(confirm.cfg)}" kategorisi son kaydedilen ayarlarla sıralanıp mağazaya uygulanacak.` : ''}
        warning={confirmUnknown.length > 0
          ? `Bu kategoride tanınmayan kriter var (${confirmUnknown.map(u => `K${u.index + 1}: ${u.key}`).join(', ')}). Bu kriter sıralamaya katkı vermez; önce Düzenle ile başka bir kriter seçip kaydetmeniz önerilir.`
          : undefined}
        confirmLabel={confirmUnknown.length > 0 ? 'Yine de çalıştır' : 'Çalıştır'}
        onConfirm={() => { const c = confirm!.cfg; setConfirm(null); handleTrigger(c.categoryId); }}
        onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm?.kind === 'delete'} danger
        title={confirm ? `"${displayName(confirm.cfg)}" silinsin mi?` : ''}
        description="Kategorinin kayıtlı sıralama ayarları ve otomatik zamanlaması kaldırılır. Mağazadaki mevcut sıralama değişmez."
        confirmLabel="Sil"
        onConfirm={() => { const c = confirm!.cfg; setConfirm(null); handleDelete(c.categoryId); }}
        onCancel={() => setConfirm(null)} />

      {/* Header */}
      <div className="shrink-0 pt-8 pb-5 flex flex-wrap items-end justify-between gap-4" style={{ paddingLeft: 'var(--spacing-page)', paddingRight: 'var(--spacing-page)' }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>
            Kayıtlı Kategoriler
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--tx2)' }}>
            Kaydettiğiniz sıralama konfigürasyonlarını yönetin · {configs.length} kategori
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Sıralama" value={sort} onChange={e => setSort(e.target.value as SortOrder)}
            className="h-9 px-3 rounded-lg text-caption font-medium cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--tx1)' }}>
            <option value="newest">Yeniden eskiye</option>
            <option value="oldest">Eskiden yeniye</option>
          </select>
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--tx3)' }} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Kategori ara…" aria-label="Kategori adıyla ara"
              className="h-9 w-56 pl-8 pr-3 rounded-lg text-caption focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--tx1)' }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 space-y-3 animate-fade-up" style={{ paddingLeft: 'var(--spacing-page)', paddingRight: 'var(--spacing-page)' }}>
        {/* Flash */}
        {flash && (
          <div className="rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 animate-fade-in"
            style={flash.ok
              ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)' }
              : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
            }>
            <span>{flash.ok ? '✓' : '✕'}</span>
            {flash.msg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-sm" style={{ color: 'var(--tx2)' }}>
            <span className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--acc)' }} />
            Yükleniyor…
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-[20px] text-center"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)' }}>
            <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4"
              style={{ background: 'var(--acc-bg)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div className="font-semibold mb-1" style={{ color: 'var(--tx1)' }}>Henüz konfigürasyon yok</div>
            <div className="text-sm" style={{ color: 'var(--tx3)' }}>"Sıralama" sayfasından yeni ekleyebilirsiniz</div>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-[20px] text-center gap-2"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)' }}>
            <div className="font-semibold" style={{ color: 'var(--tx1)' }}>Aramayla eşleşen kategori yok</div>
            <button onClick={() => setSearch('')} className="text-caption font-semibold underline"
              style={{ background: 'transparent', border: 'none', color: 'var(--acc-tx)', cursor: 'pointer' }}>
              Aramayı temizle
            </button>
          </div>
        ) : (
          visible.map((cfg, idx) => {
            const unknown = unknownCriteria(cfg);
            const lastRun = lastRunOf(cfg);
            const isBusy  = busy === cfg.categoryId;
            return (
              <div key={cfg.categoryId}
                className="rounded-2xl px-4 py-3 transition-colors animate-fade-up"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', animationDelay: `${idx * 30}ms` }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc-bd)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {/* Üst satır: ad · ID · ayar etiketleri */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-body" style={{ color: 'var(--tx1)' }}>{displayName(cfg)}</span>
                      {cfg.categoryName && (
                        <span className="text-label font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: 'var(--surface2)', color: 'var(--tx3)' }}>
                          #{cfg.categoryId}
                        </span>
                      )}
                      <span className={tagCls} style={{ background: 'var(--ok-bg)', color: 'var(--ok-tx)', border: '1px solid var(--ok-bd)' }}>
                        Eşik {formatPercent(Math.round(cfg.availabilityThreshold * 100))}
                      </span>
                      {cfg.smartMix && (
                        <span className={tagCls} style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}
                          title="Aynı ürünün renkleri yan yana gelmez">
                          Smart Mix
                        </span>
                      )}
                      {cfg.seasonPreFilter && cfg.seasonPreFilter !== 'none' && (
                        <span className={tagCls} style={{ background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }}
                          title="Sezon ön-sıralaması">
                          Sezon: {SEASON_LABELS[cfg.seasonPreFilter] ?? cfg.seasonPreFilter}
                        </span>
                      )}
                      <ScheduleTag cfg={cfg}
                        open={scheduleFor === cfg.categoryId}
                        onOpen={() => setScheduleFor(cfg.categoryId)}
                        onClose={() => setScheduleFor(null)}
                        onSaved={updated => {
                          setConfigs(list => list.map(c => c.categoryId === cfg.categoryId ? { ...c, ...updated } : c));
                          showFlash('Zamanlama kaydedildi.', true);
                        }} />
                    </div>

                    {/* Alt satır: kriter çipleri · tarih bilgileri */}
                    <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                      <div className="flex flex-wrap gap-1.5">
                        {cfg.criteria.map((c, i) => {
                          const known = isKnownCriterion(String(c.key));
                          return known ? (
                            <span key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-label font-semibold"
                              style={{ background: criteriaColor(i) + '18', color: 'var(--tx1)', border: `1px solid ${criteriaColor(i)}30` }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: criteriaColor(i) }} />
                              K{i + 1} · {CRITERION_LABELS[c.key as CriterionKey]} · {formatPercent(c.weight)}
                            </span>
                          ) : (
                            <span key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-label font-semibold cursor-help"
                              style={{ background: 'var(--warn-bg)', color: 'var(--warn-tx)', border: '1px solid var(--warn-bd)' }}
                              title={`Tanınmayan kriter anahtarı: "${String(c.key)}". Bu sürümde karşılığı yok; sıralamaya katkı vermez.`}>
                              <span aria-hidden="true">⚠</span>
                              K{i + 1} · Bilinmeyen kriter · {formatPercent(c.weight)}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label" style={{ color: 'var(--tx3)' }}>
                        {cfg.updatedAt && <span>Kaydedildi: {formatDateTime(cfg.updatedAt)}</span>}
                        {lastRun ? (
                          <span>
                            Son çalışma:{' '}
                            <span title={formatDateTime(lastRun.ranAt)} className="cursor-help underline decoration-dotted underline-offset-2">
                              {formatRelative(lastRun.ranAt)}
                            </span>
                            {' · '}
                            <span className="font-semibold" style={{ color: lastRun.status === 'success' ? 'var(--ok-tx)' : 'var(--err-tx)' }}>
                              {lastRun.status === 'success' ? 'Başarılı' : 'Başarısız'}
                            </span>
                          </span>
                        ) : (
                          <span>Henüz çalıştırılmadı</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => onEdit(cfg)}
                      className="h-9 px-4 rounded-lg text-caption font-semibold transition-colors"
                      style={{ background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--tx1)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      Düzenle
                    </button>
                    <button onClick={() => setConfirm({ kind: 'run', cfg })}
                      disabled={isBusy}
                      title={unknown.length > 0 ? 'Bu kategoride tanınmayan kriter var' : undefined}
                      className="h-9 px-4 rounded-lg text-caption font-bold transition-colors inline-flex items-center gap-1.5"
                      style={isBusy
                        ? { background: 'var(--surface2)', cursor: 'not-allowed', color: 'var(--tx3)', border: '1px solid var(--border)' }
                        : { background: 'var(--cta-bg)', color: 'var(--cta-tx)', border: '1px solid transparent', cursor: 'pointer' }
                      }
                      onMouseEnter={e => { if (!isBusy) (e.currentTarget as HTMLElement).style.background = 'var(--cta-hov)'; }}
                      onMouseLeave={e => { if (!isBusy) (e.currentTarget as HTMLElement).style.background = 'var(--cta-bg)'; }}>
                      {isBusy ? (
                        <>
                          <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--tx3)' }} />
                          …
                        </>
                      ) : (
                        <>
                          {unknown.length > 0 && <span aria-hidden="true">⚠</span>}
                          Çalıştır
                        </>
                      )}
                    </button>
                    <button onClick={() => setConfirm({ kind: 'delete', cfg })}
                      disabled={isBusy} aria-label={`${displayName(cfg)} kategorisini sil`} title="Sil"
                      className="h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: 'var(--err-tx)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', cursor: 'pointer' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* Schedule summary tag; a click opens a popover editing the same per-category
   schedule (and with the same editor) as the "Otomatik Zamanlama" card on the
   ranking screen, saved together with the category's other saved settings. */
function ScheduleTag({ cfg, open, onOpen, onClose, onSaved }: {
  cfg: SavedConfig;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSaved: (updated: Partial<SavedConfig>) => void;
}) {
  const saved = toDraft(cfg.schedule);
  const summary = saved.isEnabled ? scheduleSummary(saved) : null;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => (open ? onClose() : onOpen())} aria-expanded={open}
        className={`${tagCls} cursor-pointer`}
        title="Otomatik zamanlamayı düzenle"
        style={saved.isEnabled
          ? { background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }
          : { background: 'transparent', color: 'var(--tx3)', border: '1px dashed var(--border-strong)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
        </svg>
        {saved.isEnabled ? (summary ?? 'Gün/saat seçilmedi') : 'Zamanlama kapalı'}
      </button>
      {open && <SchedulePopover cfg={cfg} initial={saved} onClose={onClose} onSaved={onSaved} />}
    </div>
  );
}

function SchedulePopover({ cfg, initial, onClose, onSaved }: {
  cfg: SavedConfig;
  initial: ScheduleDraft;
  onClose: () => void;
  onSaved: (updated: Partial<SavedConfig>) => void;
}) {
  const [draft, setDraft] = useState<ScheduleDraft>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');
  // The server only accepts known criteria, so a record with an unknown one can't be re-saved as is.
  const blocked = unknownCriteria(cfg).length > 0;

  async function save() {
    setStatus('saving'); setError('');
    try {
      // Same record as the ranking screen's Kaydet: the category's saved settings + schedule.
      const schedule = fromDraft(draft);
      const res = await saveConfig({
        categoryId: cfg.categoryId, categoryName: cfg.categoryName,
        availabilityThreshold: cfg.availabilityThreshold, criteria: cfg.criteria,
        smartMix: cfg.smartMix, seasonPreFilter: cfg.seasonPreFilter, schedule,
      });
      onSaved({ schedule: res.schedule ?? schedule, updatedAt: res.updatedAt ?? cfg.updatedAt });
      onClose();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  }

  return (
    <div role="dialog" aria-label="Otomatik zamanlama"
      className="absolute left-0 top-full mt-2 z-40 w-[min(420px,calc(100vw-2rem))] rounded-xl p-4 flex flex-col gap-3 animate-fade-up"
      style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-tooltip)' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-label font-bold uppercase tracking-wide" style={{ color: 'var(--tx2)' }}>Otomatik Zamanlama</span>
        <Switch checked={draft.isEnabled} label="Otomatik Zamanlama"
          onChange={v => setDraft(d => ({ ...d, isEnabled: v }))} />
      </div>
      {draft.isEnabled && <ScheduleEditor draft={draft} onChange={setDraft} />}
      <p className="text-label" style={{ color: 'var(--tx3)' }}>
        Otomatik çalışma bu kategorinin son kaydedilen ayarlarını kullanır.
      </p>
      {blocked && (
        <p role="alert" className="text-label px-2.5 py-1.5 rounded-md"
          style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', color: 'var(--warn-tx)' }}>
          Bu kategoride tanınmayan kriter var. Zamanlamayı kaydetmek için önce Düzenle ile kriteri değiştirip kaydedin.
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-label" style={{ color: 'var(--err-tx)' }}>{error}</p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose}
          className="h-8 px-3 rounded-lg text-caption font-semibold"
          style={{ background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--tx1)', cursor: 'pointer' }}>
          Vazgeç
        </button>
        <button type="button" onClick={save} disabled={status === 'saving' || blocked}
          className="h-8 px-4 rounded-lg text-caption font-bold"
          style={{ background: 'var(--cta-bg)', color: 'var(--cta-tx)', border: '1px solid transparent', opacity: blocked ? 0.55 : 1, cursor: blocked ? 'not-allowed' : status === 'saving' ? 'wait' : 'pointer' }}>
          {status === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
