import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { validateXML } from "xmllint-wasm";

import { validationError, validationInternal } from "../errors";
import type {
  SunatValidationInput,
  SunatValidationIssue,
  SunatValidationPort,
  SunatValidationResult,
} from "../ports/sunat-validation.port";
import {
  resolveCommonXsdDir,
  resolveRootXsdPath,
  resolveXsdCacheRoot,
  type SupportedXsdDocumentType,
} from "../schemas/paths";

function readRulesetVersion(cacheRoot: string): string {
  const marker = join(cacheRoot, ".sha256");
  if (!existsSync(marker)) {
    return "xsd-ubl-unknown";
  }
  const hash = readFileSync(marker, "utf8").trim().toLowerCase().slice(0, 12);
  return `xsd-ubl-${hash}`;
}

function loadSchemaBundle(documentType: SupportedXsdDocumentType): {
  schema: { fileName: string; contents: string };
  preload: { fileName: string; contents: string }[];
  rulesetVersion: string;
} {
  const cacheRoot = resolveXsdCacheRoot();
  const rootPath = resolveRootXsdPath(documentType);
  const commonDir = resolveCommonXsdDir();

  if (!existsSync(rootPath) || !existsSync(commonDir)) {
    throw validationError(
      "XSD cache missing. Run `pnpm sunat:unpack-schemas` first.",
      {
        details: [
          {
            path: rootPath,
            issue: "Invoice root XSD or common/ directory not found",
          },
        ],
      },
    );
  }

  const schemaContents = readFileSync(rootPath, "utf8");
  const schemaFileName = `maindoc/${basename(rootPath)}`;

  const preload: { fileName: string; contents: string }[] = [];
  for (const name of readdirSync(commonDir)) {
    if (!name.endsWith(".xsd")) continue;
    preload.push({
      fileName: `common/${name}`,
      contents: readFileSync(join(commonDir, name), "utf8"),
    });
  }

  return {
    schema: { fileName: schemaFileName, contents: schemaContents },
    preload,
    rulesetVersion: readRulesetVersion(cacheRoot),
  };
}

/**
 * XSD validation via xmllint-wasm (libxml2 in WASM).
 * Preferable to native libxmljs2 on Windows / varying Node ABIs.
 */
export class XmllintXsdValidationAdapter implements SunatValidationPort {
  async validateXml(
    input: SunatValidationInput,
  ): Promise<SunatValidationResult> {
    const stages = input.stages ?? (["xsd"] as const);
    if (!stages.includes("xsd")) {
      return {
        ok: true,
        rulesetVersion: readRulesetVersion(resolveXsdCacheRoot()),
        issues: [],
      };
    }

    if (
      input.documentType !== "01" &&
      input.documentType !== "03" &&
      input.documentType !== "07" &&
      input.documentType !== "08"
    ) {
      throw validationError(
        `documentType '${input.documentType}' is not supported (use 01, 03, 07, 08)`,
      );
    }

    const { schema, preload, rulesetVersion } = loadSchemaBundle(
      input.documentType,
    );

    let result;
    try {
      result = await validateXML({
        xml: [{ fileName: "document.xml", contents: input.xml }],
        schema: [schema],
        preload,
        initialMemoryPages: 512,
        maxMemoryPages: 4096,
      });
    } catch (cause) {
      throw validationInternal(
        "xmllint-wasm failed to validate XML against XSD",
        { cause },
      );
    }

    const issues: SunatValidationIssue[] = result.errors.map((err) => ({
      severity: "error" as const,
      stage: "xsd" as const,
      message: err.message,
      path: err.loc
        ? `${err.loc.fileName}:${err.loc.lineNumber}`
        : undefined,
    }));

    return {
      ok: result.valid,
      rulesetVersion,
      issues,
    };
  }
}
