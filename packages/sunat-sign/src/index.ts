/**
 * @factosys/sunat-sign — XMLDSig signing (Spike A / S1-SIGN).
 * Isolated from UBL builders (ADR-003). Library choice: ADR-002.
 */

export const PACKAGE_NAME = "@factosys/sunat-sign" as const;

export type { SignXmlInput, SignXmlResult } from "./ports/sign-xml.types";
export { SIGN_XML_PORT, type SignXmlPort } from "./ports/sign-xml.port";

export { loadPfx, type LoadedPfx } from "./cert/load-pfx";
export { generateTestPfx } from "./cert/generate-test-pfx";

export { XmlCryptoSignAdapter } from "./adapters/xml-crypto-sign.adapter";
export { verifySignedXml } from "./adapters/verify-signed-xml";

export { signError, signInternal } from "./errors";
