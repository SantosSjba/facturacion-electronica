import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Company, DocumentSeries } from "@/modules/companies/types";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { Select } from "@/shared/ui/components/select";
import { Textarea } from "@/shared/ui/components/textarea";

import { fetchSeries } from "../../api";
import type {
  DespatchAdviceCreateInput,
  GreDriverInput,
  GreLineInput,
  GreLocationInput,
  GrePartyInput,
  GreShipmentInput,
  GreVehicleInput,
} from "../../types";

export interface GreHeaderState {
  company_id: string;
  serie: string;
  number: string;
  issue_date: string;
  issue_time: string;
  notes: string;
  idempotency_key: string;
}

export function emptyGreHeader(idempotencyKey: string): GreHeaderState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    company_id: "",
    serie: "",
    number: "",
    issue_date: today,
    issue_time: "",
    notes: "",
    idempotency_key: idempotencyKey,
  };
}

export function emptyParty(identityType = "6"): GrePartyInput {
  return {
    identity_type: identityType,
    identity_number: "",
    name: "",
  };
}

export function emptyLocation(): GreLocationInput {
  return { ubigeo: "", address: "", establishment_code: "" };
}

export function emptyVehicle(): GreVehicleInput {
  return { plate: "", authority_code: "" };
}

export function emptyDriver(requireLicense = false): GreDriverInput {
  return {
    job_title: "Principal",
    identity_type: "1",
    identity_number: "",
    name: "",
    license: requireLicense ? "" : undefined,
  };
}

export function emptyGreLine(id = 1): GreLineInput {
  return {
    id,
    quantity: 1,
    unit_code: "NIU",
    description: "",
  };
}

export function emptyShipment(today = new Date().toISOString().slice(0, 10)): GreShipmentInput {
  return {
    transfer_reason_code: "01",
    transfer_reason_text: "",
    transport_mode_code: "02",
    gross_weight: 1,
    gross_weight_unit: "KGM",
    total_packages: 1,
    start_date: today,
    start_time: "",
    carrier: {
      identity_type: "6",
      identity_number: "",
      name: "",
      mtc_registration: "",
    },
    vehicles: [emptyVehicle()],
    drivers: [emptyDriver(true)],
    origin: emptyLocation(),
    destination: emptyLocation(),
  };
}

const TRANSFER_REASON_OPTIONS = [
  { value: "01", label: "01 Venta" },
  { value: "02", label: "02 Compra" },
  { value: "04", label: "04 Traslado entre establecimientos" },
  { value: "05", label: "05 Consignación" },
  { value: "06", label: "06 Devolución" },
  { value: "08", label: "08 Importación" },
  { value: "09", label: "09 Exportación" },
  { value: "13", label: "13 Otros" },
  { value: "14", label: "14 Venta sujeta a confirmación" },
  { value: "18", label: "18 Emisor itinerante CP" },
  { value: "19", label: "19 Zona primaria" },
];

function preventInvalidNumberKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
}

function PartyFields({
  value,
  onChange,
  title,
}: {
  value: GrePartyInput;
  onChange: (next: GrePartyInput) => void;
  title?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {title ? (
        <MutedText className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-white/90">
          {title}
        </MutedText>
      ) : null}
      <div className="space-y-1.5">
        <Label>Tipo doc. identidad</Label>
        <Select
          value={value.identity_type}
          onChange={(e) =>
            onChange({ ...value, identity_type: e.target.value })
          }
        >
          <option value="6">6 RUC</option>
          <option value="1">1 DNI</option>
          <option value="4">4 Carnet extranjería</option>
          <option value="0">0 DOC.TRIB.NO.DOM.SIN.RUC</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Número</Label>
        <Input
          value={value.identity_number}
          inputMode={
            value.identity_type === "1" || value.identity_type === "6"
              ? "numeric"
              : "text"
          }
          maxLength={
            value.identity_type === "6"
              ? 11
              : value.identity_type === "1"
                ? 8
                : 20
          }
          onChange={(e) =>
            onChange({
              ...value,
              identity_number:
                value.identity_type === "1" || value.identity_type === "6"
                  ? e.target.value.replace(/\D/g, "")
                  : e.target.value,
            })
          }
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Nombre / Razón social</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
    </div>
  );
}

