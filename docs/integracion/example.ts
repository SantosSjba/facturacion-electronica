import { FactosysClient, type InvoiceInput } from "@factosys/sdk";
import { readFileSync } from "node:fs";
// Set FACTOSYS_URL, FACTOSYS_API_KEY and FACTOSYS_COMPANY_ID; run only with your own sandbox.
const client = new FactosysClient({
  baseUrl: process.env.FACTOSYS_URL ?? "http://localhost:3000",
  apiKey: process.env.FACTOSYS_API_KEY ?? "",
});
const body = JSON.parse(
  readFileSync(process.argv[2] ?? "cases/01-01-credito-cuotas.json", "utf8"),
) as InvoiceInput;
body.company_id = process.env.FACTOSYS_COMPANY_ID ?? body.company_id;
const idempotencyKey = process.env.FACTOSYS_IDEMPOTENCY_KEY;
if (!idempotencyKey)
  throw new Error("Persist FACTOSYS_IDEMPOTENCY_KEY for this business operation before emission");
const doc = await client.createInvoiceAndWait(body, {
  idempotencyKey,
  timeoutMs: 60000,
  pollMs: 2000,
});
console.log(doc);
if (doc.status === "failed") console.log("Reconcile existing document; do not repeat issuance.");
if (
  ["accepted", "accepted_with_observation"].includes(String(doc.status)) &&
  process.env.FACTOSYS_RECIPIENT
) {
  console.log(
    await client.documents.deliver(
      String(doc.id),
      [process.env.FACTOSYS_RECIPIENT],
      "recipient-event-" + String(doc.id),
    ),
  );
  console.log(await client.documents.createShare(String(doc.id), ["pdf"], 3600));
}
