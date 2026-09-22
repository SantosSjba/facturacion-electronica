/**
 * @factosys/sunat-validation — XSD / rules validation (stub).
 */

export const PACKAGE_NAME = "@factosys/sunat-validation" as const;

export interface XmlValidationPort {
  validateAgainstXsd(_xml: string, _schemaId: string): Promise<{ ok: boolean }>;
}
