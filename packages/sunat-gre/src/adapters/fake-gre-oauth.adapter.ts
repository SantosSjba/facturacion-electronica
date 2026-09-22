import type { GreOAuthPort, GreOAuthInput, GreOAuthResult } from "../ports/gre-oauth.port";
import { greTransportError } from "../errors";

/**
 * Offline OAuth for CI / Fake mode — deterministic token, no network.
 */
export class FakeGreOAuthAdapter implements GreOAuthPort {
  private seq = 0;

  async getAccessToken(input: GreOAuthInput): Promise<GreOAuthResult> {
    if (!input.clientId?.trim()) {
      throw greTransportError("clientId is required");
    }
    if (!input.clientSecret) {
      throw greTransportError("clientSecret is required");
    }
    if (!input.solUser?.trim()) {
      throw greTransportError("solUser is required");
    }
    if (!input.solPassword) {
      throw greTransportError("solPassword is required");
    }
    this.seq += 1;
    return {
      accessToken: `fake-gre-token-${this.seq}-${input.clientId}`,
      expiresInSec: 3600,
    };
  }
}
