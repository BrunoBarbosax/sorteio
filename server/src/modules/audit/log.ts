import type { Db } from '../../db';
import { newId } from '../../lib/ids';
import { sha256 } from '../../middleware/security';

export interface AuditInput {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: unknown;
  ip?: string | null;
}

/**
 * Registra acao administrativa para auditoria posterior.
 * O IP e armazenado apenas como hash (minimizacao de dados pessoais - LGPD).
 */
export async function audit(db: Db, input: AuditInput): Promise<void> {
  try {
    await db.run(
      `INSERT INTO audit_logs (id, admin_id, admin_email, action, entity, entity_id, details, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        input.adminId ?? null,
        input.adminEmail ?? null,
        input.action,
        input.entity ?? null,
        input.entityId ?? null,
        input.details ? JSON.stringify(input.details) : null,
        input.ip ? sha256(input.ip) : null,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    console.error('[auditoria] falha ao registrar log:', error instanceof Error ? error.message : error);
  }
}
