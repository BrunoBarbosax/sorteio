/* Contratos compartilhados entre frontend e backend (Gorjeta 77 Lukas). */

export type DrawStyle = 'classic' | 'neon' | 'gala';

export interface PublicParticipant {
  name: string;
  externalId: string;
  status: string;
  registeredAt: string;
}

export interface RegisterResponse {
  ok: boolean;
  message: string;
  participant: PublicParticipant;
}

export interface StatusResponse {
  found: boolean;
  message?: string;
  participant?: PublicParticipant;
}

export interface PublicInfo {
  branding: string;
  participantCount: number;
  pendingDraws: number;
  lastResult: Draw | null;
  serverTime: string;
  publicOrigin: string;
}

export interface DrawWinner {
  id?: string;
  name: string;
  externalId: string | null;
  position: number;
}

export interface PoolEntry {
  name: string;
  externalId: string;
  isWinner: boolean;
}

export interface Draw {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  winnerCount: number;
  durationSeconds: number;
  style: DrawStyle;
  soundEnabled: boolean;
  publicResults: boolean;
  publicShowIds: boolean;
  status: 'pending' | 'completed';
  eligibleCount: number | null;
  adminName: string | null;
  createdAt: string;
  createdAtIso: string;
  executedAt: string | null;
  winners: DrawWinner[];
  visualPool?: PoolEntry[] | null;
}

export interface Participant {
  id: string;
  name: string;
  externalId: string;
  status: 'active' | 'removed';
  createdAt: string;
  createdAtIso: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminStats {
  totalParticipants: number;
  removedParticipants: number;
  totalDraws: number;
  completedDraws: number;
  totalWinners: number;
  lastDraw: Draw | null;
  pendingDraw: Draw | null;
  serverTime: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface SessionResponse {
  authenticated: boolean;
  admin: AdminUser | null;
  csrfToken: string;
}

export interface AuditItem {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface DrawCreatePayload {
  name: string;
  description?: string;
  winnerCount: number;
  durationSeconds: number;
  style: DrawStyle;
  soundEnabled: boolean;
  publicResults: boolean;
  publicShowIds: boolean;
  executeNow: boolean;
}
