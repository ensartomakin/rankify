import { apiFetch } from './http';
import type { WeightCriterion } from '../types';

export interface SavedConfig {
  id: number;
  categoryId: string;
  categoryName?: string;
  availabilityThreshold: number;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion];
  isActive: boolean;
}

export async function fetchConfigs(): Promise<SavedConfig[]> {
  const res = await apiFetch('/api/configs');
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}

export async function saveConfig(
  config: Omit<SavedConfig, 'id' | 'isActive'>
): Promise<SavedConfig> {
  const res = await apiFetch('/api/configs', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.formErrors?.[0] ?? `Hata: ${res.status}`);
  }
  return res.json();
}

export async function deleteConfig(categoryId: string): Promise<void> {
  const res = await apiFetch(`/api/configs/${categoryId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
}

export async function triggerSaved(categoryId: string): Promise<void> {
  const res = await apiFetch(`/api/ranking/trigger/${categoryId}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
}
