import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CapabilityGraphService } from './capability-graph.service';

const TraverseSchema = z.object({
  startNodeIds: z.array(z.string().uuid()).min(1).max(50),
  maxDepth: z.number().int().min(1).max(6).default(4),
});
const SimilarSchema = z.object({ embedding: z.array(z.number()).length(768), limit: z.number().int().min(1).max(50).default(10) });

@ApiTags('graph')
@ApiBearerAuth()
@Controller('v1/graph')
export class CapabilityGraphController {
  constructor(private readonly graph: CapabilityGraphService) {}

  @Post('traverse')
  @ApiOperation({ summary: 'Weighted traversal from nodes to reachable capabilities/pathways' })
  traverse(@Body() body: unknown) {
    const b = TraverseSchema.parse(body);
    return this.graph.traverse(b.startNodeIds, b.maxDepth);
  }

  @Post('similar')
  @ApiOperation({ summary: 'Semantic nearest nodes (768-d halfvec cosine, HNSW)' })
  similar(@Body() body: unknown) {
    const b = SimilarSchema.parse(body);
    return this.graph.similar(b.embedding, b.limit);
  }
}

