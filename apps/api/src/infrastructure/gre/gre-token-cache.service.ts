import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import {
  createGreClientsFromEnv,
  type GreOAuthPort,
  type GreOAuthResult,
} from "@factosys/sunat-gre";

import { REDIS } from "../redis/redis.tokens";
import { CredentialsResolver } from "../documents/credentials-resolver";

const KEY_PREFIX = "gre:oauth:";
/** Refresh slightly before SUNAT expiry. */
const TTL_SKEW_SEC = 60;

/**
 * Redis-backed GRE OAuth token cache per company (S7-01).
 * Avoids re-login when a valid token is still cached.
 */
@Injectable()
export class GreTokenCacheService {
  private readonly oauth: GreOAuthPort;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly credentials: CredentialsResolver,
  ) {
    this.oauth = createGreClientsFromEnv().oauth;
  }

  async getAccessToken(companyId: string): Promise<string> {
    const cached = await this.redis.get(KEY_PREFIX + companyId);
    if (cached) {
      return cached;
    }

    const gre = await this.credentials.resolveGre(companyId);
    const sol = await this.credentials.resolveSol(companyId);
    const token = await this.oauth.getAccessToken({
      clientId: gre.clientId,
      clientSecret: gre.clientSecret,
      solUser: sol.username,
      solPassword: sol.password,
    });

    await this.store(companyId, token);
    return token.accessToken;
  }

  async invalidate(companyId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + companyId);
  }

  private async store(
    companyId: string,
    token: GreOAuthResult,
  ): Promise<void> {
    const ttl = Math.max(30, token.expiresInSec - TTL_SKEW_SEC);
    await this.redis.set(
      KEY_PREFIX + companyId,
      token.accessToken,
      "EX",
      ttl,
    );
  }
}
