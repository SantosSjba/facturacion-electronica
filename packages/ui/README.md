# @factosys/ui

Componentes React compartidos por Factosys, adaptados de `tmp/tailadmin-react`. Incluyen la estructura administrativa, los componentes visuales y los controles de formulario. Licencia: [TAILADMIN-LICENSE.md](./TAILADMIN-LICENSE.md).

## Catálogo reutilizable

| Familia                | Exports                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formularios            | `Form`, `Label`, `Input`, `Textarea` / `TextArea`, `Select`, `MultiSelect`, `Checkbox`, `Radio`, `RadioSm`, `Switch`, `FileInput`, `DatePicker`, `PhoneInput`, `Dropzone` / `DropZone` |
| Acciones y estados     | `Button`, `ButtonLabel`, `Badge`, `Avatar`, `Alert`, `Dropdown`, `DropdownItem`                                                                                                        |
| Superficies            | `Card`, `CardTitle`, `ComponentCard`, `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, `Modal`                                                                                  |
| Tablas y navegación    | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `THead`, `TBody`, `TR`, `TH`, `TD`, `Pagination`, `CursorPagination`, `Tabs`, `TabNavigation`, `Breadcrumb`              |
| Composición de páginas | `PageHeader`, `FilterPanel`, `FieldError`, `FieldHint`, `LoadingState`, `PageSpinner`, `EmptyState`, `ErrorState`, `MutedText`, `TextLink`, `TextAnchor`                               |
| Imágenes y vídeos      | `ResponsiveImage`, `ImageGrid`, `TwoColumnImageGrid`, `ThreeColumnImageGrid`, `AspectRatioVideo`, `SixteenIsToNine`, `TwentyOneIsToNine`, `FourIsToThree`, `OneIsToOne`                |

Los componentes de `ui/` y `form/` de la plantilla se generalizaron para recibir datos reales, atributos HTML, refs y callbacks. Los ejemplos de ecommerce, gráficos con datos de muestra, calendario y pantallas completas de TailAdmin no forman parte del catálogo de controles: no se incorporan como funcionalidades del producto.

Los paneles importan directamente desde `@factosys/ui`. Los archivos antiguos en `apps/saas-web/src/shared/ui` solo reexportan componentes para mantener compatibilidad; no contienen otra implementación. Allí permanecen el adaptador de React Router, el tema de la aplicación y la configuración de Sonner.

```tsx
import { Badge, Button, Input, Label, Select } from "@factosys/ui";

<Label htmlFor="ruc">RUC</Label>
<Input id="ruc" name="ruc" required error={hasError} hint={errorMessage} />
<Select aria-label="Ambiente" options={environments} value={environment}
  onChange={(event) => setEnvironment(event.target.value)} />
<Badge color="success" variant="solid">Activa</Badge>
<Button type="submit" disabled={saving}>Guardar</Button>
```

`Input`, `Textarea` y `Select` admiten `error`, `success` y `hint`. Conservan eventos nativos y asocian el mensaje al control mediante `aria-describedby`. `Checkbox`, `Radio` y `Switch` funcionan controlados o con `defaultChecked`; usan eventos nativos `onChange`. `MultiSelect` recibe `value` / `defaultSelected` y devuelve un array de valores en `onChange`; admite teclado y opciones deshabilitadas.

`DatePicker` usa Flatpickr, como TailAdmin, con textos en español, modos `single`, `multiple`, `range` y `time`; admite `value`, `defaultDate`, `minDate`, `maxDate` y `onValueChange(formatted, dates)`. Los controles temporales nativos siguen disponibles con `Input type="date"` / `type="time"`.

`PhoneInput` recibe países y separa `onCountryChange` de `onChange` para que cambiar el país no borre el número. `Dropzone` recibe `accept`, `maxSize`, `multiple`, `onFiles` y `onReject`: valida tanto selección como arrastre. La aplicación decide cómo subir los archivos.

`Dialog` se monta en un portal, bloquea el scroll de fondo, mantiene el foco al editar, contiene la navegación con Tab y restaura el foco al cerrar. `Modal` ofrece la API `isOpen` de TailAdmin sobre el mismo mecanismo. `Dropdown` recibe `triggerRef` para cerrar fuera / Escape sin interferir con su botón. `Tabs` usa selección controlada y navegación por flechas. Las tablas conservan las tarjetas móviles del portal y los nombres de TailAdmin.

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

## Skeletons y cargas

`Skeleton` es el bloque visual básico. `TableSkeleton`, `CardsSkeleton`, `DetailSkeleton`, `FormSkeleton`, `ListSkeleton`, `DocumentsSkeleton`, `DashboardSkeleton` y `PageSkeleton` componen las formas de cada escenario. Admiten `label` y `className`; según el escenario se configuran `rows`, `columns`, `fields`, `count`, `showHeader` y `contained`.

```tsx
if (query.isLoading) return <TableSkeleton label="Cargando empresas…" columns={6} rows={5} />;
// También se puede usar la API de los paneles:
<LoadingState variant="form" fields={8} label="Cargando empresa…" />
<Button loading={saving} loadingLabel="Guardando…" type="submit">Guardar</Button>
```

Cada región anuncia una sola etiqueta mediante `role="status"`, `aria-live` y `aria-busy`. Las formas son decorativas y no crean inputs, botones ni datos ficticios accesibles. Las tablas reservan filas en escritorio y tarjetas en móvil. Los fondos se adaptan a claro/oscuro; el pulso y el spinner respetan `prefers-reduced-motion`.

Los skeletons se usan durante la carga inicial (`isLoading`). Un refetch con datos existentes conserva el contenido. Las mutaciones usan `Spinner` (decorativo por defecto, o con `label` para anunciarlo) y `Button loading`; `LoadingState variant="inline"` sirve para actualizar una sección sin reemplazarla. `PageSpinner` queda como alias de compatibilidad de `PageSkeleton` para sesión y guards.

`SkeletonRegion` y `SkeletonContent` permiten composiciones nuevas sin duplicar la accesibilidad ni estilos. Los componentes se conectan a estados de la aplicación; no incluyen temporizadores ni llamadas a la API.

## Verificación

`pnpm --filter saas-web test:ui` abre un catálogo de pruebas (fuera del bundle de producción) y comprueba formularios, archivos, fechas, teclado, foco y diseño en 1440/390 px, en claro y oscuro. Las capturas quedan en `apps/saas-web/test-results`. `pnpm --filter saas-web test:portal` comprueba los flujos de los paneles con fixtures HTTP.
