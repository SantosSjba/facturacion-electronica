import { FakeGreOAuthAdapter } from "./fake-gre-oauth.adapter";
import { FakeGreDespatchAdapter } from "./fake-gre-despatch.adapter";
import {
  RestGreOAuthAdapter,
  type RestGreOAuthOptions,
} from "./rest-gre-oauth.adapter";
import {
  RestGreDespatchAdapter,
  type RestGreDespatchOptions,
} from "./rest-gre-despatch.adapter";
import type { GreOAuthPort } from "../ports/gre-oauth.port";
import type { GreDespatchPort } from "../ports/gre-despatch.port";

export interface GreClients {
  oauth: GreOAuthPort;
  despatch: GreDespatchPort;
}

/** Resolve GRE adapters from env (`SUNAT_GRE_MODE=fake|beta`). */
export function createGreClientsFromEnv(overrides?: {
  oauth?: RestGreOAuthOptions;
  despatch?: RestGreDespatchOptions;
}): GreClients {
  const mode = (process.env.SUNAT_GRE_MODE ?? "fake").toLowerCase();
  if (mode === "beta") {
    return {
      oauth: new RestGreOAuthAdapter(overrides?.oauth),
      despatch: new RestGreDespatchAdapter(overrides?.despatch),
    };
  }
  return {
    oauth: new FakeGreOAuthAdapter(),
    despatch: new FakeGreDespatchAdapter(),
  };
}
