import type { SignXmlInput, SignXmlResult } from "./sign-xml.types";

/**
 * Nest / DI token for the active SignXmlPort adapter.
 * apps/api can `@Inject(SIGN_XML_PORT)` once wiring lands.
 */
export const SIGN_XML_PORT: unique symbol = Symbol("SignXmlPort");

/**
 * Port frozen by Spike A (doc 24 §A.2). One adapter active post-spike.
 */
export interface SignXmlPort {
  sign(input: SignXmlInput): Promise<SignXmlResult>;
}
