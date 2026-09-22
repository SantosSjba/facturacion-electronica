import type {
  GreOAuthPort,
  GreOAuthInput,
  GreOAuthResult,
} from "../ports/gre-oauth.port";
import { greTransportError } from "../errors";

export const DEFAULT_GRE_SCOPE = "https://api-cpe.sunat.gob.pe";

export const DEFAULT_GRE_TOKEN_URL_TEMPLATE =
  "https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token/";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface RestGreOAuthOptions {
  /** Template with `{client_id}` or full URL override via env. */
  tokenUrlTemplate?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/**
 * Real GRE OAuth2 password grant (Spike D).
 */
export class RestGreOAuthAdapter implements GreOAuthPort {
  private readonly tokenUrlTemplate: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: RestGreOAuthOptions = {}) {
    this.tokenUrlTemplate =
      options.tokenUrlTemplate ??
      process.env.SUNAT_GRE_TOKEN_URL ??
      DEFAULT_GRE_TOKEN_URL_TEMPLATE;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

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

    const url = this.tokenUrlTemplate.replace(
      "{client_id}",
      encodeURIComponent(input.clientId),
    );

    const body = new URLSearchParams({
      grant_type: "password",
      scope: input.scope ?? DEFAULT_GRE_SCOPE,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      username: input.solUser,
      password: input.solPassword,
    });

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await this.fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (cause) {
      const aborted =
        cause instanceof Error &&
        (cause.name === "AbortError" || cause.message.includes("abort"));
      throw greTransportError(
        aborted ? "GRE OAuth timed out" : "GRE OAuth network error",
        { cause },
      );
    }

    const text = await response.text();
    if (!response.ok) {
      throw greTransportError(`GRE OAuth HTTP ${response.status}`, {
        details: [{ path: "http", issue: text.slice(0, 200) }],
      });
    }

    let json: { access_token?: string; expires_in?: number };
    try {
      json = JSON.parse(text) as typeof json;
    } catch (cause) {
      throw greTransportError("GRE OAuth response is not JSON", { cause });
    }

    if (!json.access_token) {
      throw greTransportError("GRE OAuth missing access_token");
    }

    return {
      accessToken: json.access_token,
      expiresInSec: Number(json.expires_in) || 3600,
    };
  }
}
