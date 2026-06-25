export const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export const sleep = (ms: number): Promise<void> =>
  new Promise(r => setTimeout(r, ms));

export const minMaxNormalize = (values: number[]): number[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Tüm değerler sıfırsa (ör. hiç satış yok) herkes 0 alır, 50 değil
  if (max === min) return values.map(() => (max === 0 ? 0 : 50));
  return values.map(v => ((v - min) / (max - min)) * 100);
};

// Sayım bazlı metrikler için (satış, stok, yorum, görüntülenme…):
// log(v+1) dönüşümü yaparak min-max uygular.
// Bu sayede bir outlier (ör. 500 saten ürün) diğerlerini 0'a ezmez;
// 10 satan ürün, 500 satana göre göreceli olarak daha adil puan alır.
export const logMinMaxNormalize = (values: number[]): number[] =>
  minMaxNormalize(values.map(v => Math.log1p(Math.max(0, v))));
