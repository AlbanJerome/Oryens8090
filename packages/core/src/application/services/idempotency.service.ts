export interface IdempotencyRecord {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  commandType: string;
  result: Record<string, any>;
  executedAt: Date;
  expiresAt: Date;
}

export interface IIdempotencyRepository {
  findByKey(tenantId: string, idempotencyKey: string): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}

export class IdempotencyService {
  constructor(private repository: IIdempotencyRepository) {}

  async findExisting(tenantId: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.repository.findByKey(tenantId, idempotencyKey);
  }

  async recordExecution(
    tenantId: string,
    idempotencyKey: string,
    commandType: string,
    result: any
  ): Promise<void> {
    const record: IdempotencyRecord = {
      id: crypto.randomUUID(),
      tenantId,
      idempotencyKey,
      commandType,
      result,
      executedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    await this.repository.save(record);
  }
}
