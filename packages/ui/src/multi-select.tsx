import { useId, useRef, useState, useEffect, type KeyboardEvent } from "react";
import { CloseIcon, ChevronDownIcon } from "./admin/icons";
import { Badge } from "./badge";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  text: string;
  disabled?: boolean;
}
export interface MultiSelectProps {
  id?: string;
  name?: string;
  label: string;
  options: readonly SelectOption[];
  value?: string[];
  defaultSelected?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  removeLabel?: (text: string) => string;
}
export function MultiSelect({
  id,
  name,
  label,
  options,
  value,
  defaultSelected = [],
  onChange,
  disabled,
  placeholder = "Seleccionar…",
  className,
  removeLabel = (text) => `Quitar ${text}`,
}: MultiSelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [internal, setInternal] = useState(defaultSelected);
  const selected = value ?? internal;
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const update = (next: string[]) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  const toggle = (option: string) =>
    update(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Enter", " "].includes(event.key))
      return;
    event.preventDefault();
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (open && enabled[focused]) toggle(enabled[focused].value);
      else {
        setOpen(!open);
        setFocused(enabled.length ? 0 : -1);
      }
      return;
    }
    setOpen(true);
    if (!enabled.length) return;
    setFocused(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabled.length - 1
          : (focused + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length,
    );
  };
  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      <label
        htmlFor={controlId}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
      >
        {label}
      </label>
      {name &&
        selected.map((item) => (
          <input key={item} type="hidden" name={name} value={item} disabled={disabled} />
        ))}
      <div
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900",
          disabled && "opacity-40",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {selected.map((item) => {
            const text = options.find((option) => option.value === item)?.text ?? item;
            return (
              <Badge key={item} color="light" size="md" className="gap-1 py-1">
                {text}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={removeLabel(text)}
                  onClick={() => {
                    update(selected.filter((entry) => entry !== item));
                    ref.current?.querySelector<HTMLButtonElement>('[role="combobox"]')?.focus();
                  }}
                  className="rounded-full text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              </Badge>
            );
          })}
          <button
            id={controlId}
            type="button"
            role="combobox"
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={open && !disabled}
            aria-controls={`${controlId}-list`}
            aria-activedescendant={
              open && enabled[focused]
                ? `${controlId}-option-${options.indexOf(enabled[focused])}`
                : undefined
            }
            disabled={disabled}
            onKeyDown={keyDown}
            onClick={() => {
              setOpen(!open);
              setFocused(-1);
            }}
            className="min-w-12 flex-1 text-start text-sm text-gray-400 outline-none"
          >
            {selected.length ? <span className="sr-only">{placeholder}</span> : placeholder}
          </button>
        </div>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "pointer-events-none size-5 shrink-0 text-gray-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </div>
      {open && !disabled && (
        <div
          id={`${controlId}-list`}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute start-0 top-full z-40 mt-2 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {options.map((option, optionIndex) => {
            const index = enabled.indexOf(option);
            return (
              <div
                key={option.value}
                id={`${controlId}-option-${optionIndex}`}
                role="option"
                aria-selected={selected.includes(option.value)}
                aria-disabled={option.disabled}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) toggle(option.value);
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white/90",
                  option.disabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5",
                  selected.includes(option.value) && "bg-brand-50 dark:bg-brand-500/15",
                  index === focused && "ring-2 ring-inset ring-brand-500",
                )}
              >
                {option.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
