import { useEffect, useState } from 'react';
import { fetchConfigs, deleteConfig, triggerSaved, type SavedConfig } from '../api/config';
import { CRITERION_LABELS, CRITERION_COLORS } from '../types';
import { PageHeader, Pill, Button, Spinner, KpiStrip } from '../components/ui';

interface Props { onEdit: (config: SavedConfig) => void; }

export function Configs({ onEdit }: Props) {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [flash,   setFlash]   = useState<{ msg: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try { setConfigs(await fetchConfigs()); }
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
    if (!confirm(`"${categoryId}" konfigürasyonu silinsin mi?`)) return;
    setBusy(categoryId);
    try { await deleteConfig(categoryId); setConfigs(p => p.filter(c => c.categoryId !== categoryId)); showFlash('Silindi.', true); }
    catch { showFlash('Silme hatası.', false); }
    finally { setBusy(null); }
  }

  return (
    <div className="h-full flex flex-col">
      <div style={{ paddingLeft: '28px', paddingRight: '28px' }}>
        <PageHeader
          eyebrow="Sıralama Motoru"
          title="Kayıtlı Kategoriler"
          description="Kaydettiğiniz sıralama konfigürasyonlarını yönetin"
        />
      </div>

      <KpiStrip items={[
        { label: 'Toplam Kategori', value: configs.length || null },
        {
          label: 'Ortalama Eşik',
          value: configs.length ? `%${Math.round(configs.reduce((s, c) => s + c.availabilityThreshold, 0) / configs.length * 100)}` : null,
        },
        { label: 'Toplam Kriter', value: configs.length ? configs.reduce((s, c) => s + c.criteria.length, 0) : null, tone: 'var(--acc-tx)' },
      ]} />

      <div className="flex-1 overflow-y-auto pb-8 pt-5 space-y-3 animate-fade-up" style={{ paddingLeft: '28px', paddingRight: '28px' }}>
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
            <Spinner size={20} />
            Yükleniyor…
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg text-center"
            style={{ background: 'var(--surface)', border: '1.5px dashed var(--border)' }}>
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
        ) : (
          configs.map((cfg, idx) => (
            <div key={cfg.categoryId}
              className="rounded-lg p-4 transition-all group animate-fade-up"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', animationDelay: `${idx * 40}ms` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc-bd)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            >
              <div className="flex items-start gap-5 flex-wrap">
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-3">
                    <span className="font-serif" style={{ fontSize: '18px', fontWeight: 500, color: 'var(--tx1)' }}>
                      {cfg.categoryName || cfg.categoryId}
                    </span>
                    {cfg.categoryName && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md"
                        style={{ background: 'var(--surface2)', color: 'var(--tx3)' }}>
                        #{cfg.categoryId}
                      </span>
                    )}
                    <Pill variant="ok">Eşik %{Math.round(cfg.availabilityThreshold * 100)}</Pill>
                  </div>

                  {/* Criteria badges */}
                  <div className="flex flex-wrap gap-2">
                    {cfg.criteria.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: CRITERION_COLORS[i] + '18', color: CRITERION_COLORS[i], border: `1px solid ${CRITERION_COLORS[i]}30` }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: CRITERION_COLORS[i] }} />
                        K{i + 1} · {CRITERION_LABELS[c.key]} · %{c.weight}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(cfg)}>Düzenle</Button>
                  <Button variant="primary" size="sm" onClick={() => handleTrigger(cfg.categoryId)}
                    disabled={busy === cfg.categoryId} loading={busy === cfg.categoryId}>
                    Çalıştır
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(cfg.categoryId)} disabled={busy === cfg.categoryId}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
