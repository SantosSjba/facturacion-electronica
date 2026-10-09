import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Env } from "../../../infrastructure/config/env.schema";
import { Public } from "../decorators/auth.decorators";
@Controller("v1/capabilities")
@Public()
@ApiTags("Integración")
export class CapabilitiesController {
  constructor(private readonly config: ConfigService<Env, true>) {}
  @Get()
  @ApiOperation({
    summary: "Matriz de capacidades reales y modos de transporte",
    description:
      "Fake/log prueban flujo, no aceptación oficial ni entrega SMTP real. No revela credenciales.",
  })
  get() {
    return {
      version: "phase6",
      txt: {
        version: 1,
        media_type: "text/plain; charset=utf-8",
        document_types: ["01", "03", "07", "08"],
        max_bytes: 204800,
        max_records: 2000,
        max_lines: 1000,
        shared_json_idempotency: true,
        format: "Factosys; not NubeFact TXT",
      },
      emission: ["01", "03", "07", "08", "09", "31", "RC", "RA", "20", "40", "RR"],
      cdr_recovery_by_identifiers: {
        document_types: ["01", "07", "08"],
        series_prefix: "F",
        environment: "production",
        max_cycles: 3,
      },
      ticket_consultation: ["RC", "RA", "09", "31", "RR"],
      tax_agents: {
        enabled_per_company: true,
        retention_rate: 3,
        perception_rates: { "01": 2, "02": 1, "03": 0.5 },
        xsd: "SUNAT UBL 2.0",
        excel_gate: false,
        production_endpoint: "otroscpe-gem",
        identifier_recovery: false,
      },
      delivery: {
        policy: "accepted_or_accepted_with_observation_only",
        summary_acceptance_supported: true,
        recipients_per_request: 10,
        waiting_days: 7,
        safe_attempts: 5,
        ambiguous_provider_result: "unknown_requires_manual_review",
      },
      recipient_access: {
        max_ttl_seconds: 604800,
        token_bits: 256,
        revocable: true,
        private_storage: true,
      },
      onboarding: {
        companies: true,
        series: true,
        encrypted_credentials: true,
        rotation: true,
        hard_delete: false,
      },
      formats: ["A4", "A5", "TICKET80", "TICKET58"],
      unsupported: [
        "GRE_void_REST",
        "CDR_identifier_recovery_for_boletas",
        "physical_contingency_communication",
        "Tax_Free",
        "specialized_sector_extensions",
        "offline",
        "reseller",
      ],
      modes: {
        tax_agent: this.config.get("SUNAT_AGENT_MODE", { infer: true }),
        bill: this.config.get("SUNAT_BILL_MODE", { infer: true }),
        gre: this.config.get("SUNAT_GRE_MODE", { infer: true }),
        email: this.config.get("EMAIL_DRIVER", { infer: true }),
        pdf: this.config.get("PDF_RI_MODE", { infer: true }),
      },
      official_acceptance:
        "Requires valid certificate, credentials and SUNAT CDR; local tests are not official evidence",
    };
  }
}
