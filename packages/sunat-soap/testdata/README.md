# CDR / ZIP fixtures

CDR ApplicationResponse ZIPs for FakeBillService and unit tests are **generated in code** via `buildCdrZipFixture()` (`src/cdr/build-cdr-fixture.ts`), not checked in as binary blobs.

Kinds: `accepted` (code `0`), `accepted_with_observation` (`0` with `cbc:Note`), `rejected` (`2324`). Transport codes 98/99 are not acceptance codes inside a CDR.
