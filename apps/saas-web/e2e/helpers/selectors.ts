export const API_BASE =
  process.env.API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const PLATFORM = {
  orgSlug: "factosys-platform",
  email: "platform@factosys.local",
  password: "PlatformAdmin!2026",
} as const;

export const testIds = {
  loginEmail: "login-email",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  loginOrg: (slug: string) => `login-org-${slug}`,
  signupMarkReview: "signup-mark-review",
  signupApprove: "signup-approve",
  signupApproved: "signup-approved",
  signupOrgId: "signup-org-id",
  invitePassword: "invite-password",
  inviteConfirm: "invite-confirm",
  inviteSubmit: "invite-submit",
  onbWelcomeNext: "onb-welcome-next",
  onbRuc: "onb-ruc",
  onbLegalName: "onb-legal-name",
  onbCreateCompany: "onb-create-company",
  onbAcceptPrivacy: "onb-accept-privacy",
  onbAcceptTerms: "onb-accept-terms",
  onbAcceptLegal: "onb-accept-legal",
  onbGotoApp: "onb-goto-app",
  legalReacceptPrivacy: "legal-reaccept-privacy",
  legalReacceptTerms: "legal-reaccept-terms",
  legalReacceptSubmit: "legal-reaccept-submit",
  nav: (id: string) => `nav-${id}`,
} as const;
