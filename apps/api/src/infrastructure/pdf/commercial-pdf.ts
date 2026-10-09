import type { InvoiceCanonical, InvoiceLineCanonical } from "@factosys/sunat-ubl";
import type { PdfRenderInput } from "@factosys/pdf-ri";
type Section = NonNullable<PdfRenderInput["commercialSections"]>[number];
const money = (value: number) => value.toFixed(2);
export function commercialSections(snapshot?: Record<string, unknown>): Section[] {
  if (!snapshot) return [];
  const c = snapshot as unknown as InvoiceCanonical;
  const sections: Section[] = [];
  const terms = c.payment_terms;
  if (terms)
    sections.push({
      title: "Forma de pago",
      entries:
        terms.condition === "cash"
          ? [{ label: "Condición", value: "Contado" }]
          : [
              { label: "Condición", value: "Crédito" },
              {
                label: "Saldo pendiente",
                value: `${money(terms.outstanding_amount)} ${terms.currency}`,
              },
              ...terms.installments.map((q) => ({
                label: `Cuota ${q.number}`,
                value: `${q.due_date} — ${money(q.amount)} ${terms.currency}`,
              })),
            ],
    });
  if (c.payment_means?.length)
    sections.push({
      title: "Medios de pago",
      entries: c.payment_means.map((m) => ({
        label: m.code,
        value: [m.account, m.bank, m.reference, m.due_date].filter(Boolean).join(" — "),
      })),
    });
  if (c.prepayments?.length)
    sections.push({
      title: "Anticipos",
      entries: c.prepayments.map((p) => ({
        label: `${p.document_type} ${p.serie_number}`,
        value: `RUC ${p.issuer_ruc}; ${p.paid_date}; base ${money(p.base_amount)}; aplicado ${money(p.amount)} ${c.currency}`,
      })),
    });
  if (c.detraction) {
    const d = c.detraction;
    sections.push({
      title: "Detracción",
      entries: [
        { label: "Bien o servicio", value: d.goods_code },
        { label: "Porcentaje", value: `${d.percent}%` },
        { label: "Monto", value: `${money(d.amount)} PEN` },
        { label: "Cuenta BN", value: d.account },
        { label: "Medio de pago", value: d.payment_means_code },
      ],
    });
  }
  if (c.exchange_rate) {
    const r = c.exchange_rate;
    sections.push({
      title: "Tipo de cambio",
      entries: [
        {
          label: `${r.source_currency} a ${r.target_currency}`,
          value: `${r.rate}; ${r.date}; ${r.source}`,
        },
      ],
    });
  }
  if (c.despatch_references?.length)
    sections.push({
      title: "Guías relacionadas",
      entries: c.despatch_references.map((r) => ({
        label: r.document_type,
        value: r.serie_number,
      })),
    });
  if (c.adjustments?.length)
    sections.push({
      title: "Descuentos y cargos",
      entries: c.adjustments.map((a) => ({
        label: `${a.code} ${a.reason ?? ""}`,
        value: `Base ${money(a.base_amount)}; importe ${money(a.amount)} ${c.currency}${a.factor ? `; factor ${a.factor}` : ""}`,
      })),
    });
  return sections;
}
export function commercialLineDetails(raw: Record<string, unknown>): string[] {
  const l = raw as unknown as InvoiceLineCanonical;
  const details = (l.adjustments ?? []).map(
    (a) =>
      `Ajuste ${a.code}${a.reason ? ` (${a.reason})` : ""}: ${money(a.amount)}; base ${money(a.base_amount)}${a.factor ? `; factor ${a.factor}` : ""}`,
  );
  if (l.isc)
    details.push(
      `ISC sistema ${l.isc.system}${l.isc.system === "02" ? `; monto por unidad ${l.isc.per_unit_amount}` : `; tasa ${l.isc.percent}%`}${l.isc.system === "03" ? `; precio público ${l.isc.retail_unit_price}; factor ${l.isc.factor}` : ""}`,
    );
  if (l.icbper)
    details.push(`Bolsas: ${l.icbper.quantity}; impuesto por bolsa: ${l.icbper.per_unit_amount}`);
  if (l.cargo_transport) {
    const t = l.cargo_transport;
    details.push(
      `Transporte: ${t.origin.ubigeo} ${t.origin.address} — ${t.destination.ubigeo} ${t.destination.address}`,
      t.trip_description,
      `Valores referenciales PEN: servicio ${money(t.reference_amount)}; carga ${money(t.reference_load_amount)}; vehículo ${money(t.reference_vehicle_amount)}`,
      ...t.trips.map(
        (trip, i) =>
          `Tramo ${i + 1}: ${trip.configuration}; ${trip.tons} TNE; carga efectiva ${trip.effective_tons} TNE; valor referencial ${money(trip.reference_amount)} PEN`,
      ),
    );
  }
  if (l.hydrobiology) {
    const h = l.hydrobiology;
    details.push(
      `Embarcación ${h.vessel_registration} ${h.vessel_name}; ${h.species}, cantidad ${h.quantity}; descarga ${h.unloading_place}, ${h.unloading_date}`,
    );
  }
  if (l.passenger_transport) {
    const p = l.passenger_transport;
    details.push(
      `Transporte de pasajeros: ${p.vehicle_plate}; ${p.service_date}; ${p.origin} — ${p.destination}`,
    );
  }
  return details;
}
