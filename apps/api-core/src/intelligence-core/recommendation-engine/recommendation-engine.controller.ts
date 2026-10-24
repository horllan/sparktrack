import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationEngineService } from './recommendation-engine.service';
import { CurrentUser, LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('v1/reports')
export class RecommendationEngineController {
  constructor(private readonly engine: RecommendationEngineService, private readonly access: LearnerAccessService) {}

  @Post(':learnerId/generate')
  @ApiOperation({ summary: 'Generate a 13-part Development Report (Gemini + child-safety guardrail)' })
  async generate(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    return this.engine.generate(learnerId);
  }

  @Get(':learnerId/latest')
  @ApiOperation({ summary: 'Most recent persisted report' })
  async latest(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    const r = await this.engine.latest(learnerId);
    if (!r) throw new NotFoundException('No report generated yet');
    return r;
  }
}

