import type { OrgRole } from "../types";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Label } from "@/shared/ui/components/label";

export function RolesMultiSelect({
  roles,
  value,
  onChange,
  disabled,
}: {
  roles: OrgRole[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(code: string) {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Label>Roles</Label>
      <div className="grid gap-2 rounded-md border border-[var(--border)] p-3 sm:grid-cols-2">
        {roles.map((role) => (
          <label
            key={role.id}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={value.includes(role.code)}
              onChange={() => toggle(role.code)}
              disabled={disabled}
            />
            <span>
              <span className="font-medium">{role.name}</span>
              <span className="ml-1 text-[var(--muted-foreground)]">
                ({role.code})
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
