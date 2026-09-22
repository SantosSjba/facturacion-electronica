/**
 * GreOAuthPort — OAuth2 password grant for SUNAT GRE REST (Spike D).
 */

export const GRE_OAUTH_PORT: unique symbol = Symbol("GreOAuthPort");

export interface GreOAuthInput {
  clientId: string;
  clientSecret: string;
  solUser: string;
  solPassword: string;
  /** Default https://api-cpe.sunat.gob.pe */
  scope?: string;
}

export interface GreOAuthResult {
  accessToken: string;
  expiresInSec: number;
}

export interface GreOAuthPort {
  getAccessToken(input: GreOAuthInput): Promise<GreOAuthResult>;
}
