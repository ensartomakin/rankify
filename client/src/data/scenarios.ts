import type { WeightCriterion } from '../types';

export interface Scenario {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion, WeightCriterion];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'hero',
    emoji: '🌟',
    name: 'The Hero Strategy',
    tagline: 'Ana Vitrin Modu',
    description:
      'Sitenin en güvenilir, "amiral gemisi" ürünlerini sergiler. İstikrarlı popülarite ve uzun vadeli merak bir araya gelir.',
    criteria: [
      { key: 'bestSeller',  weight: 35, direction: 'desc', salesPeriod: '1m' },
      { key: 'ga4Ctr',      weight: 30, direction: 'desc', salesPeriod: '1m' },
      { key: 'reviewScore', weight: 20, direction: 'desc' },
      { key: 'newness',     weight: 15, direction: 'desc' },
    ],
  },
  {
    id: 'rising-stars',
    emoji: '🚀',
    name: 'Rising Stars',
    tagline: 'Viral & Trend Yakalayıcı',
    description:
      'Influencer paylaşımları veya ani trendlerle parlayan "yeni yıldızları" bulur. Son 72 saatin patlamasını yakalar.',
    criteria: [
      { key: 'bestSeller',   weight: 35, direction: 'desc', salesPeriod: '3d' },
      { key: 'ga4Ctr',       weight: 35, direction: 'desc', salesPeriod: '3d' },
      { key: 'newness',      weight: 15, direction: 'desc' },
      { key: 'ga4Sessions',  weight: 15, direction: 'desc', salesPeriod: '3d' },
    ],
  },
  {
    id: 'conversion-max',
    emoji: '💰',
    name: 'Conversion Maximizer',
    tagline: 'Verimli Ciro',
    description:
      'Reklam trafiğini en yüksek satın alma ihtimali olan ürünle buluşturur. CR, satış hızı ve indirim oranı bir arada.',
    criteria: [
      { key: 'ga4ConversionRate', weight: 35, direction: 'desc', salesPeriod: '14d' },
      { key: 'bestSeller',        weight: 25, direction: 'desc', salesPeriod: '7d' },
      { key: 'discountRate',      weight: 25, direction: 'desc' },
      { key: 'reviewScore',       weight: 15, direction: 'desc' },
    ],
  },
  {
    id: 'liquidation',
    emoji: '🏷️',
    name: 'Inventory Liquidation',
    tagline: 'Stok Eritme / Outlet',
    description:
      'Eski sezon ürünleri en hızlı şekilde nakde çevirir. En eski ürünler tepeye gelir.',
    criteria: [
      { key: 'stockScore',        weight: 35, direction: 'desc' },
      { key: 'discountRate',      weight: 35, direction: 'desc' },
      { key: 'newness',           weight: 15, direction: 'asc' },
      { key: 'availabilityScore', weight: 15, direction: 'desc' },
    ],
  },
  {
    id: 'social-proof',
    emoji: '⭐',
    name: 'Social Proof Excellence',
    tagline: 'Müşteri Onayı',
    description:
      'Klasikleşmiş ve kalitesi tescillenmiş ürünlerle güven tazeler. Yorum sayısı, uzun vadeli satış ve dönüşüm.',
    criteria: [
      { key: 'reviewScore',       weight: 50, direction: 'desc' },
      { key: 'bestSeller',        weight: 25, direction: 'desc', salesPeriod: '1m' },
      { key: 'newness',           weight: 15, direction: 'desc' },
      { key: 'ga4ConversionRate', weight: 10, direction: 'desc', salesPeriod: '2m' },
    ],
  },
  {
    id: 'hidden-gems',
    emoji: '💎',
    name: 'Hidden Gems',
    tagline: 'Fırsat Keşfi',
    description:
      'İnsanların beğendiği ama henüz satış rekoru kırmamış potansiyelleri parlatır. İlgi yüksek, satış az olanları bulur.',
    criteria: [
      { key: 'ga4Ctr',      weight: 35, direction: 'desc', salesPeriod: '14d' },
      { key: 'discountRate', weight: 30, direction: 'desc' },
      { key: 'reviewScore', weight: 20, direction: 'desc' },
      { key: 'bestSeller',  weight: 15, direction: 'asc',  salesPeriod: '1m' },
    ],
  },
  {
    id: 'fresh-performance',
    emoji: '✨',
    name: 'Fresh Performance',
    tagline: 'Yeni Sezon Odaklı',
    description:
      'Yeni koleksiyonda "ilk tepkisi" en iyi olanları belirler. Yeni gelip hemen satanları ön plana çıkarır.',
    criteria: [
      { key: 'newness',    weight: 40, direction: 'desc' },
      { key: 'bestSeller', weight: 25, direction: 'desc', salesPeriod: '3d' },
      { key: 'ga4Views',   weight: 20, direction: 'desc', salesPeriod: '7d' },
      { key: 'ga4Ctr',     weight: 15, direction: 'desc', salesPeriod: '7d' },
    ],
  },
  {
    id: 'flash-campaign',
    emoji: '🔥',
    name: 'Flash Campaign',
    tagline: 'Anlık Patlama',
    description:
      'Hafta sonu veya gece kampanyalarında sepeti en hızlı dolduranları dizer. İndirim + son 3 günün gücü.',
    criteria: [
      { key: 'discountRate',      weight: 40, direction: 'desc' },
      { key: 'bestSeller',        weight: 25, direction: 'desc', salesPeriod: '3d' },
      { key: 'ga4ConversionRate', weight: 20, direction: 'desc', salesPeriod: '3d' },
      { key: 'stockScore',        weight: 15, direction: 'desc' },
    ],
  },
  {
    id: 'smart-loyalty',
    emoji: '🤝',
    name: 'Smart Loyalty',
    tagline: 'Sadık Müşteri Vitrini',
    description:
      'Siteyi sık ziyaret eden müşteriye "bu haftanın özeti" hissini verir. Yenilik, bu haftanın favorileri ve CTR.',
    criteria: [
      { key: 'newness',     weight: 30, direction: 'desc' },
      { key: 'bestSeller',  weight: 25, direction: 'desc', salesPeriod: '7d' },
      { key: 'ga4Ctr',      weight: 25, direction: 'desc', salesPeriod: '7d' },
      { key: 'reviewScore', weight: 20, direction: 'desc' },
    ],
  },
  {
    id: 'balanced-matrix',
    emoji: '⚖️',
    name: 'The Balanced Matrix',
    tagline: 'Mağaza Sağlığı',
    description:
      'Mağazanın genel büyüme dengesini korur. Yenilik, uzun vadeli satış, indirim ve stok eşit ağırlıkla.',
    criteria: [
      { key: 'newness',      weight: 25, direction: 'desc' },
      { key: 'bestSeller',   weight: 25, direction: 'desc', salesPeriod: '1m' },
      { key: 'discountRate', weight: 25, direction: 'desc' },
      { key: 'stockScore',   weight: 25, direction: 'desc' },
    ],
  },
];
