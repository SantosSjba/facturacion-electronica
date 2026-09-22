import type {
  CpeValidationPort,
  CpeValidationRequest,
  CpeValidationResult,
} from "../cpe-validation.port";

/**
 * Fake validez CPE — fixture keys drive status (spec 28 / FE-226).
 * - ruc ending 00001 or serie F001 + number containing "accepted" → ACEPTADO
 * - number containing "void" / "anulado" → ANULADO
 * - number containing "missing" / "404" → NO_EXISTE
 * - fixture key `validation-cpe-accepted` via serie VALID + number 1
 */
export class FakeCpeValidationAdapter implements CpeValidationPort {
  async validate(input: CpeValidationRequest): Promise<CpeValidationResult> {
    const checkedAt = new Date().toISOString();
    const baseDoc = {
      ruc: input.ruc,
      document_type: input.documentType,
      serie: input.serie,
      number: String(input.number),
      issue_date: input.issueDate,
      total_amount: input.totalAmount,
    };

    const key = `${input.serie}-${input.number}`.toUpperCase();
    const num = String(input.number).toLowerCase();

    if (num.includes("void") || num.includes("anulado")) {
      return {
        success: true,
        message: "Comprobante anulado (fake)",
        document: baseDoc,
        cpe_status: "2",
        cpe_status_label: "ANULADO",
        ruc_status: "00",
        ruc_status_label: "ACTIVO",
        domicile_condition: "00",
        domicile_condition_label: "HABIDO",
        observations: [],
        sunat_error_code: null,
        checked_at: checkedAt,
        raw: { fixture: "validation-cpe-voided" },
      };
    }

    if (num.includes("missing") || num.includes("404")) {
      return {
        success: true,
        message: "Comprobante no existe (fake)",
        document: baseDoc,
        cpe_status: "0",
        cpe_status_label: "NO_EXISTE",
        ruc_status: "00",
        ruc_status_label: "ACTIVO",
        domicile_condition: "00",
        domicile_condition_label: "HABIDO",
        observations: [],
        sunat_error_code: null,
        checked_at: checkedAt,
        raw: { fixture: "validation-cpe-not-found" },
      };
    }

    if (
      key === "VALID-1" ||
      num.includes("accepted") ||
      input.serie.toUpperCase() === "F001"
    ) {
      return {
        success: true,
        message: "Comprobante aceptado (fake)",
        document: baseDoc,
        cpe_status: "1",
        cpe_status_label: "ACEPTADO",
        ruc_status: "00",
        ruc_status_label: "ACTIVO",
        domicile_condition: "00",
        domicile_condition_label: "HABIDO",
        observations: [],
        sunat_error_code: null,
        checked_at: checkedAt,
        raw: { fixture: "validation-cpe-accepted" },
      };
    }

    return {
      success: true,
      message: "Comprobante aceptado (fake default)",
      document: baseDoc,
      cpe_status: "1",
      cpe_status_label: "ACEPTADO",
      ruc_status: "00",
      ruc_status_label: "ACTIVO",
      domicile_condition: "00",
      domicile_condition_label: "HABIDO",
      observations: [],
      sunat_error_code: null,
      checked_at: checkedAt,
      raw: { fixture: "validation-cpe-default" },
    };
  }
}
