import { Router } from 'express';
import { requireAuth } from './auth.middleware';
import { createNonce, consumeNonce } from '../utils/nonce-store';
import {
  upsertGa4Credentials,
  getGa4Credentials,
  hasGa4Credentials,
  deleteGa4Credentials,
  upsertGa4Metrics,
  getGa4Metrics,
  getGa4LastSync,
  getGa4PropertyId,
  getGa4GoogleEmail,
} from '../db/ga4.repo';
import {
  getGa4AuthUrl,
  exchangeCodeForTokens,
  fetchGa4ProductMetrics,
  testGa4Connection,
} from '../services/ga4-client';
import { logger } from '../utils/logger';

export const ga4Router = Router();

// OAuth callback — auth gerektirmez (Google'dan gelir), state = CSRF nonce
ga4Router.get('/auth/callback', async (req, res) => {
  // Override helmet's default CSP for this popup page — it needs unsafe-inline script
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'");

  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    return res.send(closePopupHtml('error', 'Google yetkilendirmesi iptal edildi'));
  }

  // consumeNonce validates the nonce, returns userId, and deletes it (single-use)
  const userId = consumeNonce(state);
  if (!userId) {
    return res.send(closePopupHtml('error', 'Geçersiz veya süresi dolmuş oturum — tekrar deneyin'));
  }

  try {
    const { refreshToken, googleEmail } = await exchangeCodeForTokens(code);

    const existing = await getGa4Credentials(userId);
    await upsertGa4Credentials(userId, {
      propertyId:   existing?.propertyId ?? '',
      refreshToken,
      googleEmail,
    });

    logger.info(`[GA4 OAuth] userId=${userId} ${googleEmail} bağlandı`);
    return res.send(closePopupHtml('success', googleEmail));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[GA4 OAuth callback] hata: ${msg}`);
    return res.send(closePopupHtml('error', 'Google bağlantısı sırasında hata oluştu'));
  }
});

// Tüm diğer endpoint'ler auth gerektirir
ga4Router.use(requireAuth);

// GET /api/ga4/auth/url  — popup için Google auth URL'si
ga4Router.get('/auth/url', (req, res) => {
  if (!process.env.GA4_CLIENT_ID || !process.env.GA4_CLIENT_SECRET || !process.env.GA4_REDIRECT_URI) {
    return res.status(503).json({ error: 'GA4 OAuth yapılandırılmamış (env eksik)' });
  }
  // state = cryptographically random nonce bound to userId (server-side)
  const nonce = createNonce(req.user!.userId);
  const url   = getGa4AuthUrl() + `&state=${encodeURIComponent(nonce)}`;
  res.json({ url });
});

// PUT /api/ga4/property  — property ID'yi ayrıca kaydet
ga4Router.put('/property', async (req, res) => {
  const { propertyId } = req.body as { propertyId?: string };
  if (!propertyId?.trim()) return res.status(400).json({ error: 'Property ID zorunlu' });

  const userId = req.user!.userId;
  const creds  = await getGa4Credentials(userId);
  if (!creds) return res.status(404).json({ error: 'Önce Google hesabınızı bağlayın' });

  await upsertGa4Credentials(userId, { ...creds, propertyId: propertyId.trim() });
  res.json({ ok: true });
});

// GET /api/ga4/status
ga4Router.get('/status', async (req, res) => {
  try {
    const userId     = req.user!.userId;
    const configured = await hasGa4Credentials(userId);
    const lastSync   = configured ? await getGa4LastSync(userId)    : null;
    const propertyId = configured ? await getGa4PropertyId(userId)  : null;
    const email      = configured ? await getGa4GoogleEmail(userId) : null;
    const ready      = configured && Boolean(propertyId);
    res.json({ configured, ready, propertyId, googleEmail: email, lastSync: lastSync?.toISOString() ?? null });
  } catch {
    res.status(500).json({ error: 'Durum sorgusu başarısız' });
  }
});

// DELETE /api/ga4/credentials
ga4Router.delete('/credentials', async (req, res) => {
  try {
    await deleteGa4Credentials(req.user!.userId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

// POST /api/ga4/sync
ga4Router.post('/sync', async (req, res) => {
  const userId    = req.user!.userId;
  const dateRange = String(req.query.dateRange ?? '30d');

  const creds = await getGa4Credentials(userId);
  if (!creds)            return res.status(404).json({ error: 'GA4 bağlı değil' });
  if (!creds.propertyId) return res.status(400).json({ error: 'Property ID girilmemiş' });

  try {
    const metrics = await fetchGa4ProductMetrics(creds.propertyId, creds.refreshToken, dateRange);
    await upsertGa4Metrics(userId, metrics, dateRange);
    logger.info(`[GA4 sync] userId=${userId} ${metrics.length} ürün metriği güncellendi`);
    res.json({ ok: true, count: metrics.length, dateRange });
  } catch (err) {
    logger.error(`[GA4 sync] hata userId=${userId}: ${err}`);
    res.status(500).json({ error: 'GA4 senkronizasyonu başarısız' });
  }
});

// POST /api/ga4/test
ga4Router.post('/test', async (req, res) => {
  const userId = req.user!.userId;
  const creds  = await getGa4Credentials(userId);
  if (!creds)            return res.json({ ok: false, message: 'GA4 bağlı değil' });
  if (!creds.propertyId) return res.json({ ok: false, message: 'Property ID girilmemiş' });

  const result = await testGa4Connection(creds.propertyId, creds.refreshToken);
  res.json(result);
});

// GET /api/ga4/metrics
ga4Router.get('/metrics', async (req, res) => {
  try {
    const userId    = req.user!.userId;
    const dateRange = String(req.query.dateRange ?? '30d');
    const map       = await getGa4Metrics(userId, dateRange);
    res.json(Object.fromEntries(map));
  } catch {
    res.status(500).json({ error: 'Metrik sorgusu başarısız' });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Popup'ı kapatan ve parent window'a mesaj gönderen HTML
function closePopupHtml(status: 'success' | 'error', detail: string): string {
  const targetOrigin = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const safeDetail   = escapeHtml(detail);
  return `<!DOCTYPE html><html><body><script>
    try {
      window.opener && window.opener.postMessage(
        { type: 'ga4_oauth', status: '${status}', detail: ${JSON.stringify(detail)} },
        ${JSON.stringify(targetOrigin)}
      );
    } catch(e) {}
    window.close();
  </script>
  <p style="font-family:sans-serif;padding:24px">
    ${status === 'success'
      ? `✅ <b>${safeDetail}</b> hesabı bağlandı. Bu sekmeyi kapatabilirsiniz.`
      : `❌ Bağlantı tamamlanamadı. Bu sekmeyi kapatabilirsiniz.`}
  </p>
  </body></html>`;
}
