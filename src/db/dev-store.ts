// Geliştirme ortamı için in-memory veri deposu.
// DATABASE_URL tanımlı değilse otomatik devreye girer; restart'ta sıfırlanır.

export interface DevUser {
  id: number;
  email: string;
  passwordHash: string;
  name?: string;
  role: 'producer' | 'super_admin' | 'user';
}

export interface DevConfig {
  id: number;
  userId: number;
  categoryId: string;
  categoryName?: string;
  availabilityThreshold: number;
  criteria: unknown[];
  isActive: boolean;
  smartMix?: boolean;
  seasonPreFilter?: string;
  schedule?: { isEnabled: boolean; dayHours: Record<number, number[]> };
  createdAt: string;
  updatedAt: string;
}

export interface DevAuditLog {
  id: number;
  userId: number;
  categoryId: string;
  triggeredBy: string;
  totalProducts: number;
  qualifiedCount: number;
  disqualifiedCount: number;
  durationMs: number;
  status: string;
  errorMessage?: string;
  ranAt: string;
}

export interface DevCredentials {
  apiUrl: string; storeCode: string; apiUser: string; apiPassEnc: string; apiToken?: string;
  fieldMapping?: import('../types/field-mapping').FieldMapping;
}

/** Legacy account-wide schedule; only the migration notice flag is still used. */
export interface DevSchedule {
  isEnabled: boolean;
  dayHours:  Record<number, number[]>;
  legacyNotice?: boolean;
}

let userSeq   = 0;
let configSeq = 0;
let auditSeq  = 0;

export const store = {
  users:        new Map<number, DevUser>(),
  configs:      new Map<number, DevConfig>(),
  audits:       new Map<number, DevAuditLog>(),
  credentials: new Map<number, DevCredentials>(),
  schedules:   new Map<number, DevSchedule>(),

  nextUserId:   () => ++userSeq,
  nextConfigId: () => ++configSeq,
  nextAuditId:  () => ++auditSeq,
};
