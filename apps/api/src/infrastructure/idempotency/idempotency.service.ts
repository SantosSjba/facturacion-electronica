import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import Redis from "ioredis";
import { idempotencyKeys, newId, type Db } from "@factosys/db";
import { AppError } from "@factosys/shared";

import { DB } from "../persistence/db.tokens";
import { REDIS } from "../redis/redis.tokens";
import { hashRequestBody } from "./request-hash";

const LOCK_TTL_SEC = 60;
const ROW_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyBeginResult =
  | {
      kind: "proceed";
      recordId: string;
      requestHash: string;
    }
  | {
      kind: "replay";
      responseCode: number;
      responseBody: unknown;
    };

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  lockKey(organizationId: string, companyId: string, key: string): string {
    return `idem:${organizationId}:${companyId}:${key}`;
  }

  async begin(input: {
    organizationId: string;
    companyId: string;
    key: string;
    requestPath: string;
    body: unknown;
  }): Promise<IdempotencyBeginResult> {
    this.assertKey(input.key);
    const requestHash = hashRequestBody(input.body);
    const redisKey = this.lockKey(
      input.organizationId,
      input.companyId,
      input.key,
    );

    const existing = await this.findRow(
      input.organizationId,
      input.companyId,
      input.key,
    );

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw AppError.idempotencyConflict();
      }
      if (
        existing.status === "completed" &&
        existing.responseCode != null &&
        existing.expiresAt.getTime() > Date.now()
      ) {
        return {
          kind: "replay",
          responseCode: existing.responseCode,
          responseBody: existing.responseBody,
        };
      }
      if (existing.status === "in_progress") {
        const lockHeld = await this.redis.exists(redisKey);
        if (lockHeld) {
          throw AppError.idempotencyConflict(
            "Idempotency-Key is already in progress",
          );
        }
        // Stale in_progress without lock — allow retry by cleaning up.
        await this.db
          .delete(idempotencyKeys)
          .where(eq(idempotencyKeys.id, existing.id));
      }
    }

    const locked = await this.redis.set(redisKey, "1", "EX", LOCK_TTL_SEC, "NX");
    if (locked !== "OK") {
      throw AppError.idempotencyConflict(
        "Idempotency-Key is already in progress",
      );
    }

    const recordId = newId();
    try {
      await this.db.insert(idempotencyKeys).values({
        id: recordId,
        organizationId: input.organizationId,
        companyId: input.companyId,
        key: input.key,
        requestHash,
        requestPath: input.requestPath,
        status: "in_progress",
        expiresAt: new Date(Date.now() + ROW_TTL_MS),
      });
    } catch (cause) {
      await this.redis.del(redisKey);
      // Race: another request inserted the unique key
      const raced = await this.findRow(
        input.organizationId,
        input.companyId,
        input.key,
      );
      if (raced && raced.requestHash !== requestHash) {
        throw AppError.idempotencyConflict();
      }
      if (
        raced?.status === "completed" &&
        raced.responseCode != null
      ) {
        return {
          kind: "replay",
          responseCode: raced.responseCode,
          responseBody: raced.responseBody,
        };
      }
      throw AppError.idempotencyConflict(
        "Idempotency-Key race; retry later",
        { cause },
      );
    }

    return { kind: "proceed", recordId, requestHash };
  }

  async complete(input: {
    organizationId: string;
    companyId: string;
    key: string;
    responseCode: number;
    responseBody: unknown;
    documentId?: string | null;
  }): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({
        status: "completed",
        responseCode: input.responseCode,
        responseBody: input.responseBody as Record<string, unknown>,
        documentId: input.documentId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(idempotencyKeys.organizationId, input.organizationId),
          eq(idempotencyKeys.companyId, input.companyId),
          eq(idempotencyKeys.key, input.key),
        ),
      );

    await this.redis.del(
      this.lockKey(input.organizationId, input.companyId, input.key),
    );
  }

  /**
   * Release lock and delete in_progress row so the client can retry.
   */
  async release(input: {
    organizationId: string;
    companyId: string;
    key: string;
  }): Promise<void> {
    const row = await this.findRow(
      input.organizationId,
      input.companyId,
      input.key,
    );
    if (row?.status === "in_progress") {
      await this.db
        .delete(idempotencyKeys)
        .where(eq(idempotencyKeys.id, row.id));
    }
    await this.redis.del(
      this.lockKey(input.organizationId, input.companyId, input.key),
    );
  }

  private assertKey(key: string): void {
    if (key.length < 8 || key.length > 128) {
      throw AppError.validation("Invalid Idempotency-Key", [
        { path: "Idempotency-Key", issue: "must be 8-128 characters" },
      ]);
    }
  }

  private async findRow(
    organizationId: string,
    companyId: string,
    key: string,
  ) {
    const rows = await this.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.organizationId, organizationId),
          eq(idempotencyKeys.companyId, companyId),
          eq(idempotencyKeys.key, key),
        ),
      )
      .limit(1);
    return rows[0];
  }
}
