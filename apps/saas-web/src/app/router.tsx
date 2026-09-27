import { Navigate, Route, Routes } from "react-router-dom";

import { AuthLayout, LoginPage } from "./layouts/AuthLayout";
import { PanelShell } from "./layouts/PanelShell";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />

      <Route path="/auth" element={<AuthLayout />}>
        <Route index element={<Navigate to="login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <PlaceholderPage
              title="Auth"
              description="Ruta /auth/* placeholder."
            />
          }
        />
      </Route>

      <Route
        path="/platform"
        element={<PanelShell area="platform" title="Platform" />}
      >
        <Route
          index
          element={
            <PlaceholderPage
              title="Platform"
              description="Panel FACTOSYS (ops) — /platform/*"
            />
          }
        />
        <Route
          path="*"
          element={
            <PlaceholderPage
              title="Platform"
              description="Subruta /platform/* vacía."
            />
          }
        />
      </Route>

      <Route path="/app" element={<PanelShell area="app" title="App" />}>
        <Route
          index
          element={
            <PlaceholderPage
              title="App"
              description="Panel tenant — /app/*"
            />
          }
        />
        <Route
          path="*"
          element={
            <PlaceholderPage title="App" description="Subruta /app/* vacía." />
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <PlaceholderPage title="404" description="Ruta no encontrada." />
        }
      />
    </Routes>
  );
}
