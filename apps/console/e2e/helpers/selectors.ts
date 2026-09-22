export const API_BASE =
  process.env.API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const DEMO = {
  org: "demo",
  owner: {
    email: "owner@demo.local",
    password: "DemoOwner!2026",
  },
  viewer: {
    email: "viewer@demo.local",
    password: "DemoViewer!2026",
  },
} as const;

export const testIds = {
  loginOrg: "login-org",
  loginEmail: "login-email",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  emitMenu: "emit-menu",
  emitInvoice: "emit-invoice",
  wizardCompany: "wizard-company",
  wizardSerie: "wizard-serie",
  wizardNext: "wizard-next",
  wizardSubmit: "wizard-submit",
  wizardCustomerNumber: "wizard-customer-number",
  wizardCustomerName: "wizard-customer-name",
  wizardLineDescription: "wizard-line-description",
  wizardLineQuantity: "wizard-line-quantity",
  wizardLineUnitValue: "wizard-line-unit-value",
  documentStatus: "document-status",
  artifactXml: "artifact-xml",
  artifactCdr: "artifact-cdr",
  artifactPdf: "artifact-pdf",
  nav: (id: string) => `nav-${id}`,
} as const;
