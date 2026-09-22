import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  RULESET_ARTIFACT,
  RULESET_SHA256,
  RULESET_VERSION,
  catalogVersions,
  type Db,
} from "@factosys/db";

import { DB } from "../persistence/db.tokens";

export interface RulesetResponse {
  ruleset_version: string;
  source: string;
  source_sha256: string;
  default_for: {
    sandbox: Record<string, string>;
    production: Record<string, string>;
  };
  supported: Record<string, string[]>;
}

@Injectable()
export class RulesetService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getPlatformRuleset(): Promise<RulesetResponse> {
    const rows = await this.db.select().from(catalogVersions);

    const byKind = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byKind.get(row.kind) ?? [];
      list.push(row);
      byKind.set(row.kind, list);
    }

    const rulesetDefault =
      byKind
        .get("ruleset_excel")
        ?.find((r) => r.isDefault) ??
      byKind.get("ruleset_excel")?.[0];

    const version = rulesetDefault?.version ?? RULESET_VERSION;
    const sha = rulesetDefault?.sourceSha256 ?? RULESET_SHA256;
    const source =
      rulesetDefault?.sourceFilename ??
      RULESET_ARTIFACT.split("/").pop() ??
      "reglas-validacion-cpe-2026-08-26.xlsx";

    const pinDefaults = (env: "sandbox" | "production") => {
      const pick = (kind: string): string => {
        const list = byKind.get(kind) ?? [];
        const def = list.find((r) => r.isDefault) ?? list[0];
        return def?.version ?? (kind === "ruleset_excel" ? version : version);
      };
      return {
        ruleset: pick("ruleset_excel"),
        anexo_vii: pick("anexo_vii"),
        rs340: pick("rs340"),
        codigos_retorno: pick("codigos_retorno"),
      };
    };

    const supported: Record<string, string[]> = {};
    for (const [kind, list] of byKind) {
      const key =
        kind === "ruleset_excel"
          ? "ruleset"
          : kind === "codigos_retorno"
            ? "codigos_retorno"
            : kind;
      supported[key] = [...new Set(list.map((r) => r.version))];
    }
    if (!supported["ruleset"]?.length) {
      supported["ruleset"] = [version];
    }

    return {
      ruleset_version: version,
      source,
      source_sha256: sha,
      default_for: {
        sandbox: pinDefaults("sandbox"),
        production: pinDefaults("production"),
      },
      supported,
    };
  }

  async getEffectivePin(
    catalogPin: Record<string, string> | null | undefined,
  ): Promise<Record<string, string>> {
    const platform = await this.getPlatformRuleset();
    const base = platform.default_for.sandbox;
    return { ...base, ...(catalogPin ?? {}) };
  }
}
