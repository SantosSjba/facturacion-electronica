# @factosys/sunat-ubl

UBL Invoice builder (Spike B / S1-UBL). JSON canónico → XML **sin firma** ([ADR-003](https://github.com/SantosSjba/planificacion-fe-SUNAT/blob/main/docs/planificacion/adr/003-separacion-ubl-sign.md)).

## Port

```ts
import {
  BUILD_INVOICE_XML_PORT,
  XmlInvoiceBuilder,
  hydrateGravadaFixture,
  type BuildInvoiceXmlPort,
} from "@factosys/sunat-ubl";

const builder: BuildInvoiceXmlPort = new XmlInvoiceBuilder();
const { xml, fileStem } = builder.build(hydrateGravadaFixture());
```

- **Adapter:** `XmlInvoiceBuilder` (`xmlbuilder2`)
- **MVP:** factura gravada 1 línea, afectación `10`, scheme `1000`, IGV 18%, PEN
- **DI token:** `BUILD_INVOICE_XML_PORT`
- **Assets:** `assets/fixtures`, `assets/catalogs/matrix-07-x-05-igv.json`, `assets/ubl-attributes/invoice-listuri-schemes.json`

## Pipeline B→A

```bash
pnpm spike:ubl
# → tmp/spikes/ubl/unsigned.xml + signed.xml + meta.json
```

Firma vía `@factosys/sunat-sign` (`SignXmlPort`). XSD gate formal queda en S1-GATE (FE-55).

## Golden

`testdata/golden/01-invoice-gravada.unsigned.xml` — diff estructural en Vitest (criterio B3).
