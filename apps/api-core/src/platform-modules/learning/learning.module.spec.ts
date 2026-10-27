import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../common/auth/auth.guard';
import { LearningModule } from './learning.module';

describe('LearningController authorization', () => {
  it('restricts global materialized summary refresh to super admins', () => {
    const controllers = Reflect.getMetadata('controllers', LearningModule) as Array<{
      prototype: { refreshMaterializedSummary?: () => unknown };
    }>;
    const controller = controllers.find((candidate) =>
      Object.hasOwn(candidate.prototype, 'refreshMaterializedSummary'),
    );

    const handler = controller?.prototype.refreshMaterializedSummary;
    if (!handler) throw new Error('Materialized summary refresh route was not registered.');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['SUPER_ADMIN']);
  });
});
