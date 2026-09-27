import type { OrgRole } from "../types";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Label } from "@/shared/ui/components/label";
import { MutedText } from "@/shared/ui/components/muted-text";
import { cn } from "@/shared/ui/utils";

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
      <div className="grid grid-cols-1 gap-2">
        {roles.map((role) => {
          const checked = value.includes(role.code);
          return (
            <label
              key={role.id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors",
                checked
                  ? "border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox
                className="mt-0.5"
                checked={checked}
                onChange={() => toggle(role.code)}
                disabled={disabled}
              />
              <span className="min-w-0">
                <span className="block font-medium text-gray-800 dark:text-white/90">
                  {role.name}
                </span>
                <MutedText as="span" className="mt-0.5 block text-theme-xs">
                  {role.code}
                  {role.description ? ` · ${role.description}` : ""}
                </MutedText>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
