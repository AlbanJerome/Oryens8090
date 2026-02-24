/**
 * WO-GL-014: Audit logging for state changes.
 * Payload must include tenantId and userId for every action.
 */

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
}

export interface IAuditLoggerRepository {
  append(entry: AuditLogEntry): Promise<void>;
}

export interface IAuditLogger {
  /**
   * Log an action. Payload is merged with tenantId and userId so every log has them.
   */
  log(entry: AuditLogEntry): Promise<void>;
}

export class AuditLoggerService implements IAuditLogger {
  constructor(private readonly repository: IAuditLoggerRepository) {}

  async log(entry: AuditLogEntry): Promise<void> {
    const payload = {
      ...entry.payload,
      tenantId: entry.tenantId,
      userId: entry.userId ?? null
    };
    await this.repository.append({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload
    });
  }
}
