import { FakeBillServiceAdapter } from "./fake-bill-service.adapter";
import {
  SoapBillServiceAdapter,
  type SoapBillServiceOptions,
} from "./soap-bill-service.adapter";
import type { BillServicePort } from "../ports/bill-service.port";

/** Resolve BillService adapter from env (`SUNAT_BILL_MODE=fake|beta`). */
export function createBillServiceFromEnv(
  overrides?: SoapBillServiceOptions,
): BillServicePort {
  const mode = (process.env.SUNAT_BILL_MODE ?? "fake").toLowerCase();
  if (mode === "beta") {
    return new SoapBillServiceAdapter(overrides);
  }
  return new FakeBillServiceAdapter();
}
