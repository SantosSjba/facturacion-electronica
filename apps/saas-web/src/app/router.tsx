import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { AcceptInvitePage } from "@/modules/auth/pages/AcceptInvitePage";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { CertificateTab } from "@/modules/companies/components/tabs/CertificateTab";
import { GreTab } from "@/modules/companies/components/tabs/GreTab";
import { OverviewTab } from "@/modules/companies/components/tabs/OverviewTab";
import { RulesetTab } from "@/modules/companies/components/tabs/RulesetTab";
import { SeriesTab } from "@/modules/companies/components/tabs/SeriesTab";
import { SolTab } from "@/modules/companies/components/tabs/SolTab";
import { CompaniesListPage } from "@/modules/companies/pages/CompaniesListPage";
import { CompanyDetailPage } from "@/modules/companies/pages/CompanyDetailPage";
import { ApiKeysListPage } from "@/modules/developers/pages/ApiKeysListPage";
import { WebhooksListPage } from "@/modules/developers/pages/WebhooksListPage";
import { WebhookDeliveriesPage } from "@/modules/developers/pages/WebhookDeliveriesPage";
import { AppHomePage } from "@/modules/app/pages/AppHomePage";
import { AppNotificationsPage } from "@/modules/app/pages/AppNotificationsPage";
import { AppPlanPage } from "@/modules/app/pages/AppPlanPage";
import { AppSecurityPage } from "@/modules/app/pages/AppSecurityPage";
import { AppUsersPage } from "@/modules/app/pages/AppUsersPage";
import { OnboardingWizardPage } from "@/modules/app/pages/OnboardingWizardPage";
import { DashboardPage } from "@/modules/platform/pages/DashboardPage";
import { AuditListPage } from "@/modules/platform/pages/AuditListPage";
import { LegalDocumentsPage } from "@/modules/platform/pages/LegalDocumentsPage";
import { OrganizationDetailPage } from "@/modules/platform/pages/OrganizationDetailPage";
import { OrganizationsListPage } from "@/modules/platform/pages/OrganizationsListPage";
import { PlansListPage } from "@/modules/platform/pages/PlansListPage";
import { PlanChangeRequestsPage } from "@/modules/platform/pages/PlanChangeRequestsPage";
import { SignupRequestDetailPage } from "@/modules/platform/pages/SignupRequestDetailPage";
import { SignupRequestsListPage } from "@/modules/platform/pages/SignupRequestsListPage";

import { AppShell } from "./AppShell";
import {
  RedirectIfAuthed,
  RedirectIfOnboarded,
  RequireOnboarded,
  RequireOrg,
  RequirePlatform,
  RequirePermission,
} from "./guards";

function RedirectAcceptInvite() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={`/auth/accept-invite${qs ? `?${qs}` : ""}`} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/platform" replace />} />

      <Route
        path="/auth/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/login" element={<Navigate to="/auth/login" replace />} />
      <Route
        path="/auth/accept-invite"
        element={
          <RedirectIfAuthed>
            <AcceptInvitePage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/accept-invite" element={<RedirectAcceptInvite />} />

      <Route element={<RequirePlatform />}>
        <Route element={<AppShell />}>
          <Route path="/platform" element={<DashboardPage />} />
          <Route path="/platform/signup-requests" element={<SignupRequestsListPage />} />
          <Route path="/platform/signup-requests/:id" element={<SignupRequestDetailPage />} />
          <Route path="/platform/organizations" element={<OrganizationsListPage />} />
          <Route path="/platform/organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="/platform/plans" element={<PlansListPage />} />
          <Route path="/platform/plan-change-requests" element={<PlanChangeRequestsPage />} />
          <Route path="/platform/legal" element={<LegalDocumentsPage />} />
          <Route path="/platform/audit" element={<AuditListPage />} />
        </Route>
      </Route>

      <Route element={<RequireOrg />}>
        <Route
          path="/app/onboarding"
          element={
            <RedirectIfOnboarded>
              <OnboardingWizardPage />
            </RedirectIfOnboarded>
          }
        />
        <Route element={<RequireOnboarded />}>
          <Route element={<AppShell />}>
            <Route path="/app" element={<AppHomePage />} />
            <Route path="/app/users" element={<AppUsersPage />} />
            <Route element={<RequirePermission permission="companies:read" />}>
              <Route path="/app/companies" element={<CompaniesListPage />} />
              <Route path="/app/companies/:id" element={<CompanyDetailPage />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewTab />} />
                <Route path="certificate" element={<CertificateTab />} />
                <Route path="sol" element={<SolTab />} />
                <Route path="gre" element={<GreTab />} />
                <Route path="series" element={<SeriesTab />} />
                <Route path="ruleset" element={<RulesetTab />} />
              </Route>
            </Route>
            <Route element={<RequirePermission permission="apikeys:manage" />}>
              <Route path="/app/developers/api-keys" element={<ApiKeysListPage />} />
            </Route>
            <Route element={<RequirePermission permission="webhooks:manage" />}>
              <Route path="/app/developers/webhooks" element={<WebhooksListPage />} />
              <Route
                path="/app/developers/webhooks/:id/deliveries"
                element={<WebhookDeliveriesPage />}
              />
            </Route>
            <Route path="/app/plan" element={<AppPlanPage />} />
            <Route path="/app/notifications" element={<AppNotificationsPage />} />
            <Route path="/app/security" element={<AppSecurityPage />} />
            <Route path="/app/*" element={<Navigate to="/app" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/platform" replace />} />
    </Routes>
  );
}
