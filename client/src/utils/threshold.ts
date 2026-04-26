const THRESHOLD_KEY = 'rankify_threshold';

export function getStoredThreshold(): number {
  const v = localStorage.getItem(THRESHOLD_KEY);
  return v !== null ? parseFloat(v) : 0.6;
}

export function setStoredThreshold(val: number): void {
  localStorage.setItem(THRESHOLD_KEY, String(val));
}
