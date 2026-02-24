/**
 * WO-GL-011: Postgres implementation of IEntityRepository.
 * Maps entities table (ownership_percentage, consolidation_method) to domain Entity.
 */

import { Entity } from '../../domain/entities/entity.js';
import type { ConsolidationMethod } from '../../domain/entities/entity.js';
import type { IEntityRepository } from '../../application/repositories/interfaces.js';

/** Row shape returned by SELECT from entities table. */
interface EntityRow {
  id: string;
  tenant_id: string;
  name: string;
  parent_entity_id: string | null;
  ownership_percentage: string | number;
  consolidation_method: string;
  currency: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

/** Minimal pg client interface so this adapter can be used with pg.Client. */
export interface PgClient {
  query(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: EntityRow[] }>;
}

const VALID_CONSOLIDATION_METHODS: ConsolidationMethod[] = ['Full', 'Proportional', 'Equity'];

function mapRowToEntity(row: EntityRow): Entity {
  const ownershipPercentage =
    typeof row.ownership_percentage === 'string'
      ? parseFloat(row.ownership_percentage)
      : Number(row.ownership_percentage);
  const rawMethod = (row.consolidation_method ?? '').trim();
  const consolidationMethod = VALID_CONSOLIDATION_METHODS.includes(
    rawMethod as ConsolidationMethod
  )
    ? (rawMethod as ConsolidationMethod)
    : 'Full';

  return new Entity({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    parentEntityId: row.parent_entity_id ?? undefined,
    ownershipPercentage,
    consolidationMethod,
    currency: row.currency ?? 'USD',
    createdAt: row.created_at ?? new Date(),
    updatedAt: row.updated_at ?? undefined
  });
}

export class EntityRepositoryPostgres implements IEntityRepository {
  constructor(private readonly client: PgClient) {}

  async findById(tenantId: string, entityId: string): Promise<Entity | null> {
    const result = await this.client.query(
      `SELECT id, tenant_id, name, parent_entity_id, ownership_percentage, consolidation_method, currency, created_at, updated_at
       FROM entities WHERE tenant_id = $1 AND id = $2`,
      [tenantId, entityId]
    );
    const row = result.rows[0];
    return row ? mapRowToEntity(row) : null;
  }

  async findSubsidiaries(tenantId: string, parentEntityId: string): Promise<Entity[]> {
    const result = await this.client.query(
      `SELECT id, tenant_id, name, parent_entity_id, ownership_percentage, consolidation_method, currency, created_at, updated_at
       FROM entities WHERE tenant_id = $1 AND parent_entity_id = $2`,
      [tenantId, parentEntityId]
    );
    return result.rows.map(mapRowToEntity);
  }
}
