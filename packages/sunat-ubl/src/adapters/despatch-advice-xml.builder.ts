import { create } from "xmlbuilder2";

import { documentId, fileStem } from "../totals/auto-totals";
import type { DespatchCanonical, PartyCanonical } from "../types/despatch-canonical";
import { assertDespatchCanonical } from "../types/despatch-canonical";

const NS = {
  despatch:
    "urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  ds: "http://www.w3.org/2000/09/xmldsig#",
} as const;

export interface BuildDespatchAdviceXmlResult {
  xml: string;
  fileStem: string;
}

type XmlNode = ReturnType<ReturnType<typeof create>["ele"]>;

/**
 * Unsigned DespatchAdvice UBL 2.1 builder for GRE 09 / 31 (dict 18).
 * Omits empty UBLExtensions — XmlCryptoSignAdapter inserts them at sign time.
 */
export class XmlDespatchAdviceBuilder {
  build(input: DespatchCanonical): BuildDespatchAdviceXmlResult {
    const canonical = assertDespatchCanonical(input);
    const id = documentId(canonical.serie, canonical.number);
    const stem = fileStem(
      canonical.supplier.identity_number,
      canonical.document_type,
      canonical.serie,
      canonical.number,
    );

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele(
      "DespatchAdvice",
      {
        xmlns: NS.despatch,
        "xmlns:cac": NS.cac,
        "xmlns:cbc": NS.cbc,
        "xmlns:ds": NS.ds,
        "xmlns:ext": NS.ext,
      },
    );

    root.ele("cbc:UBLVersionID").txt("2.1").up();
    root.ele("cbc:CustomizationID").txt("2.0").up();
    root.ele("cbc:ID").txt(id).up();
    root.ele("cbc:IssueDate").txt(canonical.issue_date).up();
    if (canonical.issue_time) {
      root.ele("cbc:IssueTime").txt(canonical.issue_time).up();
    }
    root
      .ele("cbc:DespatchAdviceTypeCode")
      .txt(canonical.document_type)
      .up();
    if (canonical.notes) {
      root.ele("cbc:Note").txt(canonical.notes).up();
    }

    for (const related of canonical.related_documents ?? []) {
      const ref = root.ele("cac:AdditionalDocumentReference");
      ref.ele("cbc:ID").txt(related.serie_number).up();
      ref
        .ele("cbc:DocumentTypeCode")
        .txt(related.document_type)
        .up();
    }

    appendParty(root, "cac:DespatchSupplierParty", canonical.supplier);
    appendParty(root, "cac:DeliveryCustomerParty", canonical.delivery_customer);

    if (canonical.buyer) {
      appendParty(root, "cac:BuyerCustomerParty", canonical.buyer);
    }
    if (canonical.supplier_party) {
      appendParty(root, "cac:SellerSupplierParty", canonical.supplier_party);
    }

    appendShipment(root, canonical);

    for (const line of canonical.lines) {
      const node = root.ele("cac:DespatchLine");
      node.ele("cbc:ID").txt(String(line.id)).up();
      node
        .ele("cbc:DeliveredQuantity", { unitCode: line.unit_code })
        .txt(formatQuantity(line.quantity))
        .up();
      node
        .ele("cac:OrderLineReference")
        .ele("cbc:LineID")
        .txt(String(line.id))
        .up()
        .up();
      const item = node.ele("cac:Item");
      item.ele("cbc:Description").txt(line.description).up();
      if (line.product_code) {
        item
          .ele("cac:SellersItemIdentification")
          .ele("cbc:ID")
          .txt(line.product_code)
          .up()
          .up();
      }
      if (line.sunat_product_code) {
        item
          .ele("cac:CommodityClassification")
          .ele("cbc:ItemClassificationCode")
          .txt(line.sunat_product_code)
          .up()
          .up();
      }
    }

    const xml = root.end({ prettyPrint: true, indent: "  ", newline: "\n" });
    return { xml, fileStem: stem };
  }
}

function appendParty(
  parent: XmlNode,
  tag:
    | "cac:DespatchSupplierParty"
    | "cac:DeliveryCustomerParty"
    | "cac:BuyerCustomerParty"
    | "cac:SellerSupplierParty",
  party: PartyCanonical,
): void {
  const node = parent.ele(tag).ele("cac:Party");
  node
    .ele("cac:PartyIdentification")
    .ele("cbc:ID", { schemeID: party.identity_type })
    .txt(party.identity_number)
    .up()
    .up();
  node
    .ele("cac:PartyLegalEntity")
    .ele("cbc:RegistrationName")
    .txt(party.name)
    .up()
    .up();
}