function LocationFields({
  value,
  onChange,
  title,
}: {
  value: GreLocationInput;
  onChange: (next: GreLocationInput) => void;
  title: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-800">
      <MutedText className="text-sm font-medium text-gray-800 dark:text-white/90">
        {title}
      </MutedText>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Ubigeo</Label>
          <Input
            value={value.ubigeo}
            maxLength={6}
            inputMode="numeric"
            placeholder="150101"
            onChange={(e) =>
              onChange({
                ...value,
                ubigeo: e.target.value.replace(/\D/g, "").slice(0, 6),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cód. establecimiento (opc.)</Label>
          <Input
            value={value.establishment_code ?? ""}
            onChange={(e) =>
              onChange({ ...value, establishment_code: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Dirección</Label>
          <Input
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function GreHeaderStep({
  value,
  onChange,
  companies,
  documentType,
  seriePrefix,
}: {
  value: GreHeaderState;
  onChange: (next: GreHeaderState) => void;
  companies: Company[];
  documentType: "09" | "31";
  seriePrefix: RegExp;
}) {
  const seriesQuery = useQuery({
    queryKey: ["series", value.company_id],
    queryFn: () => fetchSeries(value.company_id),
    enabled: Boolean(value.company_id),
  });

  const series = (seriesQuery.data ?? []).filter((s: DocumentSeries) => {
    if (s.documentType !== documentType || !s.isActive) return false;
    if (!seriePrefix.test(s.serie)) return false;
    return true;
  });

  useEffect(() => {
    if (!value.serie && series[0]) {
      onChange({ ...value, serie: series[0].serie });
    }
  }, [series, value, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Empresa</Label>
        <Select
          value={value.company_id}
          onChange={(e) =>
            onChange({ ...value, company_id: e.target.value, serie: "" })
          }
        >
          <option value="">Seleccionar…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.ruc} — {c.legal_name} ({c.environment})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Serie</Label>
        <Select
          value={value.serie}
          onChange={(e) => onChange({ ...value, serie: e.target.value })}
          disabled={!value.company_id}
        >
          <option value="">Seleccionar…</option>
          {series.map((s) => (
            <option key={s.id} value={s.serie}>
              {s.serie} (next {s.nextNumber})
            </option>
          ))}
        </Select>
        <MutedText className="text-xs">
          {documentType === "09"
            ? "Solo series T### activas (tipo 09)."
            : "Solo series V### activas (tipo 31)."}
        </MutedText>
      </div>
      <div className="space-y-1.5">
        <Label>Número (opcional)</Label>
        <Input
          type="text"
          inputMode="numeric"
          value={value.number}
          onChange={(e) =>
            onChange({
              ...value,
              number: e.target.value.replace(/\D/g, ""),
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Fecha emisión</Label>
        <Input
          type="date"
          value={value.issue_date}
          onChange={(e) => onChange({ ...value, issue_date: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Hora (opcional)</Label>
        <Input
          type="time"
          step={1}
          value={value.issue_time}
          onChange={(e) => onChange({ ...value, issue_time: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Notas (opcional)</Label>
        <Textarea
          value={value.notes}
          rows={2}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Idempotency-Key</Label>
        <div className="flex gap-2">
          <Input readOnly value={value.idempotency_key} className="font-mono" />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void navigator.clipboard.writeText(value.idempotency_key)
            }
          >
            Copiar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GreDeliveryStep({
  value,
  onChange,
}: {
  value: GrePartyInput;
  onChange: (next: GrePartyInput) => void;
}) {
  return <PartyFields value={value} onChange={onChange} title="Destinatario" />;
}

export function GreShipperStep({
  value,
  onChange,
}: {
  value: GrePartyInput;
  onChange: (next: GrePartyInput) => void;
}) {
  return (
    <PartyFields
      value={value}
      onChange={onChange}
      title="Remitente / Shipper (requerido en GRE 31)"
    />
  );
}

export function GreShipmentStep({
  value,
  onChange,
  mode,
}: {
  value: GreShipmentInput;
  onChange: (next: GreShipmentInput) => void;
  /** 09: reason+mode required; público→carrier, privado→vehicle+driver. 31: vehicles+drivers always. */
  mode: "09" | "31";
}) {
  const transportMode = value.transport_mode_code ?? "";
  const showCarrier = mode === "09" && transportMode === "01";
  const showPrivateTransport =
    mode === "31" || (mode === "09" && transportMode === "02");

  function patch(p: Partial<GreShipmentInput>) {
    onChange({ ...value, ...p });
  }

  function updateVehicle(i: number, patchVeh: Partial<GreVehicleInput>) {
    const vehicles = [...(value.vehicles ?? [])];
    vehicles[i] = { ...vehicles[i], ...patchVeh };
    patch({ vehicles });
  }

  function updateDriver(i: number, patchDrv: Partial<GreDriverInput>) {
    const drivers = [...(value.drivers ?? [])];
    drivers[i] = { ...drivers[i], ...patchDrv };
    patch({ drivers });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            Motivo de traslado
            {mode === "09" ? "" : " (opc.)"}
          </Label>
          <Select
            value={value.transfer_reason_code ?? ""}
            onChange={(e) =>
              patch({ transfer_reason_code: e.target.value || undefined })
            }
          >
            {mode === "31" ? <option value="">—</option> : null}
            {TRANSFER_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Texto motivo (opc.)</Label>
          <Input
            value={value.transfer_reason_text ?? ""}
            onChange={(e) =>
              patch({ transfer_reason_text: e.target.value || undefined })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Modalidad de transporte
            {mode === "09" ? "" : " (opc.)"}
          </Label>
          <Select
            value={value.transport_mode_code ?? ""}
            onChange={(e) =>
              patch({ transport_mode_code: e.target.value || undefined })
            }
          >
            {mode === "31" ? <option value="">—</option> : null}
            <option value="01">01 Público</option>
            <option value="02">02 Privado</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha inicio traslado</Label>
          <Input
            type="date"
            value={value.start_date}
            onChange={(e) => patch({ start_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hora inicio (opc.)</Label>
          <Input
            type="time"
            step={1}
            value={value.start_time ?? ""}
            onChange={(e) =>
              patch({ start_time: e.target.value || undefined })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Peso bruto</Label>
          <Input
            type="number"
            min={0.0001}
            step="any"
            value={value.gross_weight}
            onKeyDown={preventInvalidNumberKey}
            onChange={(e) =>
              patch({ gross_weight: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Unidad peso</Label>
          <Select
            value={value.gross_weight_unit}
            onChange={(e) => patch({ gross_weight_unit: e.target.value })}
          >
            <option value="KGM">KGM</option>
            <option value="TNE">TNE</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bultos (opc.)</Label>
          <Input
            type="number"
            min={0}
            value={value.total_packages ?? ""}
            onKeyDown={preventInvalidNumberKey}
            onChange={(e) =>
              patch({
                total_packages: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
      </div>

      {showCarrier ? (
        <div className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-800">
          <MutedText className="text-sm font-medium text-gray-800 dark:text-white/90">
            Transportista (público)
          </MutedText>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo doc.</Label>
              <Select
                value={value.carrier?.identity_type ?? "6"}
                onChange={(e) =>
                  patch({
                    carrier: {
                      ...value.carrier,
                      identity_type: e.target.value,
                    },
                  })
                }
              >
                <option value="6">6 RUC</option>
                <option value="1">1 DNI</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input
                value={value.carrier?.identity_number ?? ""}
                onChange={(e) =>
                  patch({
                    carrier: {
                      ...value.carrier,
                      identity_number: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={value.carrier?.name ?? ""}
                onChange={(e) =>
                  patch({
                    carrier: { ...value.carrier, name: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Registro MTC (opc.)</Label>
              <Input
                value={value.carrier?.mtc_registration ?? ""}
                onChange={(e) =>
                  patch({
                    carrier: {
                      ...value.carrier,
                      mtc_registration: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {showPrivateTransport ? (
        <div className="space-y-4">
          <div className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-800">
            <MutedText className="text-sm font-medium text-gray-800 dark:text-white/90">
              Vehículos
              {mode === "31" ? " (requerido)" : ""}
            </MutedText>
            {(value.vehicles ?? []).map((veh, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Placa</Label>
                  <Input
                    value={veh.plate}
                    onChange={(e) =>
                      updateVehicle(i, {
                        plate: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Código autoridad (opc.)</Label>
                  <Input
                    value={veh.authority_code ?? ""}
                    onChange={(e) =>
                      updateVehicle(i, { authority_code: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patch({
                  vehicles: [...(value.vehicles ?? []), emptyVehicle()],
                })
              }
            >
              Agregar vehículo
            </Button>
          </div>

          <div className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-800">
            <MutedText className="text-sm font-medium text-gray-800 dark:text-white/90">
              Conductores
              {mode === "31" ? " (licencia requerida en el principal)" : ""}
            </MutedText>
            {(value.drivers ?? []).map((drv, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-md border border-gray-100 p-2 sm:grid-cols-2 dark:border-gray-800"
              >
                <div className="space-y-1.5">
                  <Label>Tipo doc.</Label>
                  <Select
                    value={drv.identity_type}
                    onChange={(e) =>
                      updateDriver(i, { identity_type: e.target.value })
                    }
                  >
                    <option value="1">1 DNI</option>
                    <option value="4">4 CE</option>
                    <option value="7">7 Pasaporte</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input
                    value={drv.identity_number}
                    onChange={(e) =>
                      updateDriver(i, { identity_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nombre</Label>
                  <Input
                    value={drv.name}
                    onChange={(e) =>
                      updateDriver(i, { name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Licencia
                    {mode === "31" && i === 0 ? " (requerida)" : " (opc.)"}
                  </Label>
                  <Input
                    value={drv.license ?? ""}
                    onChange={(e) =>
                      updateDriver(i, {
                        license: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo (opc.)</Label>
                  <Input
                    value={drv.job_title ?? ""}
                    onChange={(e) =>
                      updateDriver(i, {
                        job_title: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patch({
                  drivers: [...(value.drivers ?? []), emptyDriver(false)],
                })
              }
            >
              Agregar conductor
            </Button>
          </div>
        </div>
      ) : null}

      <LocationFields
        title="Punto de partida"
        value={value.origin}
        onChange={(origin) => patch({ origin })}
      />
      <LocationFields
        title="Punto de llegada"
        value={value.destination}
        onChange={(destination) => patch({ destination })}
      />
    </div>
  );
}

export function GreLinesStep({
  lines,
  onChange,
}: {
  lines: GreLineInput[];
  onChange: (next: GreLineInput[]) => void;
}) {
  function update(i: number, patch: Partial<GreLineInput>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-4">
      {lines.map((line, i) => (
        <div
          key={line.id}
          className="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-800"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descripción</Label>
            <Input
              value={line.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0.0001}
              step="any"
              value={line.quantity}
              onKeyDown={preventInvalidNumberKey}
              onChange={(e) =>
                update(i, { quantity: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unidad</Label>
            <Input
              value={line.unit_code}
              onChange={(e) => update(i, { unit_code: e.target.value })}
            />
          </div>
          {lines.length > 1 ? (
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
              >
                Quitar línea
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...lines,
            emptyGreLine(Math.max(...lines.map((l) => l.id), 0) + 1),
          ])
        }
      >
        Agregar línea
      </Button>
    </div>
  );
}

export function GreReviewStep({
  payload,
  error,
}: {
  payload: unknown;
  error?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(payload, null, 2);

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-error-600 dark:text-error-500">{error}</p>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copiado" : "Copiar JSON"}
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-md bg-gray-100 p-3 text-xs dark:bg-white/5">
        {json}
      </pre>
    </div>
  );
}

/** Build API body; strips empty optional nested fields. */
export function buildDespatchPayload(args: {
  documentType: "09" | "31";
  header: GreHeaderState;
  delivery: GrePartyInput;
  shipper?: GrePartyInput;
  shipment: GreShipmentInput;
  lines: GreLineInput[];
}): DespatchAdviceCreateInput {
  const { documentType, header, delivery, shipper, shipment, lines } = args;

  const origin: GreLocationInput = {
    ubigeo: shipment.origin.ubigeo,
    address: shipment.origin.address,
    ...(shipment.origin.establishment_code
      ? { establishment_code: shipment.origin.establishment_code }
      : {}),
  };
  const destination: GreLocationInput = {
    ubigeo: shipment.destination.ubigeo,
    address: shipment.destination.address,
    ...(shipment.destination.establishment_code
      ? { establishment_code: shipment.destination.establishment_code }
      : {}),
  };

  const shipmentOut: GreShipmentInput = {
    gross_weight: shipment.gross_weight,
    gross_weight_unit: shipment.gross_weight_unit,
    start_date: shipment.start_date,
    origin,
    destination,
  };

  if (shipment.transfer_reason_code) {
    shipmentOut.transfer_reason_code = shipment.transfer_reason_code;
  }
  if (shipment.transfer_reason_text) {
    shipmentOut.transfer_reason_text = shipment.transfer_reason_text;
  }
  if (shipment.transport_mode_code) {
    shipmentOut.transport_mode_code = shipment.transport_mode_code;
  }
  if (shipment.total_packages != null && shipment.total_packages !== undefined) {
    shipmentOut.total_packages = shipment.total_packages;
  }
  if (shipment.start_time) shipmentOut.start_time = shipment.start_time;

  const mode = shipment.transport_mode_code;
  if (documentType === "09" && mode === "01" && shipment.carrier) {
    const c = shipment.carrier;
    if (c.identity_number || c.name) {
      shipmentOut.carrier = {
        ...(c.identity_type ? { identity_type: c.identity_type } : {}),
        ...(c.identity_number ? { identity_number: c.identity_number } : {}),
        ...(c.name ? { name: c.name } : {}),
        ...(c.mtc_registration
          ? { mtc_registration: c.mtc_registration }
          : {}),
      };
    }
  }

  const includeVehiclesDrivers =
    documentType === "31" || (documentType === "09" && mode === "02");

  if (includeVehiclesDrivers) {
    const vehicles = (shipment.vehicles ?? [])
      .filter((v) => v.plate.trim())
      .map((v) => ({
        plate: v.plate.trim(),
        ...(v.authority_code ? { authority_code: v.authority_code } : {}),
      }));
    const drivers = (shipment.drivers ?? [])
      .filter((d) => d.identity_number && d.name)
      .map((d) => ({
        identity_type: d.identity_type,
        identity_number: d.identity_number,
        name: d.name,
        ...(d.job_title ? { job_title: d.job_title } : {}),
        ...(d.license ? { license: d.license } : {}),
      }));
    if (vehicles.length) shipmentOut.vehicles = vehicles;
    if (drivers.length) shipmentOut.drivers = drivers;
  }

  const body: DespatchAdviceCreateInput = {
    company_id: header.company_id,
    document_type: documentType,
    serie: header.serie,
    issue_date: header.issue_date,
    delivery_customer: {
      identity_type: delivery.identity_type,
      identity_number: delivery.identity_number,
      name: delivery.name,
    },
    shipment: shipmentOut,
    lines: lines.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      unit_code: l.unit_code,
      description: l.description,
      ...(l.product_code ? { product_code: l.product_code } : {}),
      ...(l.sunat_product_code
        ? { sunat_product_code: l.sunat_product_code }
        : {}),
    })),
  };

  if (header.number) body.number = Number(header.number);
  if (header.issue_time) body.issue_time = header.issue_time;
  if (header.notes) body.notes = header.notes;
  if (documentType === "31" && shipper) {
    body.shipper = {
      identity_type: shipper.identity_type,
      identity_number: shipper.identity_number,
      name: shipper.name,
    };
  }

  return body;
}
