import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDrizzleClient, createKyselyClient } from '@sparktrack/db';

export const DRIZZLE = Symbol('DRIZZLE');
export const KYSELY = Symbol('KYSELY');

@Global()
@Module({
  providers: [
    { provide: DRIZZLE, inject: [ConfigService], useFactory: (c: ConfigService) => createDrizzleClient(c.getOrThrow<string>('DATABASE_URL')) },
    // Kysely uses the direct (session) connection: advisory locks and set_config need session semantics.
    { provide: KYSELY, inject: [ConfigService], useFactory: (c: ConfigService) =>
        createKyselyClient(c.get<string>('DIRECT_DATABASE_URL') ?? c.getOrThrow<string>('DATABASE_URL')) },
  ],
  exports: [DRIZZLE, KYSELY],
})
export class DatabaseModule {}

