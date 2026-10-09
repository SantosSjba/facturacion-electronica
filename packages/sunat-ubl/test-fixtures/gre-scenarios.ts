import { assertDespatchCanonical } from "../src/types/despatch-canonical";

export function greScenario(kind: "public" | "private" | "m1" | "carrier" | "export" = "public") {
  const party = { identity_type: "6", identity_number: "20123456789", name: "DESTINATARIO SAC" };
  const transport = {
    vehicles: [
      { plate: "ABC123", tuc: "123456789" },
      { plate: "DEF456", tuc: "987654321", authority_code: "AUT123", authority_entity_code: "01" },
    ],
    drivers: [
      {
        identity_type: "1",
        identity_number: "12345678",
        name: "Juan",
        last_name: "Perez",
        license: "Q12345678",
      },
      {
        identity_type: "1",
        identity_number: "87654321",
        name: "Ana",
        last_name: "Lopez",
        license: "Q87654321",
      },
    ],
  };
  const carrier = kind === "carrier";
  const customs = kind === "export";
  return assertDespatchCanonical({
    document_type: carrier ? "31" : "09",
    serie: carrier ? "V001" : "T001",
    number: 1,
    issue_date: "2026-10-08",
    issue_time: "10:00:00",
    notes: "Mercadería frágil: evitar golpes.",
    supplier: { ...party, identity_number: "20601234567", name: "EMISOR GRE SAC" },
    shipper: carrier ? party : undefined,
    delivery_customer: party,
    shipment: {
      ...(carrier
        ? {
            ...transport,
            mtc_registration: "MTC123",
            authorization: { entity_code: "01", number: "AUT123" },
            subcontracted: true,
            subcontractor: { ...party, identity_number: "20100070970" },
            freight_payer: "third_party",
            freight_payer_party: party,
          }
        : {
            transfer_reason_code: customs ? "09" : "01",
            transport_mode_code: kind === "private" ? "02" : "01",
            ...(kind === "private"
              ? transport
              : {
                  handover_date: "2026-10-09",
                  ...(kind === "m1"
                    ? { vehicle_m1_l: true, vehicles: [{ plate: "ABC123" }] }
                    : {
                        carrier: {
                          ...party,
                          identity_number: "20600000000",
                          mtc_registration: "MTC123",
                          authorization: { entity_code: "01", number: "AUT123" },
                        },
                      }),
                }),
          }),
      gross_weight: 125.125,
      gross_weight_unit: "KGM",
      total_packages: 20,
      start_date: "2026-10-10",
      start_time: "08:00:00",
      origin: {
        ubigeo: "150101",
        address: "Av. Origen 123",
        establishment_code: "0001",
        establishment_ruc: "20601234567",
      },
      destination: { ubigeo: "040101", address: "Almacén destino 456" },
      ...(customs
        ? {
            selected_items_weight: 124,
            weight_difference_reason: "Peso de embalaje",
            containers: [{ id: "MSCU1234567", seal: "PRECINTO123" }],
            port_code: "014",
          }
        : {}),
    },
    related_documents: [
      {
        document_type: carrier ? "09" : "01",
        serie_number: carrier ? "T001-15" : "F001-15",
        issuer: party,
      },
      ...(customs || carrier
        ? [
            {
              document_type: "50",
              serie_number: "118-2026-10-12345",
              description: "Declaración Aduanera de Mercancías",
            },
          ]
        : []),
    ],
    lines: [
      {
        id: 1,
        quantity: 12.123456789,
        unit_code: "NIU",
        description: "Bienes a trasladar",
        product_code: "PROD1",
        ...(customs || carrier ? { tariff_heading: "1234567890", normalized_good: false } : {}),
        ...(customs
          ? { customs_document_number: "118-2026-10-12345", customs_item_number: "1" }
          : {}),
      },
    ],
  });
}
