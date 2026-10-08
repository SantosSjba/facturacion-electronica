import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";
import { useEffect, useId, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { Label } from "./label";
import { Input, type InputProps } from "./input";
import { cn } from "./cn";

export interface DatePickerProps extends Omit<
  InputProps,
  "type" | "onChange" | "value" | "defaultValue"
> {
  mode?: "single" | "multiple" | "range" | "time";
  value?: string | string[];
  defaultDate?: string | string[];
  onValueChange?: (value: string, dates: Date[]) => void;
  label?: string;
  minDate?: string;
  maxDate?: string;
}
export function DatePicker({
  id,
  label,
  mode = "single",
  value,
  defaultDate,
  onValueChange,
  disabled,
  readOnly,
  minDate,
  maxDate,
  className,
  ...props
}: DatePickerProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<flatpickr.Instance | null>(null);
  const callbackRef = useRef(onValueChange);
  const initialRef = useRef(value ?? defaultDate);
  useEffect(() => {
    callbackRef.current = onValueChange;
  }, [onValueChange]);
  useEffect(() => {
    if (!inputRef.current || disabled || readOnly) return;
    const picker = flatpickr(inputRef.current, {
      locale: Spanish,
      mode: mode === "time" ? "single" : mode,
      enableTime: mode === "time",
      noCalendar: mode === "time",
      time_24hr: true,
      dateFormat: mode === "time" ? "H:i" : "Y-m-d",
      defaultDate: initialRef.current,
      monthSelectorType: "static",
      disableMobile: true,
      appendTo: inputRef.current.parentElement ?? undefined,
      onChange: (dates, formatted) => {
        initialRef.current = formatted;
        callbackRef.current?.(formatted, dates);
      },
    });
    pickerRef.current = picker;
    return () => {
      picker.destroy();
      pickerRef.current = null;
    };
  }, [mode, disabled, readOnly]);
  useEffect(() => {
    pickerRef.current?.set("minDate", minDate);
    pickerRef.current?.set("maxDate", maxDate);
  }, [minDate, maxDate, mode, disabled, readOnly]);
  const serializedValue = value === undefined ? undefined : JSON.stringify(value);
  useEffect(() => {
    if (serializedValue !== undefined) {
      const next = JSON.parse(serializedValue) as string | string[];
      initialRef.current = next;
      pickerRef.current?.setDate(next, false);
      if (!pickerRef.current && inputRef.current)
        inputRef.current.value = Array.isArray(next) ? next.join(", ") : next;
    }
  }, [serializedValue, mode, disabled, readOnly]);
  return (
    <div>
      {label && <Label htmlFor={id ?? generatedId}>{label}</Label>}
      <div className="relative">
        <Input
          {...props}
          id={id ?? generatedId}
          ref={inputRef}
          disabled={disabled}
          readOnly={readOnly}
          defaultValue={
            Array.isArray(initialRef.current) ? initialRef.current.join(", ") : initialRef.current
          }
          className={cn("pe-10", className)}
        />
        <CalendarDays
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-5.5 size-5 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        />
      </div>
    </div>
  );
}
