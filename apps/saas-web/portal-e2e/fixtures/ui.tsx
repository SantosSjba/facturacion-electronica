import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Checkbox,
  ComponentCard,
  DatePicker,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Dropdown,
  DropdownItem,
  Dropzone,
  FileInput,
  Form,
  Input,
  Label,
  MultiSelect,
  PageHeader,
  Pagination,
  PhoneInput,
  Radio,
  Select,
  Switch,
  Table,
  THead,
  TBody,
  TH,
  TD,
  TR,
  Tabs,
  Textarea,
  LoadingState,
  type SkeletonVariant,
} from "@factosys/ui";
import "../../src/index.css";

function Catalog() {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState("sandbox");
  const [roles, setRoles] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("2026-10-08");
  const [file, setFile] = useState("");
  const [dropped, setDropped] = useState("");
  const [rejected, setRejected] = useState("");
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("general");
  const [page, setPage] = useState(1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Componentes TailAdmin"
        description="Catálogo de pruebas de @factosys/ui"
        actions={
          <Button
            variant="outline"
            onClick={() => document.documentElement.classList.toggle("dark")}
          >
            Cambiar tema
          </Button>
        }
      />
      <Breadcrumb items={[{ label: "Panel", href: "#" }, { label: "Componentes" }]} />
      <ComponentCard title="Formulario">
        <Form onSubmit={() => setSelected("guardado")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                name="company"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Razón social"
              />
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
                options={[
                  { value: "active", text: "Activo" },
                  { value: "inactive", text: "Inactivo" },
                ]}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invalid">RUC</Label>
              <Input id="invalid" error hint="RUC inválido" />
              <Input
                aria-label="Campo correcto"
                success
                hint="Dato válido"
                disabled
                defaultValue="Validado"
              />
            </div>
            <div>
              <Checkbox
                label="Aceptar condiciones"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <p data-testid="checked-value">{String(checked)}</p>
              <Checkbox label="Casilla deshabilitada" disabled />
            </div>
            <div>
              <Switch
                label="Webhook activo"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <p data-testid="switch-value">{String(enabled)}</p>
              <Switch label="Switch deshabilitado" disabled defaultChecked />
            </div>
            <div className="flex flex-wrap gap-3">
              <Radio
                name="environment"
                label="Sandbox"
                value="sandbox"
                checked={environment === "sandbox"}
                onChange={(event) => setEnvironment(event.target.value)}
              />
              <Radio
                name="environment"
                label="Producción"
                value="production"
                checked={environment === "production"}
                onChange={(event) => setEnvironment(event.target.value)}
              />
              <p data-testid="radio-value">{environment}</p>
            </div>
            <div>
              <MultiSelect
                label="Roles"
                value={roles}
                onChange={setRoles}
                options={[
                  { value: "admin", text: "Administrador" },
                  { value: "viewer", text: "Consulta" },
                  { value: "owner", text: "Dueño", disabled: true },
                ]}
              />
              <p data-testid="roles-value">{roles.join(",")}</p>
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <PhoneInput
                id="phone"
                countries={[
                  { code: "PE", label: "+51" },
                  { code: "CL", label: "+56" },
                ]}
                value={phone}
                onChange={setPhone}
              />
            </div>
            <div>
              <DatePicker
                label="Fecha"
                value={date}
                onValueChange={setDate}
                minDate="2026-10-01"
                maxDate="2026-10-31"
              />
              <Button variant="outline" onClick={() => setDate("2026-10-15")}>
                Cambiar fecha
              </Button>
            </div>
            <div>
              <Label htmlFor="file">Certificado</Label>
              <FileInput
                id="file"
                accept=".pfx"
                onChange={(event) => setFile(event.target.files?.[0]?.name ?? "")}
              />
              <p data-testid="file-value">{file}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Guardar</Button>
            <Button variant="outline" disabled>
              Acción deshabilitada
            </Button>
            <Button variant="primary" size="md">
              Primario
            </Button>
          </div>
        </Form>
      </ComponentCard>
      <ComponentCard title="Estados y acciones">
        <div className="flex flex-wrap gap-2">
          {(["primary", "success", "error", "warning", "info", "light", "dark"] as const).map(
            (color) => (
              <Badge key={color} color={color}>
                {color}
              </Badge>
            ),
          )}
          <Badge variant="solid" color="success">
            Solid
          </Badge>
          <Avatar alt="Ana" fallback="AN" status="online" statusLabel="Conectada" />
        </div>
        <Alert
          variant="success"
          title="Empresa registrada"
          message="La configuración se ha guardado."
        />
        <Alert variant="error" title="Error" message="Comprueba los datos." />
        <div className="relative flex gap-3">
          <Button onClick={() => setOpen(true)}>Abrir modal</Button>
          <div className="relative">
            <Button ref={triggerRef} aria-expanded={menu} onClick={() => setMenu(!menu)}>
              Acciones
            </Button>
            <Dropdown isOpen={menu} onClose={() => setMenu(false)} triggerRef={triggerRef}>
              <DropdownItem
                onItemClick={() => {
                  setSelected("editar");
                  setMenu(false);
                }}
              >
                Editar
              </DropdownItem>
              <DropdownItem
                onItemClick={() => {
                  setSelected("archivar");
                  setMenu(false);
                }}
              >
                Archivar
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
        <p data-testid="selected-value">{selected}</p>
        <Tabs
          label="Configuración"
          items={[
            { value: "general", label: "General" },
            { value: "security", label: "Seguridad" },
          ]}
          value={tab}
          onValueChange={setTab}
        >
          <p>{tab === "general" ? "Datos generales" : "Opciones de seguridad"}</p>
        </Tabs>
      </ComponentCard>
      <div data-testid="dropzone">
        <Dropzone
          title="Arrastra el certificado"
          description="Solo archivos PFX de hasta 1 KB"
          accept=".pfx"
          maxSize={1024}
          onFiles={(files) => setDropped(files[0]?.name ?? "")}
          onReject={(files) => setRejected(files[0]?.name ?? "")}
        />
        <p data-testid="drop-value">{dropped}</p>
        <p data-testid="reject-value">{rejected}</p>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Empresa</TH>
            <TH>Estado</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD label="Empresa">Empresa API SAC</TD>
            <TD label="Estado">
              <Badge color="success">Activa</Badge>
            </TD>
          </TR>
        </TBody>
      </Table>
      <Pagination page={page} pageCount={3} total={30} pageSize={10} onPageChange={setPage} />
      <Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Editar empresa">
        <DialogHeader title="Editar empresa" onClose={() => setOpen(false)} />
        <DialogBody>
          <Label htmlFor="modal-company">Nombre en modal</Label>
          <Input
            id="modal-company"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => setOpen(false)}>Confirmar</Button>
        </DialogFooter>
      </Dialog>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing UI catalogue root");
function LoadingCatalog() {
  const scenarios: SkeletonVariant[] = [
    "table",
    "cards",
    "detail",
    "form",
    "list",
    "documents",
    "dashboard",
    "page",
  ];
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <PageHeader
        title="Estados de carga"
        actions={
          <Button
            variant="outline"
            onClick={() => document.documentElement.classList.toggle("dark")}
          >
            Cambiar tema
          </Button>
        }
      />
      {scenarios.map((variant) => (
        <ComponentCard key={variant} title={variant}>
          <LoadingState
            variant={variant}
            label={`Cargando ${variant}`}
            rows={3}
            fields={4}
            count={3}
          />
        </ComponentCard>
      ))}
      <LoadingState variant="inline" label="Actualizando…" />
      <Button loading loadingLabel="Guardando…">
        Guardar
      </Button>
    </main>
  );
}
createRoot(root).render(
  new URLSearchParams(location.search).has("loading") ? <LoadingCatalog /> : <Catalog />,
);
