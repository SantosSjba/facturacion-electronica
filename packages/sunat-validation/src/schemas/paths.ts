import { join } from "node:path";

import { resolvePackageRoot } from "../paths/package-root";

/** Relative to package root after unpack. */
export const XSD_CACHE_RELATIVE = ".cache/xsd-ubl" as const;

export const INVOICE_XSD_RELATIVE =
  "Archivos XSD/2.1/maindoc/UBL-Invoice-2.1.xsd" as const;

export const CREDIT_NOTE_XSD_RELATIVE =
  "Archivos XSD/2.1/maindoc/UBL-CreditNote-2.1.xsd" as const;

export const DEBIT_NOTE_XSD_RELATIVE =
  "Archivos XSD/2.1/maindoc/UBL-DebitNote-2.1.xsd" as const;

/** Common schemas directory (imports of Invoice XSD). */
export const COMMON_XSD_DIR_RELATIVE = "Archivos XSD/2.1/common" as const;

export type SupportedXsdDocumentType = "01" | "03" | "07" | "08";

const ROOT_BY_TYPE: Record<SupportedXsdDocumentType, string> = {
  "01": INVOICE_XSD_RELATIVE,
  "03": INVOICE_XSD_RELATIVE,
  "07": CREDIT_NOTE_XSD_RELATIVE,
  "08": DEBIT_NOTE_XSD_RELATIVE,
};

export function resolveXsdCacheRoot(packageRoot = resolvePackageRoot()): string {
  return join(packageRoot, XSD_CACHE_RELATIVE);
}

export function resolveRootXsdPath(
  documentType: SupportedXsdDocumentType,
  packageRoot = resolvePackageRoot(),
): string {
  return join(resolveXsdCacheRoot(packageRoot), ROOT_BY_TYPE[documentType]);
}

export function resolveCommonXsdDir(
  packageRoot = resolvePackageRoot(),
): string {
  return join(resolveXsdCacheRoot(packageRoot), COMMON_XSD_DIR_RELATIVE);
}
