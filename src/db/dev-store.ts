// Geliştirme ortamı için in-memory veri deposu.
// DATABASE_URL tanımlı değilse otomatik devreye girer; restart'ta sıfırlanır.

export interface DevUser {
  id: number;
  email: string;
  passwordHash: string;
  name?: string;
}

export interface DevConfig {
  id: number;
  userId: number;
  categoryId: string;
  categoryName?: string;
  availabilityThreshold: number;
  criteria: unknown[];
  isActive: boolean;
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
}

export interface DevSchedule {
  isEnabled: boolean;
  dayHours:  Record<number, number[]>;
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
