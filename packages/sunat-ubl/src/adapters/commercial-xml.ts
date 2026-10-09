import type { create } from "xmlbuilder2";
import type {
  InvoiceCanonical,
  InvoiceLineCanonical,
  InvoiceTotals,
} from "../types/invoice-canonical";
import type { NoteCanonical } from "../types/note-canonical";
import type { Adjustment } from "../types/commercial-fields";
import { isCharge } from "../totals/commercial";
import { formatMoney } from "../totals/auto-totals";
import { formatUnit } from "./cpe-xml";
type Node = ReturnType<ReturnType<typeof create>["ele"]>;
type Cpe = InvoiceCanonical | NoteCanonical;

export function appendAdjustment(root: Node, a: Adjustment, currency: string): void {
  const node = root.ele("cac:AllowanceCharge");
  node.ele("cbc:ChargeIndicator").txt(String(isCharge(a.code)));
  node
    .ele("cbc:AllowanceChargeReasonCode", {
      listAgencyName: "PE:SUNAT",
      listName: "Cargo/descuento",
      listURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo53",
    })
    .txt(a.code);
  if (a.reason) node.ele("cbc:AllowanceChargeReason").txt(a.reason);
  if (a.factor !== undefined) node.ele("cbc:MultiplierFactorNumeric").txt(formatUnit(a.factor, 0));
  node.ele("cbc:Amount", { currencyID: currency }).txt(formatMoney(a.amount));
  node.ele("cbc:BaseAmount", { currencyID: currency }).txt(formatMoney(a.base_amount));
  if (a.tax_scheme_id) {
    const tax = node.ele("cac:TaxCategory");
    if (a.percent !== undefined) tax.ele("cbc:Percent").txt(formatUnit(a.percent, 0));
    tax.ele("cac:TaxScheme").ele("cbc:ID").txt(a.tax_scheme_id);
  }
  if (a.related_percent !== undefined) {
    const tax = node.ele("cac:TaxCategory");
    tax.ele("cbc:Percent").txt(formatUnit(a.related_percent, 0));
    tax.ele("cac:TaxScheme").ele("cbc:ID").txt("1000");
  }
}
export function appendCommercialReferences(root: Node, cpe: Cpe): void {
  for (const ref of cpe.despatch_references ?? []) {
    const node = root.ele("cac:DespatchDocumentReference");
    node.ele("cbc:ID").txt(ref.serie_number);
    node.ele("cbc:DocumentTypeCode").txt(ref.document_type);
  }
  for (const advance of cpe.prepayments ?? []) {
    const node = root.ele("cac:AdditionalDocumentReference");
    node.ele("cbc:ID").txt(advance.serie_number);
    node
      .ele("cbc:DocumentTypeCode", { listName: "Anticipo" })
      .txt(advance.document_type === "01" ? "02" : "03");
    node.ele("cbc:DocumentStatusCode").txt(String(advance.id));
    node
      .ele("cac:IssuerParty")
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", { schemeID: "6" })
      .txt(advance.issuer_ruc);
  }
}
export function appendCommercialPayments(root: Node, cpe: Cpe): void {
  const d = cpe.detraction;
  for (const m of cpe.payment_means ?? []) {
    const node = root.ele("cac:PaymentMeans");
    node.ele("cbc:PaymentMeansCode").txt(m.code);
    if (m.due_date) node.ele("cbc:PaymentDueDate").txt(m.due_date);
    if (m.bank) node.ele("cbc:InstructionNote").txt(m.bank);
    if (m.reference) node.ele("cbc:PaymentID").txt(m.reference);
    if (m.account) node.ele("cac:PayeeFinancialAccount").ele("cbc:ID").txt(m.account);
  }
  if (d) {
    const node = root.ele("cac:PaymentMeans");
    node.ele("cbc:ID").txt("Detraccion");
    node.ele("cbc:PaymentMeansCode").txt(d.payment_means_code);
    node.ele("cac:PayeeFinancialAccount").ele("cbc:ID").txt(d.account);
  }
  const terms = cpe.payment_terms;
  if (terms || cpe.document_type === "01" || cpe.document_type === "03") {
    const node = root.ele("cac:PaymentTerms");
    node.ele("cbc:ID").txt("FormaPago");
    node.ele("cbc:PaymentMeansID").txt(terms?.condition === "credit" ? "Credito" : "Contado");
    if (terms?.condition === "credit") {
      node
        .ele("cbc:Amount", { currencyID: terms.currency })
        .txt(formatMoney(terms.outstanding_amount));
      for (const q of terms.installments) {
        const quota = root.ele("cac:PaymentTerms");
        quota.ele("cbc:ID").txt("FormaPago");
        quota.ele("cbc:PaymentMeansID").txt(`Cuota${String(q.number).padStart(3, "0")}`);
        quota.ele("cbc:Amount", { currencyID: terms.currency }).txt(formatMoney(q.amount));
        quota.ele("cbc:PaymentDueDate").txt(q.due_date);
      }
    }
  }
  if (d) {
    const node = root.ele("cac:PaymentTerms");
    node.ele("cbc:ID").txt("Detraccion");
    node.ele("cbc:PaymentMeansID", { schemeName: "Codigo de detraccion" }).txt(d.goods_code);
    node.ele("cbc:PaymentPercent").txt(formatUnit(d.percent, 0));
    node.ele("cbc:Amount", { currencyID: "PEN" }).txt(formatMoney(d.amount));
  }
  for (const p of cpe.prepayments ?? []) {
    const node = root.ele("cac:PrepaidPayment");
    node.ele("cbc:ID", { schemeName: "Anticipo" }).txt(String(p.id));
    node.ele("cbc:PaidAmount", { currencyID: cpe.currency }).txt(formatMoney(p.amount));
    node.ele("cbc:PaidDate").txt(p.paid_date);
  }
  for (const a of cpe.totals.computed_adjustments) appendAdjustment(root, a, cpe.currency);
  const rate = cpe.exchange_rate;
  if (rate) {
    const node = root.ele("cac:TaxExchangeRate");
    node.ele("cbc:SourceCurrencyCode").txt(rate.source_currency);
    node.ele("cbc:TargetCurrencyCode").txt(rate.target_currency);
    node.ele("cbc:ExchangeMarketID").txt(rate.source);
    node.ele("cbc:CalculationRate").txt(formatUnit(rate.rate, 0));
    node.ele("cbc:Date").txt(rate.date);
  }
}
export function appendMonetary(
  root: Node,
  tag: string,
  totals: InvoiceTotals,
  currency: string,
): void {
  const node = root.ele(tag);
  for (const [name, key] of [
    ["LineExtensionAmount", "line_extension_amount"],
    ["TaxInclusiveAmount", "tax_inclusive_amount"],
    ["AllowanceTotalAmount", "allowance_total_amount"],
    ["ChargeTotalAmount", "charge_total_amount"],
    ["PrepaidAmount", "prepaid_amount"],
    ["PayableAmount", "payable_amount"],
  ] as const) {
    if (
      !["LineExtensionAmount", "TaxInclusiveAmount", "PayableAmount"].includes(name) &&
      !totals[key]
    )
      continue;
    node.ele(`cbc:${name}`, { currencyID: currency }).txt(formatMoney(totals[key]));
  }
}
export function appendCommercialDelivery(node: Node, line: InvoiceLineCanonical): void {
  const cargo = line.cargo_transport;
  if (!cargo) return;
  const delivery = node.ele("cac:Delivery");
  const destination = delivery.ele("cac:DeliveryLocation").ele("cac:Address");
  destination.ele("cbc:ID").txt(cargo.destination.ubigeo);
  destination.ele("cac:AddressLine").ele("cbc:Line").txt(cargo.destination.address);
  const despatch = delivery.ele("cac:Despatch");
  despatch.ele("cbc:Instructions").txt(cargo.trip_description);
  const origin = despatch.ele("cac:DespatchAddress");
  origin.ele("cbc:ID").txt(cargo.origin.ubigeo);
  origin.ele("cac:AddressLine").ele("cbc:Line").txt(cargo.origin.address);
  for (const [id, value] of [
    ["01", cargo.reference_amount],
    ["02", cargo.reference_load_amount],
    ["03", cargo.reference_vehicle_amount],
  ] as const) {
    const terms = delivery.ele("cac:DeliveryTerms");
    terms.ele("cbc:ID").txt(id);
    terms.ele("cbc:Amount", { currencyID: "PEN" }).txt(formatMoney(value));
  }
  const shipment = delivery.ele("cac:Shipment");
  shipment.ele("cbc:ID").txt(String(line.id));
  for (const [i, trip] of cargo.trips.entries()) {
    const consignment = shipment.ele("cac:Consignment");
    consignment.ele("cbc:ID").txt(String(i + 1));
    consignment.ele("cbc:GrossWeightMeasure", { unitCode: "TNE" }).txt(formatUnit(trip.tons, 0));
    consignment
      .ele("cbc:NetWeightMeasure", { unitCode: "TNE" })
      .txt(formatUnit(trip.effective_tons, 0));
    const terms = consignment.ele("cac:DeliveryTerms");
    terms.ele("cbc:Amount", { currencyID: "PEN" }).txt(formatMoney(trip.reference_amount));
    consignment
      .ele("cac:TransportHandlingUnit")
      .ele("cac:TransportEquipment")
      .ele("cbc:ID")
      .txt(trip.configuration);
  }
}
export function appendCommercialItemProperties(item: Node, line: InvoiceLineCanonical): void {
  const hydro = line.hydrobiology;
  const passenger = line.passenger_transport;
  const properties: [string, string][] = hydro
    ? [
        ["3001", hydro.vessel_registration],
        ["3002", hydro.vessel_name],
        ["3003", hydro.species],
        ["3004", hydro.unloading_place],
        ["3005", hydro.unloading_date],
        ["3006", String(hydro.quantity)],
      ]
    : passenger
      ? [
          [
            "",
            `Transporte de pasajeros: ${passenger.vehicle_plate}; ${passenger.service_date}; ${passenger.origin} - ${passenger.destination}`,
          ],
        ]
      : [];
  for (const [code, value] of properties) {
    const node = item.ele("cac:AdditionalItemProperty");
    node
      .ele("cbc:Name")
      .txt(!code ? "Detalle de transporte de pasajeros" : "Información de detracción");
    if (code)
      node
        .ele("cbc:NameCode", {
          listAgencyName: "PE:SUNAT",
          listName: "Propiedad del item",
          listURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo55",
        })
        .txt(code);
    if (code === "3005") node.ele("cac:UsabilityPeriod").ele("cbc:StartDate").txt(value);
    else if (code === "3006")
      node.ele("cbc:ValueQuantity", { unitCode: "TNE" }).txt(formatMoney(Number(value)));
    else node.ele("cbc:Value").txt(value);
  }
}
