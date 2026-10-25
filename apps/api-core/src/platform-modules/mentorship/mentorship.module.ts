import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { mentorshipQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

const AssignMentorSchema = z.object({
  mentorId: z.string().uuid(),
  cohortId: z.string().uuid(),
  learnerId: z.string().uuid().nullable().optional(),
});

const VerifyArtifactSchema = z.object({
  qualityScore: z.number().min(0).max(1),
});

@ApiTags('mentorship')
@ApiBearerAuth()
@Controller('v1/mentorship')
class MentorshipController {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}

  @Get('queue')
  @Roles('MENTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List learner artifacts awaiting mentor verification and rubric scoring' })
  queue(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(Number(limit) || 25, 1), 100) : 25;
    return mentorshipQueries.pendingQueue(
      this.db,
      { userId: user.id, role: user.role, organisationId: user.organisationId },
      parsedLimit,
    );
  }

  @Post('assignments')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign a mentor to a programme cohort or specific learner' })
  async assign(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = AssignMentorSchema.parse(body);
    const result = await mentorshipQueries.assignMentor(this.db, { ...parsed, actor: user });
    if (!result) throw new ForbiddenException('The mentor, cohort, or learner is not eligible for this assignment.');
    return result;
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
      actorRole: user.role,
      qualityScore: parsed.qualityScore,
    });
    if (!updated) throw new NotFoundException('Artifact not found');
    return updated;
  }
}

@Module({ controllers: [MentorshipController] })
export class MentorshipModule {}
