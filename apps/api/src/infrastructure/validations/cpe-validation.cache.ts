import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";

import type { Env } from "../config/env.schema";
import { REDIS } from "../redis/redis.tokens";
import type {
  CpeValidationPort,
  CpeValidationRequest,
  CpeValidationResult,
} from "./cpe-validation.port";

@Injectable()
export class CpeValidationCache {
  private readonly ttlSec: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSec = config.get("CPE_VALIDATION_CACHE_TTL_SEC", { infer: true });
  }

  cacheKey(organizationId: string, input: CpeValidationRequest): string {
    const raw = [
      organizationId,
      input.ruc,
      input.documentType,
      input.serie,
      String(input.number),
      input.issueDate,
      input.totalAmount.toFixed(2),
    ].join("|");
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
    return `cpe-val:${organizationId}:${hash}`;
  }

  async get(
    organizationId: string,
    input: CpeValidationRequest,
  ): Promise<CpeValidationResult | null> {
    const key = this.cacheKey(organizationId, input);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CpeValidationResult;
    } catch {
      return null;
    }
  }

  async set(
    organizationId: string,
    input: CpeValidationRequest,
    result: CpeValidationResult,
  ): Promise<void> {
    const key = this.cacheKey(organizationId, input);
    await this.redis.set(key, JSON.stringify(result), "EX", this.ttlSec);
  }
}

export const CPE_VALIDATION_PORT = Symbol("CPE_VALIDATION_PORT");

export type { CpeValidationPort };
