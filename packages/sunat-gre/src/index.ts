/**
 * @factosys/sunat-gre — SUNAT GRE REST (OAuth + sendDespatch + consultarTicket).
 */

export const PACKAGE_NAME = "@factosys/sunat-gre" as const;

export {
  GRE_OAUTH_PORT,
  type GreOAuthPort,
  type GreOAuthInput,
  type GreOAuthResult,
} from "./ports/gre-oauth.port";

export {
  GRE_DESPATCH_PORT,
  type GreDespatchPort,
  type GreTicketStatus,
  type GreSendDespatchInput,
  type GreSendDespatchResult,
  type GreGetStatusInput,
  type GreGetStatusResult,
} from "./ports/gre-despatch.port";

export { packGreZip } from "./zip/pack-gre-zip";
export type {
  PackGreZipInput,
  PackGreZipResult,
  GreDocumentType,
} from "./zip/pack-gre-zip";

export { FakeGreOAuthAdapter } from "./adapters/fake-gre-oauth.adapter";
export { FakeGreDespatchAdapter } from "./adapters/fake-gre-despatch.adapter";
export {
  RestGreOAuthAdapter,
  DEFAULT_GRE_SCOPE,
  DEFAULT_GRE_TOKEN_URL_TEMPLATE,
} from "./adapters/rest-gre-oauth.adapter";
export type {
  RestGreOAuthOptions,
  FetchLike,
} from "./adapters/rest-gre-oauth.adapter";
export {
  RestGreDespatchAdapter,
  DEFAULT_GRE_API_BASE,
} from "./adapters/rest-gre-despatch.adapter";
export type { RestGreDespatchOptions } from "./adapters/rest-gre-despatch.adapter";
export { createGreClientsFromEnv } from "./adapters/create-gre-clients";
export type { GreClients } from "./adapters/create-gre-clients";

export { greTransportError } from "./errors";
