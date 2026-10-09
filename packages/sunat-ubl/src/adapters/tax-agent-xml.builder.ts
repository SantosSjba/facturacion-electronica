import { create } from "xmlbuilder2";
import type { TaxAgentCanonical } from "../types/tax-agent-canonical";
const ns = {
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  sac: "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1",
  ds: "http://www.w3.org/2000/09/xmldsig#",
};
type Node = ReturnType<typeof create>;
function party(node: Node, p: TaxAgentCanonical["supplier"]) {
  node
    .ele("cac:PartyIdentification")
    .ele("cbc:ID", { schemeID: p.identity_type })
    .txt(p.identity_number);
  if (p.trade_name) node.ele("cac:PartyName").ele("cbc:Name").txt(p.trade_name);
  if (p.address) {
    const a = node.ele("cac:PostalAddress");
    for (const [tag, value] of Object.entries({
      ID: p.address.ubigeo,
      StreetName: p.address.line,
      CitySubdivisionName: p.address.urbanization,
      CityName: p.address.province,
      CountrySubentity: p.address.department,
      District: p.address.district,
    }))
      if (value) a.ele("cbc:" + tag).txt(value);
    a.ele("cac:Country")
      .ele("cbc:IdentificationCode")
      .txt(p.address.country_code ?? "PE");
  }
  node.ele("cac:PartyLegalEntity").ele("cbc:RegistrationName").txt(p.name);
}
export class XmlTaxAgentBuilder {
  build(c: TaxAgentCanonical) {
    const name = c.document_type === "20" ? "Retention" : "Perception";
    const root = create({ version: "1.0", encoding: "UTF-8" }).ele(name, {
      xmlns: `urn:sunat:names:specification:ubl:peru:schema:xsd:${name}-1`,
      ...Object.fromEntries(Object.entries(ns).map(([k, v]) => ["xmlns:" + k, v])),
    });
    root.ele("ext:UBLExtensions").ele("ext:UBLExtension").ele("ext:ExtensionContent");
    root.ele("cbc:UBLVersionID").txt("2.0");
    root.ele("cbc:CustomizationID").txt("1.0");
    const sig = root.ele("cac:Signature");
    sig.ele("cbc:ID").txt("SignFactosys");
    sig
      .ele("cac:SignatoryParty")
      .ele("cac:PartyIdentification")
      .ele("cbc:ID")
      .txt(c.supplier.identity_number);
    sig
      .ele("cac:DigitalSignatureAttachment")
      .ele("cac:ExternalReference")
      .ele("cbc:URI")
      .txt("#SignFactosys");
    root.ele("cbc:ID").txt(`${c.serie}-${String(c.number).padStart(8, "0")}`);
    root.ele("cbc:IssueDate").txt(c.issue_date);
    if (c.issue_time) root.ele("cbc:IssueTime").txt(c.issue_time);
    party(root.ele("cac:AgentParty"), c.supplier);
    party(root.ele("cac:ReceiverParty"), c.customer);
    root.ele(`sac:SUNAT${name}SystemCode`).txt(c.regime);
    root.ele(`sac:SUNAT${name}Percent`).txt(c.percent.toFixed(2));
    if (c.observations) root.ele("cbc:Note").txt(c.observations);
    root.ele("cbc:TotalInvoiceAmount", { currencyID: "PEN" }).txt(c.totals.tax_amount.toFixed(2));
    root
      .ele(c.document_type === "20" ? "sac:SUNATTotalPaid" : "sac:SUNATTotalCashed", {
        currencyID: "PEN",
      })
      .txt(c.totals.settlement_amount.toFixed(2));
    for (const r of c.references) {
      const ref = root.ele(`sac:SUNAT${name}DocumentReference`);
      ref.ele("cbc:ID", { schemeID: r.document_type }).txt(r.serie_number);
      ref.ele("cbc:IssueDate").txt(r.issue_date);
      ref.ele("cbc:TotalInvoiceAmount", { currencyID: r.currency }).txt(r.total_amount.toFixed(2));
      if (!r.payment) continue;
      if (r.tax_amount === undefined || r.settlement_amount === undefined || !r.tax_date)
        throw new Error("Payment tax amounts/date missing");
      const pay = ref.ele("cac:Payment");
      pay.ele("cbc:ID").txt(String(r.payment.number));
      pay.ele("cbc:PaidAmount", { currencyID: r.currency }).txt(r.payment.amount.toFixed(2));
      pay.ele("cbc:PaidDate").txt(r.payment.date);
      const info = ref.ele(`sac:SUNAT${name}Information`);
      info.ele(`sac:SUNAT${name}Amount`, { currencyID: "PEN" }).txt(r.tax_amount.toFixed(2));
      info.ele(`sac:SUNAT${name}Date`).txt(r.tax_date);
      info
        .ele(c.document_type === "20" ? "sac:SUNATNetTotalPaid" : "sac:SUNATNetTotalCashed", {
          currencyID: "PEN",
        })
        .txt(r.settlement_amount.toFixed(2));
      if (r.exchange_rate) {
        const x = info.ele("cac:ExchangeRate");
        x.ele("cbc:SourceCurrencyCode").txt(r.exchange_rate.source_currency);
        x.ele("cbc:TargetCurrencyCode").txt("PEN");
        x.ele("cbc:CalculationRate").txt(String(r.exchange_rate.rate));
        x.ele("cbc:Date").txt(r.exchange_rate.date);
      }
    }
    return {
      xml: root.end({ prettyPrint: true }),
      fileStem: `${c.supplier.identity_number}-${c.document_type}-${c.serie}-${c.number}`,
    };
  }
}
