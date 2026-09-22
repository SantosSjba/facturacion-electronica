# `@factosys/sunat-soap`

SUNAT `billService` SendBill client (Spike C / S2-SOAP).

## Port

```ts
import {
  BILL_SERVICE_PORT,
  FakeBillServiceAdapter,
  SoapBillServiceAdapter,
  packInvoiceZip,
  parseCdrZip,
  type BillServicePort,
} from "@factosys/sunat-soap";
```

`BillServicePort.sendBill({ zipBytes, fileName, solUser, solPassword })` → `{ rawCdrZip, statusCode?, statusMessage? }`.

## ZIP

`packInvoiceZip` builds `{RUC}-01-{SERIE}-{N}.zip` with a single XML entry of the same stem (ADR-003: transport owns the wire package).

## Modes

| `SUNAT_BILL_MODE` | Adapter | Network |
| --- | --- | --- |
| `fake` (default) | `FakeBillServiceAdapter` | none — CDR fixtures |
| `beta` | `SoapBillServiceAdapter` | POST to `SUNAT_SEE_WSDL_URL` (default e-beta `itcpfegem-beta`) |

Beta requires `SUNAT_SOL_USER` + `SUNAT_SOL_PASSWORD`. Live beta is **pendiente de RUC**; CI and `pnpm spike:sendbill` use fake.

SOAP: handcrafted SOAP 1.1 + WS-Security UsernameToken (`xmlbuilder2` + `fetch`). No `node-soap`.

## CDR

`parseCdrZip` → `accepted` \| `accepted_with_observation` \| `rejected` + `sunatCode`.

## Spike

```bash
pnpm spike:sendbill
# optional:
# SUNAT_BILL_MODE=beta SUNAT_SOL_USER=… SUNAT_SOL_PASSWORD=… pnpm spike:sendbill
```

Artifacts: `tmp/spikes/sendbill/`.
