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
      version: "phase4",
      emission: ["01", "03", "07", "08", "09", "31", "RC", "RA"],
      cdr_recovery_by_identifiers: {
        document_types: ["01", "07", "08"],
        series_prefix: "F",
        environment: "production",
        max_cycles: 3,
      },
      ticket_consultation: ["RC", "RA", "09", "31"],
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
        "retention_document",
        "perception_document",
        "reversion",
        "GRE_void_REST",
        "CDR_identifier_recovery_for_boletas",
        "TXT",
        "offline",
      ],
      modes: {
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
