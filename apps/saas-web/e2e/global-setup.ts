import { API_BASE } from "./helpers/selectors";

/** Ensure API is up before saas-web Playwright specs. */
export default async function globalSetup(): Promise<void> {
  const health = await fetch(`${API_BASE}/health`);
  if (!health.ok) {
    throw new Error(
      `API not reachable at ${API_BASE}/health (${health.status}). Start the API before saas-web e2e.`,
    );
  }
  console.log(`[saas-web e2e globalSetup] API ready at ${API_BASE}`);
}
