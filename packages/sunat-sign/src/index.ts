/**
 * @factosys/sunat-sign — XML signature (stub).
 * Spike A / S1 will implement SignXmlPort; keep separate from sunat-ubl (ADR-003).
 */

export const PACKAGE_NAME = "@factosys/sunat-sign" as const;

export interface SignXmlPort {
  sign(_xml: string, _certificateRef: string): Promise<string>;
}
