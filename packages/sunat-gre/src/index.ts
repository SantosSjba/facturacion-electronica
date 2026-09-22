/**
 * @factosys/sunat-gre — GRE REST client (stub).
 */

export const PACKAGE_NAME = "@factosys/sunat-gre" as const;

export interface GreClientPort {
  sendGre(_payload: unknown): Promise<unknown>;
}
