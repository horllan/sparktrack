import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, LearnerAccessService } from './auth.guard';

@Global()
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, LearnerAccessService],
  exports: [LearnerAccessService],
})
export class AuthCoreModule {}

