/** Aligns to apps/api despatch-advice-create.schema.ts */

export interface GrePartyInput {
  identity_type: string;
  identity_number: string;
  name: string;
}

export interface GreLocationInput {
  ubigeo: string;
  address: string;
  establishment_code?: string;
}

export interface GreCarrierInput {
  identity_type?: string;
  identity_number?: string;
  name?: string;
  mtc_registration?: string;
}

export interface GreVehicleInput {
  plate: string;
  authority_code?: string;
}

export interface GreDriverInput {
  job_title?: string;
  identity_type: string;
  identity_number: string;
  name: string;
  license?: string;
}

export interface GreShipmentInput {
  transfer_reason_code?: string;
  transfer_reason_text?: string;
  transport_mode_code?: string;
  gross_weight: number;
  gross_weight_unit: string;
  total_packages?: number;
  start_date: string;
  start_time?: string;
  carrier?: GreCarrierInput;
  vehicles?: GreVehicleInput[];
  drivers?: GreDriverInput[];
  origin: GreLocationInput;
  destination: GreLocationInput;
  container_id?: string;
  port_code?: string;
}

export interface GreLineInput {
  id: number;
  quantity: number;
  unit_code: string;
  description: string;
  product_code?: string;
  sunat_product_code?: string;
}

export interface DespatchAdviceCreateInput {
  company_id: string;
  document_type: "09" | "31";
  serie: string;
  number?: number;
  issue_date: string;
  issue_time?: string;
  notes?: string;
  shipper?: GrePartyInput;
  delivery_customer: GrePartyInput;
  supplier?: GrePartyInput;
  buyer?: GrePartyInput;
  shipment: GreShipmentInput;
  related_documents?: { document_type: string; serie_number: string }[];
  lines: GreLineInput[];
}
