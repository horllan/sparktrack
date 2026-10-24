import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { graphQueries } from '@sparktrack/db';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../../common/database/database.module';

/** Capability Graph — recursive CTE traversal and pgvector (halfvec HNSW) similarity. */
@Injectable()
export class CapabilityGraphService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}
  traverse(startNodeIds: string[], maxDepth = 4) { return graphQueries.traverse(this.db, startNodeIds, maxDepth); }
  similar(embedding: number[], limit = 10) { return graphQueries.similar(this.db, embedding, limit); }
  edges() { return graphQueries.edgesWithNodes(this.db); }
}

