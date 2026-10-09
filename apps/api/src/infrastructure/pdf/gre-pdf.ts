import { AppError } from "@factosys/shared";
import { isOfficialGreQrUrl } from "@factosys/sunat-gre";
import { assertDespatchCanonical } from "@factosys/sunat-ubl";
import { PDF_TEMPLATE_VERSION, type PdfRenderInput, type PdfFormat } from "@factosys/pdf-ri";
import type { DocumentsService } from "../documents/documents.service";
type Doc = Awaited<ReturnType<DocumentsService["getById"]>>;

export function greQrUrl(doc: Doc): string {
  const data = (
    doc.payload as { _gre?: { qr_url?: string; qr_source?: string; simulated?: boolean } }
  )?._gre;
  if (
    !["accepted", "accepted_with_observation"].includes(doc.status) ||
    data?.qr_source !== "sunat_cdr" ||
    data.simulated ||
    !data.qr_url ||
    !isOfficialGreQrUrl(data.qr_url)
  )
    throw AppError.conflict("GRE QR/PDF pending: requires accepted CDR with SUNAT QR URL", {
      details: [
        { path: "gre.qr_status", issue: doc.status === "rejected" ? "unavailable" : "pending" },
      ],
    });
  return data.qr_url;
}

export function grePdfInput(doc: Doc, logoDataUrl?: string): PdfRenderInput {
  const qr = greQrUrl(doc);
  const payload = doc.payload as {
    _canonical?: unknown;
    _print?: { format: PdfFormat; template_version: string };
  };
  if (!payload?._canonical) throw AppError.conflict("Historical GRE print snapshot unavailable");
  const c = assertDespatchCanonical(payload._canonical),
    s = c.shipment;
  const authorization = s.authorization ?? s.carrier?.authorization;
  const sections: NonNullable<PdfRenderInput["commercialSections"]> = [];
  const section = (title: string, values: [string, unknown][]) =>
    sections.push({
      title,
      entries: values
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([label, value]) => ({ label, value: String(value) })),
    });
  const party = (
    title: string,
    p: { identity_type: string; identity_number: string; name: string } | undefined,
  ) => {
    if (p)
      section(title, [
        ["Documento", p.identity_type + " " + p.identity_number],
        ["Nombre / razón social", p.name],
      ]);
  };
  section("Datos del traslado", [
    ["Motivo", s.transfer_reason_code],
    ["Descripción del motivo", s.transfer_reason_text],
    [
      "Modalidad",
      s.transport_mode_code === "01"
        ? "Público"
        : s.transport_mode_code === "02"
          ? "Privado"
          : "Transportista",
    ],
    ["Inicio del traslado", s.start_date],
    ["Hora de inicio", s.start_time],
    ["Entrega al transportista", s.handover_date],
    ["Peso bruto", s.gross_weight + " " + s.gross_weight_unit],
    ["Bultos / pallets", s.total_packages],
    ["Peso de ítems seleccionados", s.selected_items_weight],
    ["Sustento diferencia de peso", s.weight_difference_reason],
    ["Registro MTC", s.mtc_registration ?? s.carrier?.mtc_registration],
    [
      "Autorización",
      authorization ? authorization.entity_code + " " + authorization.number : undefined,
    ],
    ["Puerto", s.port_code],
    ["Pagador del flete", s.freight_payer],
  ]);
  for (const [title, location] of [
    ["Punto de partida", s.origin],
    ["Punto de llegada", s.destination],
  ] as const)
    section(title, [
      ["Ubigeo", location.ubigeo],
      ["Dirección", location.address],
      ["Establecimiento", location.establishment_code],
      ["RUC asociado", location.establishment_ruc],
    ]);
  party("Remitente", c.shipper);
  party("Transportista", s.carrier ?? (c.document_type === "31" ? c.supplier : undefined));
  party("Subcontratador", s.subcontractor);
  party("Tercero pagador del flete", s.freight_payer_party);
  party("Proveedor", c.supplier_party);
  party("Comprador", c.buyer);
  s.vehicles?.forEach((v, i) =>
    section(i ? "Vehículo secundario " + i : "Vehículo principal", [
      ["Placa", v.plate],
      ["TUC / habilitación", v.tuc],
      ["Autorización", v.authority_code],
      ["Entidad autorizadora", v.authority_entity_code],
    ]),
  );
  s.drivers?.forEach((d, i) =>
    section(i ? "Conductor secundario " + i : "Conductor principal", [
      ["Documento", d.identity_type + " " + d.identity_number],
      ["Nombres", d.name],
      ["Apellidos", d.last_name],
      ["Licencia", d.license],
    ]),
  );
  const containers =
    s.containers ?? (s.container_id ? [{ id: s.container_id, seal: s.container_seal }] : []);
  containers.forEach((box, i) =>
    section("Contenedor " + (i + 1), [
      ["Número", box.id],
      ["Precinto", box.seal],
    ]),
  );
  section("Indicadores", [
    ["Transbordo programado", s.scheduled_transshipment ? "Sí" : undefined],
    ["Vehículo M1/L", s.vehicle_m1_l ? "Sí" : undefined],
    ["Retorno de vehículo vacío", s.return_empty_vehicle ? "Sí" : undefined],
    ["Retorno con envases vacíos", s.return_empty_packaging ? "Sí" : undefined],
    ["Transporte subcontratado", s.subcontracted ? "Sí" : undefined],
    [
      "Registro de vehículos / conductores del transportista",
      s.register_carrier_transport ? "Sí" : undefined,
    ],
    ["Traslado total DAM/DS", s.total_customs_transfer ? "Sí" : undefined],
    ["Traslado total de bienes", s.total_goods_transfer ? "Sí" : undefined],
    ["Contenedor de manifiesto", s.manifest_container_transfer ? "Sí" : undefined],
  ]);
  if (c.related_documents?.length)
    section(
      "Documentos relacionados",
      c.related_documents.map((d) => [
        d.document_type + (d.description ? " " + d.description : ""),
        d.serie_number + (d.issuer ? " · Emisor " + d.issuer.identity_number : ""),
      ]),
    );
  return {
    documentType: c.document_type,
    format: payload._print?.format ?? "A4",
    templateVersion: payload._print?.template_version ?? PDF_TEMPLATE_VERSION,
    serieNumber: c.serie + "-" + String(c.number).padStart(8, "0"),
    issueDate: c.issue_date,
    issueTime: c.issue_time,
    currency: "",
    observations: c.notes,
    issuer: { ruc: c.supplier.identity_number, legalName: c.supplier.name, logoDataUrl },
    customer: {
      identityType: c.delivery_customer.identity_type,
      identityNumber: c.delivery_customer.identity_number,
      name: c.delivery_customer.name,
    },
    lines: c.lines.map((l) => ({
      description: l.description,
      quantity: String(l.quantity),
      unit: l.unit_code,
      unitPrice: "",
      amount: "",
      igv: "",
      productCode: l.product_code,
      sunatProductCode: l.sunat_product_code,
      details: [
        l.tariff_heading ? "Partida arancelaria: " + l.tariff_heading : "",
        l.customs_document_number
          ? "DAM/DS: " + l.customs_document_number + " · Serie " + l.customs_item_number
          : "",
        l.normalized_good === undefined
          ? ""
          : "Bien normalizado: " + (l.normalized_good ? "Sí" : "No"),
      ].filter(Boolean),
    })),
    totals: { total: "" },
    digestValue: "",
    qrPayload: qr,
    commercialSections: sections.filter((section) => section.entries.length > 0),
  };
}
