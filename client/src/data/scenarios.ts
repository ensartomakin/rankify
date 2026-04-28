import type { WeightCriterion } from '../types';

export interface Scenario {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'hero',
    emoji: '🌟',
    name: 'The Hero Strategy',
    tagline: 'Ana Vitrin Modu',
    description:
      'Sosyal medyada aranan, en çok ilgi gören ve markayı temsil eden "yıldız" ürünleri öne çıkarır. Vitrin ürününün bedeni olmalı.',
    criteria: [
      { key: 'ga4Ctr',    weight: 40, direction: 'desc', salesPeriod: '1m' },
      { key: 'bestSeller', weight: 40, direction: 'desc', salesPeriod: '14d' },
      { key: 'newness',   weight: 20, direction: 'desc' },
    ],
  },
  {
    id: 'rising-stars',
    emoji: '🚀',
    name: 'Rising Stars',
    tagline: 'Viral & Trend Yakalayıcı',
    description:
      'Yeni gelen koleksiyon içinden sosyal medyanın ve müşterinin "anlık" tepki verdiği potansiyelleri parlatır.',
    criteria: [
      { key: 'newness',          weight: 50, direction: 'desc' },
      { key: 'ga4Ctr',           weight: 30, direction: 'desc', salesPeriod: '3d' },
      { key: 'ga4ConversionRate', weight: 20, direction: 'desc', salesPeriod: '3d' },
    ],
  },
  {
    id: 'conversion-max',
    emoji: '💰',
    name: 'Conversion Maximizer',
    tagline: 'Verimli Ciro',
    description:
      'Reklamla gelen trafiği "en kolay ve en hızlı" paraya çevirecek ürünleri dizer. Beden bulunurluğu kritik — aktif tutun.',
    criteria: [
      { key: 'ga4ConversionRate', weight: 40, direction: 'desc', salesPeriod: '14d' },
      { key: 'discountRate',      weight: 40, direction: 'desc' },
      { key: 'stockScore',        weight: 20, direction: 'desc' },
    ],
  },
  {
    id: 'liquidation',
    emoji: '🏷️',
    name: 'Inventory Liquidation',
    tagline: 'Stok Eritme / Outlet',
    description:
      'Depoda bekleyen sermayeyi (stok) hızla nakde çevirmek için tasarlanmıştır. En eski ürünler tepeye gelir.',
    criteria: [
      { key: 'stockScore',   weight: 40, direction: 'desc' },
      { key: 'discountRate', weight: 40, direction: 'desc' },
      { key: 'newness',      weight: 20, direction: 'asc' },
    ],
  },
  {
    id: 'social-proof',
    emoji: '⭐',
    name: 'Social Proof Excellence',
    tagline: 'Müşteri Onayı',
    description:
      'Kararsız yeni müşterilere "Başkaları bunu sevdi" mesajı vererek güven aşılar.',
    criteria: [
      { key: 'reviewScore',      weight: 60, direction: 'desc' },
      { key: 'bestSeller',       weight: 30, direction: 'desc', salesPeriod: '14d' },
      { key: 'ga4ConversionRate', weight: 10, direction: 'desc', salesPeriod: '1m' },
    ],
  },
  {
    id: 'hidden-gems',
    emoji: '💎',
    name: 'Hidden Gems',
    tagline: 'Fırsat Keşfi',
    description:
      'İnsanların beğendiği (tıklanan) ama "tek bir dokunuşla" (indirim) satış rekoru kırabilecekleri bulur. Az satan ama ilgi çekenleri yukarı iter.',
    criteria: [
      { key: 'ga4Ctr',      weight: 40, direction: 'desc', salesPeriod: '14d' },
      { key: 'discountRate', weight: 40, direction: 'desc' },
      { key: 'bestSeller',  weight: 20, direction: 'asc',  salesPeriod: '14d' },
    ],
  },
  {
    id: 'brand-new',
    emoji: '✨',
    name: 'Brand New Performance',
    tagline: 'Yeni Sezon Odaklı',
    description:
      'Mağazanın güncelliğini korurken, yeni gelenler arasından en başarılı olanları belirler.',
    criteria: [
      { key: 'newness',   weight: 50, direction: 'desc' },
      { key: 'ga4Views',  weight: 30, direction: 'desc', salesPeriod: '7d' },
      { key: 'stockScore', weight: 20, direction: 'desc' },
    ],
  },
  {
    id: 'campaign',
    emoji: '🔥',
    name: 'Campaign Booster',
    tagline: 'Büyük İndirim Dönemi',
    description:
      '11.11 veya Black Friday gibi trafik patlaması olan günlerde sepeti en çok dolduranları dizer.',
    criteria: [
      { key: 'discountRate',      weight: 50, direction: 'desc' },
      { key: 'ga4ConversionRate', weight: 30, direction: 'desc', salesPeriod: '3d' },
      { key: 'stockScore',        weight: 20, direction: 'desc' },
    ],
  },
  {
    id: 'loyalty',
    emoji: '🤝',
    name: 'Smart Loyalty',
    tagline: 'Sadık Müşteri Vitrini',
    description:
      'Siteye her gün giren sadık kitleye "bugünün popülerleri" hissini verir.',
    criteria: [
      { key: 'newness',  weight: 40, direction: 'desc' },
      { key: 'ga4Ctr',   weight: 40, direction: 'desc', salesPeriod: '7d' },
      { key: 'bestSeller', weight: 20, direction: 'desc', salesPeriod: '14d' },
    ],
  },
  {
    id: 'steady',
    emoji: '⚖️',
    name: 'Steady Growth',
    tagline: 'Genel Sağlık Ayarı',
    description:
      'Riskleri dağıtan, ne sadece ucuz ne sadece yeni diyen, mağazanın genel dengeli modudur.',
    criteria: [
      { key: 'newness',      weight: 34, direction: 'desc' },
      { key: 'bestSeller',   weight: 33, direction: 'desc', salesPeriod: '14d' },
      { key: 'discountRate', weight: 33, direction: 'desc' },
    ],
  },
];
