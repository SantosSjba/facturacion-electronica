/**
 * Inputs / outputs for {@link SignXmlPort} (doc 24 §A.2).
 */

export interface SignXmlInput {
  /** Unsigned UBL XML document. */
  xml: string;
  /** PKCS#12 (.pfx / .p12) bytes — never log or commit. */
  certificate: Buffer;
  /** PKCS#12 password — never log. */
  password: string;
}

export interface SignXmlResult {
  signedXml: string;
  digestValue?: string;
  signatureValue?: string;
}
