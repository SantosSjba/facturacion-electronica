# @factosys/ui

Componentes React compartidos por Factosys. La estructura administrativa está adaptada de `tmp/tailadmin-react`: layout, sidebar, cabecera, menús desplegables, tema y utilidades CSS. Licencia: [TAILADMIN-LICENSE.md](./TAILADMIN-LICENSE.md).

## Paneles administrativos

```tsx
import { AdminLayout, AdminSidebar, AdminHeader } from "@factosys/ui";
```

`AdminLayout` administra el contexto del sidebar y compone `sidebar`, `header`, `children`, `beforeHeader` y `overlay`. La estructura usa el breakpoint `xl` (1280 px), sidebar de 290/90 px, expansión al pasar el cursor y drawer móvil.

`AdminSidebar` recibe `groups`, `pathname`, `homeHref`, `logo`, `compactLogo` y `LinkComponent`. Las rutas, permisos y etiquetas pertenecen a la aplicación consumidora. Admite submenús con animación y un widget opcional.

`AdminHeader` recibe slots de búsqueda y acciones. `AdminSearch`, `AdminUserDropdown`, `AdminNotificationDropdown` y `AdminThemeToggle` son reutilizables y reciben datos y callbacks, sin depender de la API, JWT, roles ni un router específico. `LinkComponent` adapta `href` al router de cada aplicación.

Las etiquetas visibles se pasan mediante propiedades. La marca Factosys y los datos reales sustituyen los ejemplos de TailAdmin.

En el CSS del consumidor:

```css
@import "tailwindcss";
@import "@factosys/ui/admin.css";
@source "../../../packages/ui/src";
```

La ruta de `@source` se ajusta a la ubicación del CSS consumidor. `admin.css` contiene los tokens y utilidades centrales de la plantilla; las pantallas funcionales siguen perteneciendo a la aplicación.

El paquete es interno al monorepo y exporta directamente `src/index.ts`. Vite procesa sus componentes y refleja los cambios en desarrollo sin compilar previamente `packages/ui` ni mantener un proceso de watch separado. El comando `pnpm --filter @factosys/ui build` sigue disponible para comprobar sus tipos y generar declaraciones.
