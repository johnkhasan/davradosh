"use client";

import { Check, ChevronDown, ChevronUp, Maximize, Minimize } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Where ToolButton tooltips open, set by the toolbar around them:
 * "top-start"/"top-end" keep tooltips of edge toolbars on screen,
 * "side" opens them to the right of a vertical toolbar (sm+) and above it on phones.
 */
export type TooltipPlacement = "top" | "top-start" | "top-end" | "side";
const TooltipPlacementContext = createContext<TooltipPlacement>("top");
export const TooltipPlacementProvider = TooltipPlacementContext.Provider;

const TOOLTIP_PLACEMENT: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2 origin-bottom",
  "top-start": "bottom-full left-0 mb-2 origin-bottom-left",
  "top-end": "bottom-full right-0 mb-2 origin-bottom-right",
  side: "bottom-full left-0 mb-2 origin-bottom-left sm:top-1/2 sm:bottom-auto sm:left-full sm:mb-0 sm:ml-3 sm:-translate-y-1/2 sm:origin-left",
};

export function ToolButton({
  label,
  active,
  onClick,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  const placement = useContext(TooltipPlacementContext);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group/tip relative flex size-10 items-center pointer-coarse:size-11 justify-center rounded-control text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none [&_svg]:size-5",
        active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
        className,
      )}
    >
      {children}
      {/* Custom tooltip instead of `title`: styled, and it appears after 150ms rather than ~1s. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-50 scale-95 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-soft-md transition duration-150",
          "group-hover/tip:scale-100 group-hover/tip:opacity-100 group-hover/tip:delay-150 group-focus-visible/tip:scale-100 group-focus-visible/tip:opacity-100",
          "motion-reduce:scale-100 motion-reduce:transition-opacity",
          TOOLTIP_PLACEMENT[placement],
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function ProgressBar({ connected, total }: { connected: number; total: number }) {
  const percent = total ? Math.round((connected / total) * 100) : 0;
  return (
    <div className="flex min-w-40 flex-1 items-center gap-3 sm:max-w-sm">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Yig'ilgan bo'laklar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-snap transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-right text-sm whitespace-nowrap text-muted tabular-nums">
        {connected}/{total} · {percent}%
      </span>
    </div>
  );
}

export const TABLES = {
  felt: "Kigiz",
  wood: "Yog'och",
  dark: "Qorong'i",
  dots: "Nuqtali",
} as const;
export type Table = keyof typeof TABLES;

export function tableClass(table: Table) {
  return `table-${table}`;
}

/** Table background picker: opens upwards with a live swatch of each surface. */
export function TablePicker({
  value,
  onChange,
  className,
}: {
  value: Table;
  onChange: (table: Table) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Stol foni: ${TABLES[value]}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-control pr-2 pl-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          open && "bg-surface-muted text-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn("size-7 rounded-lg ring-1 ring-black/10 ring-inset", tableClass(value))}
        />
        {TABLES[value]}
        <ChevronUp
          aria-hidden
          className={cn("size-4 text-muted transition-transform", !open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Stol foni"
          className="absolute right-0 bottom-full mb-3 w-52 origin-bottom-right animate-[pop_150ms_ease-out] rounded-card border border-border bg-surface p-1.5 shadow-soft-lg"
        >
          {(Object.entries(TABLES) as [Table, string][]).map(([key, label]) => {
            const selected = key === value;
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none",
                    selected && "font-semibold text-primary",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-8 shrink-0 rounded-lg ring-1 ring-black/10 ring-inset",
                      tableClass(key),
                      selected && "ring-2 ring-primary",
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {selected && <Check aria-hidden className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Styled replacement for a native <select>: opens downwards, arrow keys move
 * between options, Enter or a click picks one, Escape closes.
 */
export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Accessible name, e.g. "Bo'laklar soni". */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    // Focus the selected option so arrow keys start from it.
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => items[(to + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") setOpen(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-control border border-border bg-surface pr-2 pl-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          open && "bg-surface-muted",
        )}
      >
        {current?.label}
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKey}
          className="absolute top-full right-0 z-50 mt-2 min-w-full origin-top-right animate-[pop_150ms_ease-out] rounded-card border border-border bg-surface p-1.5 shadow-soft-lg"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  onChange(option.value);
                  close();
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control py-2 pr-3 pl-2 text-sm whitespace-nowrap transition-colors outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
                  selected && "font-semibold text-primary",
                )}
              >
                <Check aria-hidden className={cn("size-4 shrink-0", !selected && "invisible")} />
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => void };

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
  };
}

const isFullscreen = () => {
  const doc = document as FullscreenDoc;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
};

/** Browser fullscreen state; `supported` is false where the API is missing (e.g. iPhone Safari). */
export function useFullscreen() {
  const active = useSyncExternalStore(subscribeFullscreen, isFullscreen, () => false);
  const supported = useSyncExternalStore(
    () => () => {},
    () => {
      const el = document.documentElement as FullscreenEl;
      return Boolean(el.requestFullscreen ?? el.webkitRequestFullscreen);
    },
    () => false,
  );
  const toggle = () => {
    const doc = document as FullscreenDoc;
    const el = document.documentElement as FullscreenEl;
    if (isFullscreen()) {
      if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => {});
    } else {
      el.webkitRequestFullscreen?.();
    }
  };
  return { active, supported, toggle };
}

/** Real browser fullscreen toggle; hidden where the API is missing. */
export function FullscreenButton({ className }: { className?: string }) {
  const { active, supported, toggle } = useFullscreen();
  if (!supported) return null;
  return (
    <ToolButton
      label={active ? "To'liq ekrandan chiqish" : "To'liq ekran"}
      active={active}
      onClick={toggle}
      className={className}
    >
      {active ? <Minimize /> : <Maximize />}
    </ToolButton>
  );
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours} soat ${minutes} daqiqa`;
  return minutes ? `${minutes} daqiqa ${seconds} soniya` : `${seconds} soniya`;
}

export function Avatar({
  name,
  color,
  avatar,
  size = "md",
  dimmed,
  ring,
}: {
  name: string;
  color: string;
  avatar: string;
  size?: "sm" | "md" | "lg";
  dimmed?: boolean;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-surface select-none",
        size === "sm" && "size-7 text-sm",
        size === "md" && "size-9 text-lg",
        size === "lg" && "size-14 text-3xl",
        dimmed && "opacity-40 grayscale",
      )}
      style={{ backgroundColor: color, boxShadow: ring ? `0 0 0 2px ${color}` : undefined }}
    >
      <span aria-hidden>{avatar}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}
