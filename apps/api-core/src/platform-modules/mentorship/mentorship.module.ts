import { Body, Controller, Get, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { mentorshipQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

const AssignMentorSchema = z.object({
  mentorId: z.string().uuid(),
  mentorName: z.string().min(2).max(120).optional(),
  cohortId: z.string().uuid(),
  learnerId: z.string().uuid().nullable().optional(),
});

const VerifyArtifactSchema = z.object({
  qualityScore: z.number().min(0).max(1),
  mentorName: z.string().min(2).max(120).optional(),
});

@ApiTags('mentorship')
@ApiBearerAuth()
@Controller('v1/mentorship')
class MentorshipController {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}

  @Get('queue')
  @Roles('MENTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List learner artifacts awaiting mentor verification and rubric scoring' })
  queue(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(Number(limit) || 25, 1), 100) : 25;
    return mentorshipQueries.pendingQueue(this.db, parsedLimit);
  }

  @Post('assignments')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign a mentor to a programme cohort or specific learner' })
  assign(@Body() body: unknown) {
    const parsed = AssignMentorSchema.parse(body);
    return mentorshipQueries.assignMentor(this.db, parsed);
  }

  @Post('artifacts/:artifactId/verify')
  @Roles('MENTOR', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Verify an artifact and record the mentor quality score' })
  async verify(
    @CurrentUser() user: AuthUser,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
    @Body() body: unknown,
  ) {
    const parsed = VerifyArtifactSchema.parse(body);
    const updated = await mentorshipQueries.verifyArtifact(this.db, {
      artifactId,
      mentorId: user.id,
      mentorName: parsed.mentorName,
      qualityScore: parsed.qualityScore,
    });
    if (!updated) throw new NotFoundException('Artifact not found');
    return updated;
  }
}

@Module({ controllers: [MentorshipController] })
export class MentorshipModule {}
