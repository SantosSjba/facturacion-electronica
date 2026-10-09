import { loadGravadaFixtureRequest, type InvoiceFixtureRequest } from "../src/index";
export function phase1Request(): InvoiceFixtureRequest {
  const base = loadGravadaFixtureRequest();
  const first = base.lines[0];
  if (!first) throw new Error("Missing fixture");
  return { ...base, issue_date: "2026-10-08", lines: [{ ...first, unit_price: undefined }] };
}
export function phase1Scenarios(): InvoiceFixtureRequest[] {
  const base = phase1Request();
  const first = base.lines[0];
  if (!first) throw new Error("Missing fixture");
  return [
    {
      ...base,
      payment_terms: {
        condition: "credit",
        currency: "PEN",
        outstanding_amount: 118,
        installments: [
          { number: 1, due_date: "2026-11-08", amount: 50 },
          { number: 2, due_date: "2026-12-08", amount: 68 },
        ],
      },
    },
    {
      ...base,
      lines: [
        {
          ...first,
          adjustments: [
            { code: "00", base_amount: 100, amount: 10, factor: 0.1 },
            { code: "48", base_amount: 90, amount: 2 },
          ],
        },
      ],
      adjustments: [
        { code: "02", base_amount: 90, amount: 5 },
        { code: "50", base_amount: 100, amount: 3 },
      ],
    },
    {
      ...base,
      prepayments: [
        {
          id: 1,
          document_type: "01",
          serie_number: "F001-5",
          issuer_ruc: "20601234567",
          paid_date: "2026-10-01",
          amount: 23.6,
          base_amount: 20,
          tax_affectation: "10",
        },
      ],
    },
    {
      ...base,
      operation_type: "1001",
      detraction: {
        goods_code: "037",
        percent: 12,
        amount: 14,
        account: "00123456789",
        payment_means_code: "001",
        currency: "PEN",
      },
    },
    { ...base, lines: [{ ...first, icbper: { quantity: 1, per_unit_amount: 0.5 } }] },
    { ...base, lines: [{ ...first, isc: { system: "01", percent: 10 } }] },
    { ...base, lines: [{ ...first, isc: { system: "02", per_unit_amount: 5 } }] },
    {
      ...base,
      lines: [
        { ...first, isc: { system: "03", retail_unit_price: 150, factor: 0.8, percent: 10 } },
      ],
    },
    {
      ...base,
      lines: [{ ...first, tax_affectation: "17", tax_scheme_id: "1016", igv_percent: 4 }],
    },
    {
      ...base,
      operation_type: "0200",
      currency: "USD",
      customer: {
        identity_type: "7",
        identity_number: "PASSPORT01",
        name: "FOREIGN CUSTOMER",
        non_resident: true,
        address: { line: "Foreign street", country_code: "US" },
      },
      lines: [{ ...first, tax_affectation: "40", tax_scheme_id: "9995", igv_percent: 0 }],
      exchange_rate: {
        source_currency: "USD",
        target_currency: "PEN",
        rate: 3.7,
        date: "2026-10-08",
        source: "Contract rate",
      },
      despatch_references: [{ document_type: "09", serie_number: "T001-1" }],
    },
    {
      ...base,
      operation_type: "1002",
      detraction: {
        goods_code: "004",
        percent: 10,
        amount: 12,
        account: "00123456789",
        payment_means_code: "001",
        currency: "PEN",
      },
      lines: [
        {
          ...first,
          hydrobiology: {
            vessel_registration: "ABC",
            vessel_name: "BARCO",
            species: "ANCHOVETA",
            quantity: 1,
            unloading_place: "CALLAO",
            unloading_date: "2026-10-08",
          },
        },
      ],
    },
    {
      ...base,
      operation_type: "1003",
      detraction: {
        goods_code: "028",
        percent: 10,
        amount: 12,
        account: "00123456789",
        payment_means_code: "001",
        currency: "PEN",
      },
      lines: [
        {
          ...first,
          passenger_transport: {
            vehicle_plate: "ABC123",
            service_date: "2026-10-08",
            origin: "LIMA",
            destination: "CALLAO",
          },
        },
      ],
    },
    {
      ...base,
      operation_type: "1004",
      detraction: {
        goods_code: "027",
        percent: 4,
        amount: 8,
        account: "00123456789",
        payment_means_code: "001",
        currency: "PEN",
      },
      lines: [
        {
          ...first,
          cargo_transport: {
            origin: { ubigeo: "150101", address: "LIMA" },
            destination: { ubigeo: "070101", address: "CALLAO" },
            trip_description: "VIAJE UNO",
            reference_amount: 200,
            reference_load_amount: 200,
            reference_vehicle_amount: 200,
            trips: [{ configuration: "C3", tons: 10, effective_tons: 8, reference_amount: 200 }],
          },
        },
      ],
    },
    {
      ...base,
      lines: [{ ...first, isc: { system: "01", percent: 10 } }],
      prepayments: [
        {
          id: 1,
          document_type: "01",
          serie_number: "F001-5",
          issuer_ruc: "20601234567",
          paid_date: "2026-10-01",
          amount: 25.96,
          base_amount: 20,
          tax_affectation: "10",
          isc_amount: 2,
          isc_percent: 10,
          isc_system: "01",
        },
      ],
    },
  ];
}