function appendShipment(root: XmlNode, canonical: DespatchCanonical): void {
  const { shipment } = canonical;
  const node = root.ele("cac:Shipment");
  node.ele("cbc:ID").txt("SUNAT_Envio").up();
  if (shipment.transfer_reason_code) {
    node.ele("cbc:HandlingCode").txt(shipment.transfer_reason_code).up();
  }
  if (shipment.transfer_reason_text) {
    node
      .ele("cbc:HandlingInstructions")
      .txt(shipment.transfer_reason_text)
      .up();
  }
  node
    .ele("cbc:GrossWeightMeasure", {
      unitCode: shipment.gross_weight_unit,
    })
    .txt(formatQuantity(shipment.gross_weight))
    .up();
  if (shipment.total_packages !== undefined) {
    node
      .ele("cbc:TotalTransportHandlingUnitQuantity")
      .txt(formatQuantity(shipment.total_packages))
      .up();
  }

  const stage = node.ele("cac:ShipmentStage");
  if (shipment.transport_mode_code) {
    stage
      .ele("cbc:TransportModeCode")
      .txt(shipment.transport_mode_code)
      .up();
  }
  stage
    .ele("cac:TransitPeriod")
    .ele("cbc:StartDate")
    .txt(shipment.start_date)
    .up()
    .up();

  if (shipment.carrier) {
    const carrier = stage.ele("cac:CarrierParty");
    carrier
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", { schemeID: shipment.carrier.identity_type })
      .txt(shipment.carrier.identity_number)
      .up()
      .up();
    const legal = carrier.ele("cac:PartyLegalEntity");
    legal.ele("cbc:RegistrationName").txt(shipment.carrier.name).up();
    if (shipment.carrier.mtc_registration) {
      legal
        .ele("cbc:CompanyID")
        .txt(shipment.carrier.mtc_registration)
        .up();
    }
  }

  for (const driver of shipment.drivers ?? []) {
    const person = stage.ele("cac:DriverPerson");
    person
      .ele("cbc:ID", { schemeID: driver.identity_type })
      .txt(driver.identity_number)
      .up();
    person.ele("cbc:FirstName").txt(driver.name).up();
    if (driver.job_title) {
      person.ele("cbc:JobTitle").txt(driver.job_title).up();
    }
    if (driver.license) {
      person
        .ele("cac:IdentityDocumentReference")
        .ele("cbc:ID")
        .txt(driver.license)
        .up()
        .up();
    }
  }

  // UBL DeliveryType: DeliveryAddress precedes Despatch
  const delivery = node.ele("cac:Delivery");
  appendAddress(delivery, "cac:DeliveryAddress", shipment.destination);

  const despatch = delivery.ele("cac:Despatch");
  appendAddress(despatch, "cac:DespatchAddress", shipment.origin);

  if (canonical.document_type === "31" && canonical.shipper) {
    // DespatchParty is PartyType — identification/legal entity are direct children
    const despatchParty = despatch.ele("cac:DespatchParty");
    despatchParty
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", { schemeID: canonical.shipper.identity_type })
      .txt(canonical.shipper.identity_number)
      .up()
      .up();
    despatchParty
      .ele("cac:PartyLegalEntity")
      .ele("cbc:RegistrationName")
      .txt(canonical.shipper.name)
      .up()
      .up();
  }

  for (const vehicle of shipment.vehicles ?? []) {
    const thu = node.ele("cac:TransportHandlingUnit");
    const equipment = thu.ele("cac:TransportEquipment");
    equipment.ele("cbc:ID").txt(vehicle.plate).up();
    if (vehicle.authority_code) {
      equipment
        .ele("cac:ShipmentDocumentReference")
        .ele("cbc:ID")
        .txt(vehicle.authority_code)
        .up()
        .up();
    }
  }
}

function appendAddress(
  parent: XmlNode,
  tag: "cac:DespatchAddress" | "cac:DeliveryAddress",
  location: DespatchCanonical["shipment"]["origin"],
): void {
  const addr = parent.ele(tag);
  addr.ele("cbc:ID").txt(location.ubigeo).up();
  if (location.establishment_code) {
    addr.ele("cbc:AddressTypeCode").txt(location.establishment_code).up();
  }
  addr
    .ele("cac:AddressLine")
    .ele("cbc:Line")
    .txt(location.address)
    .up()
    .up();
}

function formatQuantity(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(3)));
}
