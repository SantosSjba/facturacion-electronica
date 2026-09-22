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
  GreShipmentStep,
  type GreHeaderState,
} from "../components/wizard/steps";
import type { GreLineInput, GrePartyInput, GreShipmentInput } from "../types";

const STEPS = ["Cabecera", "Destinatario", "Traslado", "Líneas", "Revisión"];

export function Gre09WizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [idem] = useState(() => newIdempotencyKey());
  const [header, setHeader] = useState<GreHeaderState>(() =>
    emptyGreHeader(idem),
  );
  const [delivery, setDelivery] = useState<GrePartyInput>(() => emptyParty("6"));
  const [shipment, setShipment] = useState<GreShipmentInput>(() =>
    emptyShipment(),
  );
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
        documentType: "09",
        header,
        delivery,
        shipment,
        lines,
      }),
    [header, delivery, shipment, lines],
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

  const mode = shipment.transport_mode_code;

  return (
    <WizardShell
      title="Emitir GRE remitente (09)"
      description="Guía de remisión electrónica — remitente. Idempotency-Key + poll SUNAT."
      step={step}
      steps={STEPS}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
      onSubmit={() => void onSubmit()}
      submitting={submitting}
      nextError={
        step === 0 && (!header.company_id || !header.serie)
          ? "Selecciona la empresa y una serie T### activa."
          : step === 1 && (!delivery.identity_number || !delivery.name)
            ? "Completa el destinatario."
            : step === 2 &&
                (!shipment.transfer_reason_code ||
                  !shipment.transport_mode_code ||
                  !shipment.origin.ubigeo ||
                  !shipment.origin.address ||
                  !shipment.destination.ubigeo ||
                  !shipment.destination.address ||
                  shipment.gross_weight <= 0 ||
                  (mode === "01" &&
                    !(
                      shipment.carrier?.identity_number && shipment.carrier?.name
                    )) ||
                  (mode === "02" &&
                    (!(shipment.vehicles?.[0]?.plate) ||
                      !(shipment.drivers?.[0]?.identity_number) ||
                      !(shipment.drivers?.[0]?.name))))
              ? "Completa motivo, modalidad, peso, origen/destino y datos de transporte."
              : step === 3 &&
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
          documentType="09"
          seriePrefix={/^T/i}
        />
      ) : null}
      {step === 1 ? (
        <GreDeliveryStep value={delivery} onChange={setDelivery} />
      ) : null}
      {step === 2 ? (
        <GreShipmentStep
          value={shipment}
          onChange={setShipment}
          mode="09"
        />
      ) : null}
      {step === 3 ? (
        <GreLinesStep lines={lines} onChange={setLines} />
      ) : null}
      {step === 4 ? <GreReviewStep payload={payload} error={error} /> : null}
    </WizardShell>
  );
}
