import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RecommendationEngineService } from './recommendation-engine.service';
import { CurrentUser, LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';

const SuggestSkillsSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  artifactType: z.string().max(60).optional(),
});

@ApiTags('reports')
@ApiBearerAuth()
@Controller('v1/reports')
export class RecommendationEngineController {
  constructor(private readonly engine: RecommendationEngineService, private readonly access: LearnerAccessService) {}

  @Post('suggest-skills')
  @ApiOperation({ summary: 'Suggest matching capability graph skills and coaching tip from a project draft (Gemini AI + deterministic fallback)' })
  suggestSkills(@Body() body: unknown) {
    return this.engine.suggestSkillsFromDraft(SuggestSkillsSchema.parse(body));
  }

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

