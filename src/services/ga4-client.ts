import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { Ga4ProductMetric } from '../db/ga4.repo';

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GA4_CLIENT_ID,
    process.env.GA4_CLIENT_SECRET,
    process.env.GA4_REDIRECT_URI
  );
}

export function getGa4AuthUrl(): string {
  const client = makeOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',  // her seferinde refresh_token al
    scope:       ['https://www.googleapis.com/auth/analytics.readonly'],
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ refreshToken: string; googleEmail: string }> {
  const client = makeOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('Google refresh token alınamadı — "prompt: consent" ile tekrar deneyin');
  }

  // Hesap e-postasını öğren
  client.setCredentials(tokens);
  const oauth2   = google.oauth2({ version: 'v2', auth: client });
  const userInfo = await oauth2.userinfo.get();

  return {
    refreshToken: tokens.refresh_token,
    googleEmail:  userInfo.data.email ?? '',
  };
}

function dateRangeToStartDate(range: string): string {
  switch (range) {
    case '7d':  return '7daysAgo';
    case '14d': return '14daysAgo';
    case '30d': return '30daysAgo';
    case '90d': return '90daysAgo';
    default:    return '30daysAgo';
  }
}

export async function fetchGa4ProductMetrics(
  propertyId: string,
  refreshToken: string,
  dateRange = '30d'
): Promise<Ga4ProductMetric[]> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });

  const analyticsClient = new BetaAnalyticsDataClient({ authClient: auth as any });
  const startDate       = dateRangeToStartDate(dateRange);

  const [response] = await analyticsClient.runReport({
    property:   `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'itemId' }],
    metrics: [
      { name: 'itemsViewed' },
      { name: 'sessions' },
      { name: 'itemListClickThroughRate' },
      { name: 'itemsPurchased' },
      { name: 'itemRevenue' },
    ],
    limit: 10000,
  });

  const metrics: Ga4ProductMetric[] = [];

  for (const row of response.rows ?? []) {
    const itemId = row.dimensionValues?.[0]?.value ?? '';
    if (!itemId || itemId === '(not set)') continue;

    const [views, sessions, ctr, purchases, revenue] = (row.metricValues ?? []).map(
      m => m.value ?? '0'
    );

    const viewsVal     = parseInt(views, 10)     || 0;
    const sessionsVal  = parseInt(sessions, 10)  || 0;
    const ctrVal       = parseFloat(ctr) * 100;
    const purchasesVal = parseInt(purchases, 10) || 0;
    const revenueVal   = parseFloat(revenue)     || 0;
    const convRate     = viewsVal > 0 ? (purchasesVal / viewsVal) * 100 : 0;

    metrics.push({
      itemId,
      views:          viewsVal,
      sessions:       sessionsVal,
      ctr:            Math.round(ctrVal * 100) / 100,
      conversionRate: Math.round(convRate * 100) / 100,
      purchases:      purchasesVal,
      revenue:        revenueVal,
    });
  }

  return metrics;
}

export async function testGa4Connection(
  propertyId: string,
  refreshToken: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const auth = makeOAuth2Client();
    auth.setCredentials({ refresh_token: refreshToken });

    const analyticsClient = new BetaAnalyticsDataClient({ authClient: auth as any });
    await analyticsClient.runReport({
      property:   `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'itemId' }],
      metrics:    [{ name: 'itemsViewed' }],
      limit:      1,
    });
    return { ok: true, message: 'GA4 bağlantısı başarılı' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `GA4 bağlantı hatası: ${msg}` };
  }
}
