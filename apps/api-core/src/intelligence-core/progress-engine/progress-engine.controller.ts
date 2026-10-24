import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgressEngineService } from './progress-engine.service';
import { CurrentUser, LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('v1/progress')
export class ProgressEngineController {
  constructor(private readonly progress: ProgressEngineService, private readonly access: LearnerAccessService) {}

  @Get(':learnerId')
  @ApiOperation({ summary: 'Learner capability profile; pass ?asOf=ISO-8601 for time-travel comparison' })
  async profile(
    @CurrentUser() user: AuthUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Query('asOf') asOf?: string,
  ) {
    await this.access.assertCanAccess(user, learnerId);
    const when = asOf ? new Date(asOf) : new Date();
    if (Number.isNaN(when.getTime())) throw new BadRequestException('asOf must be an ISO-8601 timestamp');
    return { learnerId, asOf: when.toISOString(), skills: await this.progress.profileAsOf(learnerId, when) };
  }
}

