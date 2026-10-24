import {
  ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { accessQueries } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import type { SparkTrackDatabase } from '@sparktrack/db';
import { KYSELY } from '../database/database.module';

export type Role = 'LEARNER' | 'PARENT' | 'MENTOR' | 'SCHOOL_ADMIN' | 'ORG_PARTNER' | 'SUPER_ADMIN';
export interface AuthUser { id: string; role: Role; organisationId: string | null }

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ALLOW_UNPROVISIONED_LEARNER = 'allowUnprovisionedLearner';
export const AllowUnprovisionedLearner = () => SetMetadata(ALLOW_UNPROVISIONED_LEARNER, true);
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

/**
 * Global guard: verifies the Supabase access token (JWKS if SUPABASE_JWKS_URL is set, otherwise the HS256
 * secret), then resolves the caller from core.users. Deny-by-default; opt out with @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private jwks: JWTVerifyGetKey | null = null;
  private cache = new Map<string, { user: AuthUser; exp: number }>();

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    const sub = await this.verify(header.slice(7));

    const hit = this.cache.get(sub);
    let user = hit && hit.exp > Date.now() ? hit.user : null;
    if (!user) {
      const row = await accessQueries.userById(this.db, sub);
      if (!row) {
        const mayProvision = this.reflector.getAllAndOverride<boolean>(ALLOW_UNPROVISIONED_LEARNER, [ctx.getHandler(), ctx.getClass()]);
        if (!mayProvision) throw new UnauthorizedException();
        user = { id: sub, role: 'LEARNER', organisationId: null };
      } else {
        if (!row.is_active) throw new UnauthorizedException();
        user = { id: row.id, role: row.role as Role, organisationId: row.organisation_id };
        this.cache.set(sub, { user, exp: Date.now() + 30_000 });
      }
    }
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role) && user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return true;
  }

  private async verify(token: string): Promise<string> {
    try {
      const jwksUrl = this.config.get<string>('SUPABASE_JWKS_URL');
      const issuer = this.config.get<string>('SUPABASE_JWT_ISSUER');
      const opts = { audience: 'authenticated', ...(issuer ? { issuer } : {}) };
      if (jwksUrl) {
        this.jwks ??= createRemoteJWKSet(new URL(jwksUrl));
        return (await jwtVerify(token, this.jwks, opts)).payload.sub!;
      }
      const secret = new TextEncoder().encode(this.config.getOrThrow<string>('SUPABASE_JWT_SECRET'));
      return (await jwtVerify(token, secret, { ...opts, algorithms: ['HS256'] })).payload.sub!;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

/** Object-level authorisation, delegated to the DB function that also backs RLS (single source of truth). */
@Injectable()
export class LearnerAccessService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}
  async assertCanAccess(user: AuthUser, learnerId: string) {
    if (!(await accessQueries.canAccessLearner(this.db, user.id, learnerId))) throw new ForbiddenException();
  }
}
