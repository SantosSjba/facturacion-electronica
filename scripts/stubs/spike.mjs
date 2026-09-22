#!/usr/bin/env node
/**
 * Spike runners land in S1–S2 (sign / UBL / SendBill).
 * Kept as repo-contract stubs so scripts exist from day one.
 */
const spike = process.argv[2] ?? "unknown";

const messages = {
  sign: "Spike A — XML signature (S1-SIGN). Not implemented in S0-TOOL.",
  ubl: "Spike B — UBL Invoice builder (S1-UBL). Not implemented in S0-TOOL.",
  sendbill: "Spike C — SUNAT SendBill SOAP (S2-SOAP). Not implemented in S0-TOOL.",
};

console.error(
  `[spike:${spike}] ${messages[spike] ?? "Unknown spike."}\n` +
    "See planificacion-fe-SUNAT docs/planificacion/24-plan-spikes-emision.md",
);
process.exit(1);
