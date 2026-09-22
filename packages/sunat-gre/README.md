# @factosys/sunat-gre

SUNAT GRE REST client: OAuth2 password grant + `sendDespatch` + `consultarTicket`.

## Modes

- `SUNAT_GRE_MODE=fake` (default) — deterministic offline adapters for CI
- `SUNAT_GRE_MODE=beta` — real REST against `api-seguridad` / `api-cpe`

## Usage

```ts
import { createGreClientsFromEnv, packGreZip } from "@factosys/sunat-gre";

const { oauth, despatch } = createGreClientsFromEnv();
const token = await oauth.getAccessToken({ clientId, clientSecret, solUser, solPassword });
const packed = packGreZip({ ruc, documentType: "09", serie: "T001", number: 1, xml });
const { ticket } = await despatch.sendDespatch({
  accessToken: token.accessToken,
  zipBytes: packed.zipBytes,
  fileName: packed.fileName,
  ruc,
  documentType: "09",
  serie: "T001",
  number: 1,
});
const status = await despatch.getStatus({ accessToken: token.accessToken, ticket });
```

Token caching (TTL Redis) lives in `apps/api` (`GreTokenCacheService`).
