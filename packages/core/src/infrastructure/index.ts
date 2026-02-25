/**
 * Infrastructure adapters (e.g. Postgres repository implementations).
 * WO-GL-011: Entity repository for consolidation.
 */

export {
  EntityRepositoryPostgres,
  type PgClient
} from './repositories/EntityRepository.postgres';
