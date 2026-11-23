import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
    { rawBody: true },
  );

  // Security headers + rate limiting (per-IP; tune for the pilot)
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS for the web platform (normalize trailing slashes, support comma-separated origins & SparkTrack Vercel deploys)
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const sparktrackVercelOrigin = /^https:\/\/sparktrack(?:-[a-z0-9-]+)?\.vercel\.app$/i;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(normalized) ||
        allowedOrigins.includes('*') ||
        sparktrackVercelOrigin.test(normalized)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SparkTrack Intelligence API')
    .setDescription(
      'Headless intelligence engine for early talent development, career exploration, ' +
      'and evidence-based skill assessment. Non-deterministic by design.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('evidence', 'Evidence ingestion, sync & cryptographic ledger')
    .addTag('skills', 'Skill scoring & time-decayed evidence weighting')
    .addTag('graph', 'Capability graph traversal & pgvector similarity')
    .addTag('progress', 'Bitemporal learner progression tracking')
    .addTag('pathways', 'Career & entrepreneurship pathway affinity')
    .addTag('reports', 'AI-synthesized development reports')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 SparkTrack API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
