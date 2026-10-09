import { create } from "xmlbuilder2";
import { documentId, fileStem } from "../totals/auto-totals";
import { formatUnit } from "./cpe-xml";
import {
  assertDespatchCanonical,
  type DespatchCanonical,
  type PartyCanonical,
  type DespatchVehicle,
} from "../types/despatch-canonical";
const NS = {
  despatch: "urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
};
type XmlNode = ReturnType<ReturnType<typeof create>["ele"]>;
const catalog = (code: string, name: string) => ({
  listAgencyName: "PE:SUNAT",
  listName: name,
  listURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo" + code,
});
const identity = (type: string) => ({
  schemeID: type,
  schemeName: "Documento de Identidad",
  schemeAgencyName: "PE:SUNAT",
  schemeURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06",
});
const indicators = {
  scheduled_transshipment: "SUNAT_Envio_IndicadorTransbordoProgramado",
  vehicle_m1_l: "SUNAT_Envio_IndicadorTrasladoVehiculoM1L",
  return_empty_packaging: "SUNAT_Envio_IndicadorRetornoVehiculoEnvaseVacio",
  return_empty_vehicle: "SUNAT_Envio_IndicadorRetornoVehiculoVacio",
  total_customs_transfer: "SUNAT_Envio_IndicadorTrasladoTotalDAMoDS",
  total_goods_transfer: "SUNAT_Envio_IndicadorTrasladoTotal",
  register_carrier_transport: "SUNAT_Envio_IndicadorVehiculoConductoresTransp",
  manifest_container_transfer: "SUNAT_Envio_IndicadorTrasladoContenedorManifiestoCarga",
  // Official identifier intentionally spells Trasporte without 'n'.
  subcontracted: "SUNAT_Envio_IndicadorTrasporteSubcontratado",
} as const;
export interface BuildDespatchAdviceXmlResult {
  xml: string;
  fileStem: string;
}
export class XmlDespatchAdviceBuilder {
  build(input: DespatchCanonical): BuildDespatchAdviceXmlResult {
    const c = assertDespatchCanonical(input),
      s = c.shipment;
    const root = create({ version: "1.0", encoding: "UTF-8" }).ele("DespatchAdvice", {
      xmlns: NS.despatch,
      "xmlns:cac": NS.cac,
      "xmlns:cbc": NS.cbc,
      "xmlns:ds": NS.ds,
      "xmlns:ext": NS.ext,
    });
    root.ele("cbc:UBLVersionID").txt("2.1");
    root.ele("cbc:CustomizationID").txt("2.0");
    root.ele("cbc:ID").txt(documentId(c.serie, c.number));
    root.ele("cbc:IssueDate").txt(c.issue_date);
    if (c.issue_time) root.ele("cbc:IssueTime").txt(c.issue_time);
    root.ele("cbc:DespatchAdviceTypeCode", catalog("01", "Tipo de Documento")).txt(c.document_type);
    if (c.notes) root.ele("cbc:Note").txt(c.notes);
    for (const d of c.related_documents ?? []) {
      const ref = root.ele("cac:AdditionalDocumentReference");
      ref.ele("cbc:ID").txt(d.serie_number);
      ref
        .ele("cbc:DocumentTypeCode", catalog("61", "Documento relacionado al transporte"))
        .txt(d.document_type);
      if (d.description) ref.ele("cbc:DocumentType").txt(d.description);
      if (d.issuer) appendIdentity(ref.ele("cac:IssuerParty"), d.issuer);
    }
    appendParty(root, "cac:DespatchSupplierParty", c.supplier);
    appendParty(root, "cac:DeliveryCustomerParty", c.delivery_customer);
    if (c.buyer) appendParty(root, "cac:BuyerCustomerParty", c.buyer);
    if (c.supplier_party) appendParty(root, "cac:SellerSupplierParty", c.supplier_party);
    if (s.freight_payer_party)
      appendParty(root, "cac:OriginatorCustomerParty", s.freight_payer_party);
    const shipment = root.ele("cac:Shipment");
    shipment.ele("cbc:ID").txt("SUNAT_Envio");
    if (s.transfer_reason_code)
      shipment
        .ele("cbc:HandlingCode", catalog("20", "Motivo de traslado"))
        .txt(s.transfer_reason_code);
    if (s.transfer_reason_text)
      shipment.ele("cbc:HandlingInstructions").txt(s.transfer_reason_text);
    if (s.weight_difference_reason) shipment.ele("cbc:Information").txt(s.weight_difference_reason);
    shipment
      .ele("cbc:GrossWeightMeasure", { unitCode: s.gross_weight_unit })
      .txt(String(s.gross_weight));
    if (s.selected_items_weight)
      shipment
        .ele("cbc:NetWeightMeasure", { unitCode: "KGM" })
        .txt(String(s.selected_items_weight));
    if (s.total_packages !== undefined)
      shipment.ele("cbc:TotalTransportHandlingUnitQuantity").txt(String(s.total_packages));
    for (const [key, value] of Object.entries(indicators)) {
      if (s[key as keyof typeof indicators]) shipment.ele("cbc:SpecialInstructions").txt(value);
    }
    if (s.freight_payer)
      shipment.ele("cbc:SpecialInstructions").txt(
        "SUNAT_Envio_IndicadorPagadorFlete_" +
          {
            shipper: "Remitente",
            subcontractor: "Subcontratador",
            third_party: "Tercero",
          }[s.freight_payer],
      );
    if (s.subcontractor) {
      const consignment = shipment.ele("cac:Consignment");
      consignment.ele("cbc:ID").txt("SUNAT_Envio");
      appendIdentity(consignment.ele("cac:LogisticsOperatorParty"), s.subcontractor);
    }
    const stage = shipment.ele("cac:ShipmentStage");
    if (s.transport_mode_code)
      stage
        .ele("cbc:TransportModeCode", catalog("18", "Modalidad de traslado"))
        .txt(s.transport_mode_code);
    const period = stage.ele("cac:TransitPeriod");
    period.ele("cbc:StartDate").txt(s.start_date);
    if (s.start_time) period.ele("cbc:StartTime").txt(s.start_time);
    if (s.carrier || c.document_type === "31") {
      const carrier = s.carrier ?? c.supplier;
      appendIdentity(
        stage.ele("cac:CarrierParty"),
        carrier,
        s.carrier?.mtc_registration ?? s.mtc_registration,
        s.carrier?.authorization ?? s.authorization,
      );
    }
    if (s.handover_date)
      stage.ele("cac:LoadingTransportEvent").ele("cbc:OccurrenceDate").txt(s.handover_date);
    (s.drivers ?? []).forEach((d, index) => {
      const person = stage.ele("cac:DriverPerson");
      person.ele("cbc:ID", identity(d.identity_type)).txt(d.identity_number);
      person.ele("cbc:FirstName").txt(d.name);
      if (d.last_name) person.ele("cbc:FamilyName").txt(d.last_name);
      person.ele("cbc:JobTitle").txt(index === 0 ? "Principal" : "Secundario");
      if (d.license) person.ele("cac:IdentityDocumentReference").ele("cbc:ID").txt(d.license);
    });
    const delivery = shipment.ele("cac:Delivery");
    appendAddress(delivery.ele("cac:DeliveryAddress"), s.destination);
    const despatch = delivery.ele("cac:Despatch");
    appendAddress(despatch.ele("cac:DespatchAddress"), s.origin);
    if (c.document_type === "31" && c.shipper)
      appendIdentity(despatch.ele("cac:DespatchParty"), c.shipper);
    const containers =
      s.containers ?? (s.container_id ? [{ id: s.container_id, seal: s.container_seal }] : []);
    if (s.vehicles?.length || containers.length) {
      const handling = shipment.ele("cac:TransportHandlingUnit");
      if (s.vehicles?.[0]) {
        const primary = handling.ele("cac:TransportEquipment");
        appendVehicle(primary, s.vehicles[0], s.vehicles.slice(1));
      }
      for (const box of containers) {
        const pack = handling.ele("cac:Package");
        pack.ele("cbc:ID").txt(box.id);
        if (box.seal) pack.ele("cbc:TraceID").txt(box.seal);
      }
    }
    if (s.port_code) {
      const port = shipment.ele("cac:FirstArrivalPortLocation");
      port
        .ele("cbc:ID", {
          schemeAgencyName: "PE:SUNAT",
          schemeName: "Puertos",
          schemeURI: "urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo63",
        })
        .txt(s.port_code);
      port.ele("cbc:LocationTypeCode").txt("1");
    }
    for (const l of c.lines) {
      const line = root.ele("cac:DespatchLine");
      line.ele("cbc:ID").txt(String(l.id));
      line
        .ele("cbc:DeliveredQuantity", {
          unitCode: l.unit_code,
          unitCodeListID: "UN/ECE rec 20",
          unitCodeListAgencyName: "United Nations Economic Commission for Europe",
        })
        .txt(formatUnit(l.quantity));
      line.ele("cac:OrderLineReference").ele("cbc:LineID").txt(String(l.id));
      const item = line.ele("cac:Item");
      item.ele("cbc:Description").txt(l.description);
      if (l.product_code)
        item.ele("cac:SellersItemIdentification").ele("cbc:ID").txt(l.product_code);
      if (l.sunat_product_code)
        item
          .ele("cac:CommodityClassification")
          .ele("cbc:ItemClassificationCode", {
            listID: "UNSPSC",
            listAgencyName: "GS1 US",
            listName: "Item Classification",
          })
          .txt(l.sunat_product_code);
      const properties: [string, string, string | undefined][] = [
        ["7020", "Partida arancelaria", l.tariff_heading],
        ["7021", "Numero de declaracion aduanera (DAM)", l.customs_document_number],
        [
          "7022",
          "Indicador de bien normalizado",
          l.normalized_good === undefined ? undefined : l.normalized_good ? "1" : "0",
        ],
        ["7023", "Numero de serie en la DAM o DS", l.customs_item_number],
      ];
      for (const [code, name, value] of properties) {
        if (value === undefined) continue;
        const prop = item.ele("cac:AdditionalItemProperty");
        prop.ele("cbc:Name").txt(name);
        prop.ele("cbc:NameCode", catalog("55", "Propiedad del item")).txt(code);
        prop.ele("cbc:Value").txt(value);
      }
    }
    return {
      xml: root.end({ prettyPrint: true, indent: "  ", newline: "\n" }),
      fileStem: fileStem(c.supplier.identity_number, c.document_type, c.serie, c.number),
    };
  }
}
function appendParty(parent: XmlNode, tag: string, party: PartyCanonical): void {
  appendIdentity(parent.ele(tag).ele("cac:Party"), party);
}
function appendIdentity(
  node: XmlNode,
  party: PartyCanonical,
  mtc?: string,
  authorization?: DespatchCanonical["shipment"]["authorization"],
): void {
  node
    .ele("cac:PartyIdentification")
    .ele("cbc:ID", identity(party.identity_type))
    .txt(party.identity_number);
  const legal = node.ele("cac:PartyLegalEntity");
  legal.ele("cbc:RegistrationName").txt(party.name);
  if (mtc) legal.ele("cbc:CompanyID").txt(mtc);
  if (authorization)
    node
      .ele("cac:AgentParty")
      .ele("cac:PartyLegalEntity")
      .ele("cbc:CompanyID", {
        schemeID: authorization.entity_code,
        schemeName: "Entidad Autorizadora",
        schemeAgencyName: "PE:SUNAT",
      })
      .txt(authorization.number);
}
function appendVehicle(
  node: XmlNode,
  v: DespatchVehicle,
  attachments: DespatchVehicle[] = [],
): void {
  node.ele("cbc:ID").txt(v.plate);
  if (v.tuc)
    node.ele("cac:ApplicableTransportMeans").ele("cbc:RegistrationNationalityID").txt(v.tuc);
  for (const attached of attachments)
    appendVehicle(node.ele("cac:AttachedTransportEquipment"), attached);
  if (v.authority_code && v.authority_entity_code)
    node
      .ele("cac:ShipmentDocumentReference")
      .ele("cbc:ID", {
        schemeID: v.authority_entity_code,
        schemeName: "Entidad Autorizadora",
        schemeAgencyName: "PE:SUNAT",
      })
      .txt(v.authority_code);
}
function appendAddress(node: XmlNode, location: DespatchCanonical["shipment"]["origin"]): void {
  node.ele("cbc:ID", { schemeAgencyName: "PE:INEI", schemeName: "Ubigeos" }).txt(location.ubigeo);
  if (location.establishment_code && location.establishment_ruc)
    node
      .ele("cbc:AddressTypeCode", {
        listID: location.establishment_ruc,
        listAgencyName: "PE:SUNAT",
        listName: "Establecimientos anexos",
      })
      .txt(location.establishment_code);
  node.ele("cac:AddressLine").ele("cbc:Line").txt(location.address);
}
