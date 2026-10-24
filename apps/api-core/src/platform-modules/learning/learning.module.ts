import { Controller, Get, Inject, Module, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { learningQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { CurrentUser, LearnerAccessService, Public, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

@ApiTags('learning')
@Controller('v1/learning')
class LearningController {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
    private readonly access: LearnerAccessService,
  ) {}

  @Public()
  @Get('skills')
  @ApiOperation({ summary: 'List all skill nodes in the capability graph' })
  skills() {
    return learningQueries.skillCatalogue(this.db);
  }

  @ApiBearerAuth()
  @Get('learners/:learnerId/summary')
  @ApiOperation({ summary: 'Get learner profile summary, consent status, and artifact counts' })
  async learnerSummary(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    const summary = await learningQueries.learnerSummary(this.db, learnerId);
    if (!summary) throw new NotFoundException('Learner profile not found');
    return summary;
  }

  @ApiBearerAuth()
  @Get('learners/:learnerId/artifacts')
  @ApiOperation({ summary: 'List sealed evidence artifacts and cryptographic ledger hashes for a learner' })
  async learnerArtifacts(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    return learningQueries.learnerArtifacts(this.db, learnerId);
  }
}

@Module({ controllers: [LearningController] })
export class LearningModule {}
