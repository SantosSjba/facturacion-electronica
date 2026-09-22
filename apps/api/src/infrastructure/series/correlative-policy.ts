/**
 * ADR-001 — correlativo policy (pure).
 * Used by emission later; tested here in S3-COMP.
 */
export type CorrelativeFailureStage =
  | "pre_sign"
  | "pre_sunat"
  | "post_sendbill"
  | "timeout_post_send"
  | "cdr_rejected"
  | "cdr_accepted";

export type CorrelativeAction = "liberate" | "retain" | "consume";

export function correlativePolicy(
  stage: CorrelativeFailureStage,
): CorrelativeAction {
  switch (stage) {
    case "pre_sign":
    case "pre_sunat":
      return "liberate";
    case "post_sendbill":
    case "timeout_post_send":
      return "retain";
    case "cdr_rejected":
    case "cdr_accepted":
      return "consume";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}
