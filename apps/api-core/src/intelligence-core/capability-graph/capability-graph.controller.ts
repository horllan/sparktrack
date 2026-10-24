import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../../common/auth/auth.guard';
import { CapabilityGraphService } from './capability-graph.service';

const TraverseSchema = z.object({
  startNodeIds: z.array(z.string().uuid()).min(1).max(50),
  maxDepth: z.number().int().min(1).max(6).default(4),
});
const SimilarSchema = z.object({ embedding: z.array(z.number()).length(768), limit: z.number().int().min(1).max(50).default(10) });

@ApiTags('graph')
@Controller('v1/graph')
export class CapabilityGraphController {
  constructor(private readonly graph: CapabilityGraphService) {}

  @Public()
  @Get('topology')
  @ApiOperation({ summary: 'Return full Capability Graph nodes and weighted edges' })
  topology() {
    return this.graph.topology();
  }

  @ApiBearerAuth()
  @Post('traverse')
  @ApiOperation({ summary: 'Weighted traversal from nodes to reachable capabilities/pathways' })
  traverse(@Body() body: unknown) {
    const b = TraverseSchema.parse(body);
    return this.graph.traverse(b.startNodeIds, b.maxDepth);
  }

  @ApiBearerAuth()
  @Post('similar')
  @ApiOperation({ summary: 'Semantic nearest nodes (768-d halfvec cosine, HNSW)' })
  similar(@Body() body: unknown) {
    const b = SimilarSchema.parse(body);
    return this.graph.similar(b.embedding, b.limit);
  }
}
