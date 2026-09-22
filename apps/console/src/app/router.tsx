import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { CompaniesStub } from "@/modules/companies/pages/CompaniesStub";
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
              <Route path="companies" element={<CompaniesStub />} />
              <Route path="users" element={<UsersListPage />} />
              <Route path="users/permissions" element={<PermissionsMatrixPage />} />
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
