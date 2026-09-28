import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { AcceptInvitePage } from "@/modules/auth/pages/AcceptInvitePage";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { AppCompaniesPage } from "@/modules/app/pages/AppCompaniesPage";
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
import { SignupRequestDetailPage } from "@/modules/platform/pages/SignupRequestDetailPage";
import { SignupRequestsListPage } from "@/modules/platform/pages/SignupRequestsListPage";

import { AppShell } from "./AppShell";
import {
  RedirectIfAuthed,
  RedirectIfOnboarded,
  RequireOnboarded,
  RequireOrg,
  RequirePlatform,
} from "./guards";

function RedirectAcceptInvite() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return (
    <Navigate to={`/auth/accept-invite${qs ? `?${qs}` : ""}`} replace />
  );
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
          <Route
            path="/platform/signup-requests"
            element={<SignupRequestsListPage />}
          />
          <Route
            path="/platform/signup-requests/:id"
            element={<SignupRequestDetailPage />}
          />
          <Route
            path="/platform/organizations"
            element={<OrganizationsListPage />}
          />
          <Route
            path="/platform/organizations/:id"
            element={<OrganizationDetailPage />}
          />
          <Route path="/platform/plans" element={<PlansListPage />} />
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
            <Route path="/app/companies" element={<AppCompaniesPage />} />
            <Route path="/app/plan" element={<AppPlanPage />} />
            <Route
              path="/app/notifications"
              element={<AppNotificationsPage />}
            />
            <Route path="/app/security" element={<AppSecurityPage />} />
            <Route path="/app/*" element={<Navigate to="/app" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/platform" replace />} />
    </Routes>
  );
}
