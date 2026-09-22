/**
 * @factosys/domain — entities / VOs / policies.
 * Must not import @nestjs/* (enforced by ESLint).
 */

export const DOMAIN_PACKAGE_NAME = "@factosys/domain" as const;

export { DOCUMENT_STATUS_VALUES, DocumentStatus } from "./document-status";

export { DocumentSeries, IdentityDocument, Money } from "./vos";
