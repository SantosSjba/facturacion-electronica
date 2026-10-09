/** The panel accepts a SOL user; the API stores the full SUNAT UsernameToken. */
export function solUsernameForApi(ruc: string, input: string): string {
  const username = input.trim();
  // Preserve full usernames, including another company's RUC, for API validation.
  if (!username || username.startsWith(ruc) || /^\d{11}/.test(username)) return username;
  return ruc + username;
}

export function solUsernameForInput(ruc: string, username: string | null | undefined): string {
  const value = username ?? "";
  return value.startsWith(ruc) ? value.slice(ruc.length) : value;
}
