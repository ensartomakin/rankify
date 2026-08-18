import type { SeasonPreFilter } from '../types/product';

function parseSeasonInfo(season: string) {
  const upper = season.toUpperCase();
  return {
    isYaz:      upper.includes('YAZ'),
    isIlkbahar: upper.includes('LKBAHAR'),
    isKis:      upper.includes('KI'),
    isSonbahar: upper.includes('SONBAHAR'),
  };
}

/** Ürünün sezon etiketi, verilen ön-sıralama filtresine göre "tercih edilen" grupta mı? */
export function isPreferredSeason(season: string, filter: SeasonPreFilter): boolean {
  if (!season || filter === 'none') return false;
  const { isYaz, isIlkbahar, isKis, isSonbahar } = parseSeasonInfo(season);
  return filter === 'yaz-ilkbahar' ? (isYaz || isIlkbahar) : (isKis || isSonbahar);
}
