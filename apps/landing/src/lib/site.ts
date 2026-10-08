export const saasLoginUrl =
  import.meta.env.PUBLIC_SAAS_URL?.replace(/\/$/, "") ||
  "http://localhost:5174/auth/login";

export const apiBaseUrl =
  import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

/** Scalar API Reference on this landing (same origin). */
export const docsUrl = "/docs";

/** Nest OpenAPI JSON consumed by Scalar. */
export const openApiJsonUrl = `${apiBaseUrl}/docs-json`;
