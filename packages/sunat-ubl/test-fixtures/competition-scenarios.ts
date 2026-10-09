import { phase1Request } from "./commercial-scenarios";
import type { InvoiceFixtureRequest } from "../src/index";
export function extendedSale(): InvoiceFixtureRequest {
  const r = phase1Request();
  r.seller = { identity_type: "6", identity_number: "20100070970", name: "VENDEDOR & ASOCIADOS" };
  r.delivery_address = {
    line: "Entrega <local>",
    ubigeo: "150101",
    country_code: "PE",
    establishment_code: "0001",
  };
  r.related_documents = [{ document_type: "04", number: "ORD-123" }];
  r.rounding_amount = -0.01;
  r.sale_perception = { regime: "01", base_amount: 117.99, amount: 2.36, total_amount: 120.35 };
  r.embedded_despatch = {
    origin: {
      ubigeo: "150101",
      address: "Partida",
      establishment_code: "0001",
      establishment_ruc: "20100070970",
    },
    destination: { ubigeo: "150102", address: "Llegada" },
    transport_mode: "01",
    gross_weight: 10,
    weight_unit: "KGM",
    vehicle_plate: "ABC123",
    vehicle_brand: "Marca",
    authorization: "AUT-1",
    carrier: {
      identity_type: "6",
      identity_number: "20100070970",
      name: "TRANSPORTISTA",
      address: { line: "Sede transportista", ubigeo: "150101" },
    },
  };
  const line = r.lines[0];
  if (!line) throw new Error("Missing fixture line");
  line.gs1_product_code = "7751234567892";
  line.attributes = [
    {
      code: "7000",
      name: "Atributo & detalle",
      value: "Valor <uno>",
      start_date: "2026-10-08",
      end_date: "2026-10-09",
      duration_days: 1,
    },
  ];
  return r;
}
