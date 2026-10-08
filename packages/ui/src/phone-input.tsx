import { useState, useId } from "react";
import { Input, type InputProps } from "./input";
import { Select } from "./select";
import { cn } from "./cn";

export interface PhoneCountry {
  code: string;
  label: string;
}
export interface PhoneInputProps extends Omit<InputProps, "type" | "onChange"> {
  countries: readonly PhoneCountry[];
  country?: string;
  defaultCountry?: string;
  onCountryChange?: (country: string) => void;
  onChange?: (phoneNumber: string) => void;
  selectPosition?: "start" | "end";
  countryLabel?: string;
}
export function PhoneInput({
  countries,
  country,
  defaultCountry,
  onCountryChange,
  onChange,
  selectPosition = "start",
  countryLabel = "País",
  className,
  disabled,
  ...props
}: PhoneInputProps) {
  const [internalCountry, setCountry] = useState(defaultCountry ?? countries[0]?.code ?? "");
  const countryId = useId();
  const selection = (
    <div className="w-24 shrink-0">
      <Select
        id={countryId}
        aria-label={countryLabel}
        disabled={disabled}
        value={country ?? internalCountry}
        onChange={(event) => {
          if (country === undefined) setCountry(event.target.value);
          onCountryChange?.(event.target.value);
        }}
        className={cn(
          "border-0 shadow-none",
          selectPosition === "start"
            ? "border-e border-gray-200 rounded-e-none dark:border-gray-800"
            : "border-s border-gray-200 rounded-s-none dark:border-gray-800",
        )}
      >
        {countries.map((item) => (
          <option key={item.code} value={item.code} title={item.label}>
            {item.code}
          </option>
        ))}
      </Select>
    </div>
  );
  return (
    <div
      className={cn(
        "flex rounded-lg border border-gray-300 shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900",
        className,
      )}
    >
      {selectPosition === "start" && selection}
      <div className="min-w-0 flex-1">
        <Input
          {...props}
          disabled={disabled}
          type="tel"
          onChange={(event) => onChange?.(event.target.value)}
          className="border-0 shadow-none focus:ring-0"
        />
      </div>
      {selectPosition === "end" && selection}
    </div>
  );
}
