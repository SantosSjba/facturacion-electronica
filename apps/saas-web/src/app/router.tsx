import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { DashboardPage } from "@/modules/platform/pages/DashboardPage";
import { OrganizationDetailPage } from "@/modules/platform/pages/OrganizationDetailPage";
import { OrganizationsListPage } from "@/modules/platform/pages/OrganizationsListPage";
import { PlansListPage } from "@/modules/platform/pages/PlansListPage";
import { SignupRequestDetailPage } from "@/modules/platform/pages/SignupRequestDetailPage";
import { SignupRequestsListPage } from "@/modules/platform/pages/SignupRequestsListPage";

import { AppShell } from "./AppShell";
import { RedirectIfAuthed, RequirePlatform } from "./guards";

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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/platform" replace />} />
    </Routes>
  );
}
