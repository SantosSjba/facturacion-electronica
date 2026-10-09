import type { create } from "xmlbuilder2";
import type { InvoiceCanonical } from "../types/invoice-canonical";
import type { NoteCanonical } from "../types/note-canonical";
import { appendCpeParty, formatUnit } from "./cpe-xml";
type Node = ReturnType<ReturnType<typeof create>["ele"]>;
type Cpe = InvoiceCanonical | NoteCanonical;

export function appendExtendedPartiesAndDelivery(
  root: Node,
  c: Cpe,
  beforeDelivery?: () => void,
): void {
  if (c.seller) appendCpeParty(root, "cac:SellerSupplierParty", c.seller);
  beforeDelivery?.();
  const e = c.embedded_despatch;
  if (e) {
    const shipment = root.ele("cac:Delivery").ele("cac:Shipment");
    shipment.ele("cbc:ID").txt("1");
    shipment
      .ele("cbc:GrossWeightMeasure", { unitCode: e.weight_unit })
      .txt(formatUnit(e.gross_weight, 3));
    const stage = shipment.ele("cac:ShipmentStage");
    stage.ele("cbc:TransportModeCode").txt(e.transport_mode);
    if (e.carrier) {
      const carrier = stage.ele("cac:CarrierParty");
      if (e.carrier.address) appendAddress(carrier.ele("cac:PostalAddress"), e.carrier.address);
      const legal = carrier.ele("cac:PartyLegalEntity");
      legal.ele("cbc:RegistrationName").txt(e.carrier.name);
      legal
        .ele("cbc:CompanyID", { schemeID: e.carrier.identity_type })
        .txt(e.carrier.identity_number);
    }
    const means = stage.ele("cac:TransportMeans");
    if (e.authorization) means.ele("cbc:RegistrationNationalityID").txt(e.authorization);
    means.ele("cac:RoadTransport").ele("cbc:LicensePlateID").txt(e.vehicle_plate);
    if (e.driver_license) stage.ele("cac:DriverPerson").ele("cbc:ID").txt(e.driver_license);
    const destination = shipment.ele("cac:Delivery").ele("cac:DeliveryAddress");
    if (e.destination.establishment_code)
      destination
        .ele("cbc:AddressTypeCode", { listID: e.destination.establishment_ruc })
        .txt(e.destination.establishment_code);
    destination.ele("cbc:CountrySubentityCode").txt(e.destination.ubigeo);
    destination.ele("cac:AddressLine").ele("cbc:Line").txt(e.destination.address);
    const equipment = shipment.ele("cac:TransportHandlingUnit").ele("cac:TransportEquipment");
    equipment.ele("cbc:ID").txt(e.vehicle_plate);
    if (e.vehicle_brand) equipment.ele("cbc:Description").txt(e.vehicle_brand);
    const origin = shipment.ele("cac:OriginAddress");
    if (e.origin.establishment_code)
      origin
        .ele("cbc:AddressTypeCode", { listID: e.origin.establishment_ruc })
        .txt(e.origin.establishment_code);
    origin.ele("cbc:CountrySubentityCode").txt(e.origin.ubigeo);
    origin.ele("cac:AddressLine").ele("cbc:Line").txt(e.origin.address);
  }
  if (c.delivery_address) {
    const address = root.ele("cac:DeliveryTerms").ele("cac:DeliveryLocation").ele("cac:Address");
    appendAddress(address, c.delivery_address);
  }
}
function appendAddress(address: Node, a: NonNullable<Cpe["delivery_address"]>): void {
  if (a.establishment_code) address.ele("cbc:AddressTypeCode").txt(a.establishment_code);
  if (a.line) address.ele("cbc:StreetName").txt(a.line);
  if (a.urbanization) address.ele("cbc:CitySubdivisionName").txt(a.urbanization);
  if (a.province) address.ele("cbc:CityName").txt(a.province);
  if (a.department) address.ele("cbc:CountrySubentity").txt(a.department);
  if (a.ubigeo) address.ele("cbc:CountrySubentityCode").txt(a.ubigeo);
  if (a.district) address.ele("cbc:District").txt(a.district);
  address
    .ele("cac:Country")
    .ele("cbc:IdentificationCode")
    .txt(a.country_code ?? "PE");
}
