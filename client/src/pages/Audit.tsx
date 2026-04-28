import { useEffect, useState } from 'react';
import { fetchAuditLogs, type AuditLog } from '../api/audit';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function dur(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function Audit() {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');

  useEffect(() => {
    fetchAuditLogs(undefined, 50).then(setLogs).finally(() => setLoading(false));
  }, []);

  const visible = filter.trim()
    ? logs.filter(l => l.categoryId.includes(filter.trim()))
    : logs;

  const successCount  = logs.filter(l => l.status === 'success').length;
  const totalProducts = logs.reduce((s, l) => s + l.totalProducts, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 pt-8 pb-6" style={{ paddingLeft: '28px', paddingRight: '28px' }}>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>
          Çalışma Geçmişi
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--tx2)' }}>Son 50 pipeline çalışmasının kayıtları</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 space-y-5 animate-fade-up" style={{ paddingLeft: '28px', paddingRight: '28px' }}>
        {/* Stats row */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Toplam Çalışma',  value: logs.length,                           color: 'var(--acc)',    bg: 'var(--acc-bg)',  bd: 'var(--acc-bd)'  },
              { label: 'Başarılı',         value: successCount,                          color: 'var(--ok-tx)', bg: 'var(--ok-bg)',   bd: 'var(--ok-bd)'   },
              { label: 'İşlenen Ürün',     value: totalProducts.toLocaleString('tr-TR'), color: 'var(--acc-tx)',bg: 'var(--acc-bg)',  bd: 'var(--acc-bd)'  },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5"
                style={{ background: s.bg, border: `1px solid ${s.bd}` }}>
                <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--tx2)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input type="text" placeholder="Kategori ID ile filtrele…"
              value={filter} onChange={e => setFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
          </div>
          {filter && (
            <button onClick={() => setFilter('')}
              className="text-xs px-3 py-2.5 rounded-xl transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>
              Temizle
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-sm" style={{ color: 'var(--tx2)' }}>
            <span className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--acc)' }} />
            Yükleniyor…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="font-medium mb-1" style={{ color: 'var(--tx1)' }}>
              {filter ? 'Eşleşen kayıt bulunamadı' : 'Henüz çalışma geçmişi yok'}
            </div>
            <div className="text-sm" style={{ color: 'var(--tx3)' }}>
              {filter ? `"${filter}" için sonuç yok` : 'İlk sıralama çalıştırıldığında burada görünür'}
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '640px' }}>
              <thead>
                <tr style={{ background: 'var(--surface3)', borderBottom: '1px solid var(--border)' }}>
                  {['Tarih', 'Kategori', 'Tetikleyen', 'Toplam', 'Aktif', 'Dışlanan', 'Süre', 'Durum'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--tx3)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((log, i) => (
                  <tr key={log.id}
                    className="transition-colors"
                    style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--acc-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'var(--bg)' : 'var(--surface)'}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs" style={{ color: 'var(--tx2)' }}>{fmt(log.ranAt)}</td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: 'var(--tx1)' }}>{log.categoryId}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={log.triggeredBy === 'cron'
                          ? { background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }
                          : { background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)' }
                        }>
                        {log.triggeredBy === 'cron' ? '⚡ Otomatik' : '👤 Manuel'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums font-medium" style={{ color: 'var(--tx1)' }}>{log.totalProducts}</td>
                    <td className="px-4 py-3.5 tabular-nums font-semibold" style={{ color: 'var(--ok-tx)' }}>{log.qualifiedCount}</td>
                    <td className="px-4 py-3.5 tabular-nums font-medium" style={{ color: 'var(--warn-tx)' }}>{log.disqualifiedCount}</td>
                    <td className="px-4 py-3.5 tabular-nums text-xs font-mono" style={{ color: 'var(--tx2)' }}>{dur(log.durationMs)}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={log.status === 'success'
                          ? { background: 'var(--ok-bg)', color: 'var(--ok-tx)', border: '1px solid var(--ok-bd)' }
                          : { background: 'var(--err-bg)', color: 'var(--err-tx)', border: '1px solid var(--err-bd)' }
                        }>
                        {log.status === 'success' ? '✓ Başarılı' : '✕ Hata'}
                      </span>
                      {log.errorMessage && (
                        <p className="text-xs mt-1 max-w-xs truncate" style={{ color: 'var(--err-tx)' }} title={log.errorMessage}>
                          {log.errorMessage}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
