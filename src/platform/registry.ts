/**
 * Resolves the adapter for a user's store. Today every store is T-Soft (or
 * the demo catalogue, which speaks the same client API); a second platform
 * plugs in here.
 */
import { getClientForUser } from '../services/tsoft-client';
import { DemoTSoftClient } from '../services/demo-tsoft-client';
import { TSoftAdapter, TSOFT_PLATFORM } from './tsoft/TSoftAdapter';
import type { PlatformAdapter, PlatformInfo } from './types';

export const PLATFORMS: Record<string, PlatformInfo> = {
  tsoft: TSOFT_PLATFORM,
};

/** Platform of the connected store. Single-platform for now. */
export function platformInfoFor(_userId?: number): PlatformInfo {
  return PLATFORMS.tsoft;
}

export async function getAdapterForUser(userId: number, tenantId?: number): Promise<PlatformAdapter> {
  const client = await getClientForUser(userId, tenantId);
  return new TSoftAdapter(client, client instanceof DemoTSoftClient ? 'demo' : 'tsoft');
}
