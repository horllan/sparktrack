import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillEngineService } from './skill-engine.service';
import { CurrentUser, LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';

@ApiTags('skills')
@ApiBearerAuth()
@Controller('v1/skills')
export class SkillEngineController {
  constructor(private readonly skills: SkillEngineService, private readonly access: LearnerAccessService) {}

  @Get(':learnerId/scores')
  @ApiOperation({ summary: 'Live time-decayed skill scores (not persisted; see /v1/progress for history)' })
  async scores(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    return { learnerId, scores: await this.skills.computeAll(learnerId) };
  }
}

