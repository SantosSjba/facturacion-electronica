/**
 * CLI: validate XML against XSD and/or Excel P0 (document type 01).
 *
 * Usage: pnpm validate:xml --type=01 [--stages=xsd,excel] <path-to-xml>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CompositeSunatValidationAdapter,
  type SunatValidationStage,
} from "../src/index";

function usage(): never {
  console.error(
    "Usage: pnpm validate:xml --type=01 [--stages=xsd,excel] <path-to-xml>",
  );
  process.exit(2);
}

function parseArgs(argv: string[]): {
  type: string;
  file: string;
  stages: SunatValidationStage[];
} {
  let type = "";
  let stagesRaw = "xsd,excel";
  const positionals: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--type=")) {
      type = arg.slice("--type=".length);
    } else if (arg.startsWith("--stages=")) {
      stagesRaw = arg.slice("--stages=".length);
    } else if (arg.startsWith("-")) {
      usage();
    } else {
      positionals.push(arg);
    }
  }
  const file = positionals[0];
  if (!type || !file) usage();

  const stages = stagesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as SunatValidationStage[];
  for (const s of stages) {
    if (s !== "xsd" && s !== "excel") {
      console.error(`[validate:xml] Unknown stage '${s}' (use xsd, excel)`);
      process.exit(2);
    }
  }
  return { type, file, stages };
}

async function main(): Promise<void> {
  const { type, file, stages } = parseArgs(process.argv.slice(2));
  if (type !== "01") {
    console.error(
      `[validate:xml] Unsupported --type=${type} (only 01)`,
    );
    process.exit(2);
  }

  const abs = resolve(process.cwd(), file);
  const xml = readFileSync(abs, "utf8");
  const port = new CompositeSunatValidationAdapter();
  const result = await port.validateXml({
    documentType: "01",
    xml,
    stages,
  });

  console.log(`[validate:xml] rulesetVersion=${result.rulesetVersion}`);
  console.log(`[validate:xml] stages=${stages.join(",")}`);
  if (result.ok) {
    console.log(`[validate:xml] OK ${abs}`);
    process.exit(0);
  }

  console.error(
    `[validate:xml] FAIL ${abs} (${result.issues.length} issue(s))`,
  );
  for (const issue of result.issues) {
    const loc = issue.path ? ` @ ${issue.path}` : "";
    const code = issue.sunatCode ? ` sunat=${issue.sunatCode}` : "";
    console.error(`  - [${issue.stage}]${code} ${issue.message}${loc}`);
  }
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error("[validate:xml]", err);
  process.exit(1);
});
