import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { CertificateTab } from "@/modules/companies/components/tabs/CertificateTab";
import { GreTab } from "@/modules/companies/components/tabs/GreTab";
import { OverviewTab } from "@/modules/companies/components/tabs/OverviewTab";
import { RulesetTab } from "@/modules/companies/components/tabs/RulesetTab";
import { SeriesTab } from "@/modules/companies/components/tabs/SeriesTab";
import { SolTab } from "@/modules/companies/components/tabs/SolTab";
import { CompaniesListPage } from "@/modules/companies/pages/CompaniesListPage";
import { CompanyDetailPage } from "@/modules/companies/pages/CompanyDetailPage";
import { CompanyFormPage } from "@/modules/companies/pages/CompanyFormPage";
import {
  ApiKeysStub,
  AuditStub,
  ValidationsStub,
  WebhooksStub,
} from "@/modules/developers/pages/DevelopersStubs";
import { DocumentsStub } from "@/modules/documents/pages/DocumentsStub";
import { GreStub } from "@/modules/gre/pages/GreStub";
import { PermissionsMatrixPage } from "@/modules/users/pages/PermissionsMatrixPage";
import { UserDetailPage } from "@/modules/users/pages/UserDetailPage";
import { UsersListPage } from "@/modules/users/pages/UsersListPage";

import { AppShell } from "./AppShell";
import { HomeRedirect, RedirectIfAuthed, RequireAuth } from "./guards";
import { AppProviders } from "./providers";

export function AppRouter() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <LoginPage />
              </RedirectIfAuthed>
            }
          />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<HomeRedirect />} />
              <Route path="companies" element={<CompaniesListPage />} />
              <Route
                path="companies/new"
                element={<CompanyFormPage mode="create" />}
              />
              <Route
                path="companies/:id/edit"
                element={<CompanyFormPage mode="edit" />}
              />
              <Route path="companies/:id" element={<CompanyDetailPage />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewTab />} />
                <Route path="certificate" element={<CertificateTab />} />
                <Route path="sol" element={<SolTab />} />
                <Route path="gre" element={<GreTab />} />
                <Route path="series" element={<SeriesTab />} />
                <Route path="ruleset" element={<RulesetTab />} />
              </Route>
              <Route path="users" element={<UsersListPage />} />
              <Route
                path="users/permissions"
                element={<PermissionsMatrixPage />}
              />
              <Route path="users/:id" element={<UserDetailPage />} />
              <Route path="documents" element={<DocumentsStub />} />
              <Route path="gre" element={<GreStub />} />
              <Route path="developers/api-keys" element={<ApiKeysStub />} />
              <Route path="developers/webhooks" element={<WebhooksStub />} />
              <Route path="developers/audit" element={<AuditStub />} />
              <Route
                path="developers/validations"
                element={<ValidationsStub />}
              />
            </Route>
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
