import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env.schema";
import { ObjectStorageService } from "../storage/object-storage.service";

const ALG = "aes-256-gcm";
const VERSION = 1;

export interface EncryptedEnvelope {
  v: number;
  alg: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class CredentialsVault {
  private readonly masterKey: Buffer;

  constructor(
    private readonly storage: ObjectStorageService,
    config: ConfigService<Env, true>,
  ) {
    this.masterKey = Buffer.from(
      config.get("CREDENTIALS_MASTER_KEY", { infer: true }),
      "base64",
    );
  }

  encryptJson(payload: unknown): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALG, this.masterKey, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope: EncryptedEnvelope = {
      v: VERSION,
      alg: ALG,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    return Buffer.from(JSON.stringify(envelope), "utf8");
  }

  decryptJson<T>(blob: Buffer): T {
    const envelope = JSON.parse(blob.toString("utf8")) as EncryptedEnvelope;
    if (envelope.v !== VERSION || envelope.alg !== ALG) {
      throw new Error("Unsupported credentials envelope");
    }
    const decipher = createDecipheriv(
      ALG,
      this.masterKey,
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString("utf8")) as T;
  }

  secretRef(bucket: string, key: string): string {
    return `minio://${bucket}/${key}`;
  }

  parseSecretRef(ref: string): { bucket: string; key: string } {
    const m = /^minio:\/\/([^/]+)\/(.+)$/.exec(ref);
    if (!m?.[1] || !m[2]) {
      throw new Error(`Invalid secret_ref: ${ref}`);
    }
    return { bucket: m[1], key: m[2] };
  }

  buildObjectKey(input: {
    organizationId: string;
    companyId: string;
    kind: string;
    credentialId: string;
  }): string {
    return `org/${input.organizationId}/company/${input.companyId}/credentials/${input.kind}/${input.credentialId}`;
  }

  async putSecret(
    key: string,
    payload: unknown,
  ): Promise<{ secretRef: string }> {
    const blob = this.encryptJson(payload);
    await this.storage.putObject(key, blob, "application/json");
    return { secretRef: this.secretRef(this.storage.getBucket(), key) };
  }

  async getSecret<T>(secretRef: string): Promise<T> {
    const { key } = this.parseSecretRef(secretRef);
    const blob = await this.storage.getObject(key);
    return this.decryptJson<T>(blob);
  }
}
