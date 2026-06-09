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
