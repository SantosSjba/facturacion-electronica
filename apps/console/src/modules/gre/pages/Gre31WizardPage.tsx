import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { WizardShell } from "@/modules/documents/components/wizard/WizardShell";
import { newIdempotencyKey, pollDocumentStatus } from "@/modules/documents/poll";
import { ErrorState } from "@/shared/ui/ErrorState";

import { emitDespatchAdvice, fetchCompanies } from "../api";
import {
  buildDespatchPayload,
  emptyGreHeader,
  emptyGreLine,
  emptyParty,
  emptyShipment,
  GreDeliveryStep,
  GreHeaderStep,
  GreLinesStep,
  GreReviewStep,
  GreShipperStep,
  GreShipmentStep,
  type GreHeaderState,
} from "../components/wizard/steps";
import type { GreLineInput, GrePartyInput, GreShipmentInput } from "../types";

const STEPS = [
  "Cabecera",
  "Remitente",
  "Destinatario",
  "Traslado",
  "Líneas",
  "Revisión",
];

export function Gre31WizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [idem] = useState(() => newIdempotencyKey());
  const [header, setHeader] = useState<GreHeaderState>(() =>
    emptyGreHeader(idem),
  );
  const [shipper, setShipper] = useState<GrePartyInput>(() => emptyParty("6"));
  const [delivery, setDelivery] = useState<GrePartyInput>(() => emptyParty("6"));
  const [shipment, setShipment] = useState<GreShipmentInput>(() => {
    const s = emptyShipment();
    // Optional for 31 API — start empty so user can leave unset
    s.transfer_reason_code = undefined;
    s.transport_mode_code = undefined;
    return s;
  });
  const [lines, setLines] = useState<GreLineInput[]>([emptyGreLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const payload = useMemo(
    () =>
      buildDespatchPayload({
        documentType: "31",
        header,
        delivery,
        shipper,
        shipment,
        lines,
      }),
    [header, delivery, shipper, shipment, lines],
  );

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const doc = await emitDespatchAdvice(payload, header.idempotency_key);
      const final = await pollDocumentStatus(doc.id);
      navigate(`/gre/${final.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al emitir GRE");
      setStep(STEPS.length - 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (companiesQuery.error) {
    return (
      <ErrorState
        message={
          companiesQuery.error instanceof Error
            ? companiesQuery.error.message
            : "Error"
        }
        onRetry={() => void companiesQuery.refetch()}
      />
    );
  }

  return (
    <WizardShell
      title="Emitir GRE transportista (31)"
      description="Guía de remisión electrónica — transportista. Shipper, vehículos y conductores requeridos."
      step={step}
      steps={STEPS}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onSubmit={() => void onSubmit()}
      submitting={submitting}
      nextError={
        step === 0 && (!header.company_id || !header.serie)
          ? "Selecciona la empresa y una serie V### activa."
          : step === 1 && (!shipper.identity_number || !shipper.name)
            ? "Completa el remitente (shipper)."
            : step === 2 && (!delivery.identity_number || !delivery.name)
              ? "Completa el destinatario."
              : step === 3 &&
                  (!shipment.origin.ubigeo ||
                    !shipment.origin.address ||
                    !shipment.destination.ubigeo ||
                    !shipment.destination.address ||
                    shipment.gross_weight <= 0 ||
                    !(shipment.vehicles?.[0]?.plate) ||
                    !(shipment.drivers?.[0]?.identity_number) ||
                    !(shipment.drivers?.[0]?.name) ||
                    !(shipment.drivers?.[0]?.license))
                ? "Completa peso, origen/destino, vehículo y conductor principal con licencia."
                : step === 4 &&
                    lines.some(
                      (l) => !l.description || l.quantity <= 0 || !l.unit_code,
                    )
                  ? "Cada línea requiere descripción, cantidad > 0 y unidad."
                  : null
      }
    >
      {step === 0 ? (
        <GreHeaderStep
          value={header}
          onChange={setHeader}
          companies={companiesQuery.data ?? []}
          documentType="31"
          seriePrefix={/^V/i}
        />
      ) : null}
      {step === 1 ? (
        <GreShipperStep value={shipper} onChange={setShipper} />
      ) : null}
      {step === 2 ? (
        <GreDeliveryStep value={delivery} onChange={setDelivery} />
      ) : null}
      {step === 3 ? (
        <GreShipmentStep
          value={shipment}
          onChange={setShipment}
          mode="31"
        />
      ) : null}
      {step === 4 ? (
        <GreLinesStep lines={lines} onChange={setLines} />
      ) : null}
      {step === 5 ? <GreReviewStep payload={payload} error={error} /> : null}
    </WizardShell>
  );
}
