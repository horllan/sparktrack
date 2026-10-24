import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PathwayEngineService } from './pathway-engine.service';
import { CurrentUser, LearnerAccessService, type AuthUser } from '../../common/auth/auth.guard';

@ApiTags('pathways')
@ApiBearerAuth()
@Controller('v1/pathways')
export class PathwayEngineController {
  constructor(private readonly engine: PathwayEngineService, private readonly access: LearnerAccessService) {}

  @Get(':learnerId/affinities')
  @ApiOperation({ summary: 'Career & entrepreneurship pathway affinities (exploration signals, not assignments)' })
  async affinities(@CurrentUser() user: AuthUser, @Param('learnerId', ParseUUIDPipe) learnerId: string) {
    await this.access.assertCanAccess(user, learnerId);
    return this.engine.affinities(learnerId);
  }
}

