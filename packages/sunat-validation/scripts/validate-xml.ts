/**
 * CLI: validate an XML file against Invoice XSD (document type 01).
 *
 * Usage: pnpm validate:xml --type=01 <path-to-xml>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { XmllintXsdValidationAdapter } from "../src/index";

function usage(): never {
  console.error("Usage: pnpm validate:xml --type=01 <path-to-xml>");
  process.exit(2);
}

function parseArgs(argv: string[]): { type: string; file: string } {
  let type = "";
  const positionals: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--type=")) {
      type = arg.slice("--type=".length);
    } else if (arg.startsWith("-")) {
      usage();
    } else {
      positionals.push(arg);
    }
  }
  const file = positionals[0];
  if (!type || !file) usage();
  return { type, file };
}

async function main(): Promise<void> {
  const { type, file } = parseArgs(process.argv.slice(2));
  if (type !== "01") {
    console.error(
      `[validate:xml] Unsupported --type=${type} (S1-GATE: only 01)`,
    );
    process.exit(2);
  }

  const abs = resolve(process.cwd(), file);
  const xml = readFileSync(abs, "utf8");
  const port = new XmllintXsdValidationAdapter();
  const result = await port.validateXml({
    documentType: "01",
    xml,
    stages: ["xsd"],
  });

  console.log(`[validate:xml] rulesetVersion=${result.rulesetVersion}`);
  if (result.ok) {
    console.log(`[validate:xml] OK ${abs}`);
    process.exit(0);
  }

  console.error(
    `[validate:xml] FAIL ${abs} (${result.issues.length} issue(s))`,
  );
  for (const issue of result.issues) {
    const loc = issue.path ? ` @ ${issue.path}` : "";
    console.error(`  - [${issue.stage}] ${issue.message}${loc}`);
  }
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error("[validate:xml]", err);
  process.exit(1);
});
