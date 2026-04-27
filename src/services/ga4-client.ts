import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { Ga4ProductMetric } from '../db/ga4.repo';

function dateRangeToStartDate(range: string): string {
  switch (range) {
    case '7d':  return '7daysAgo';
    case '14d': return '14daysAgo';
    case '30d': return '30daysAgo';
    case '90d': return '90daysAgo';
    default:    return '30daysAgo';
  }
}

function makeClient(serviceAccountJson: string): BetaAnalyticsDataClient {
  const sa = JSON.parse(serviceAccountJson);
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: sa.client_email,
      private_key:  sa.private_key,
    },
  });
}

export async function fetchGa4ProductMetrics(
  propertyId: string,
  serviceAccountJson: string,
  dateRange = '30d'
): Promise<Ga4ProductMetric[]> {
  const client    = makeClient(serviceAccountJson);
  const startDate = dateRangeToStartDate(dateRange);

  const [response] = await client.runReport({
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

    const viewsVal     = parseInt(views, 10)    || 0;
    const sessionsVal  = parseInt(sessions, 10) || 0;
    const ctrVal       = parseFloat(ctr) * 100;            // GA4 oranı → yüzde
    const purchasesVal = parseInt(purchases, 10) || 0;
    const revenueVal   = parseFloat(revenue) || 0;
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
  serviceAccountJson: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const client = makeClient(serviceAccountJson);
    await client.runReport({
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
