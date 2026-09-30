"use client";

import { REACTION_EMOJIS, type ReactionEmoji } from "@puzzle/shared";
import { Check, Settings, SmilePlus, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ReactionButton } from "./reactions";
import { TABLES, tableClass, ToolButton, TooltipPlacementProvider, type Table } from "./ui";

type Popover = "menu" | "reactions" | null;

/** Lets menu actions close the menu after running. */
const CloseMenuContext = createContext<() => void>(() => {});

/**
 * Phones: one bar at the bottom centre with the everyday tools; the rest sits
 * in a settings menu, and reactions open as a row above the bar. Hidden from sm up,
 * where the side and corner toolbars have room.
 */
export function MobileDock({
  children,
  menu,
  onReact,
  className,
}: {
  /** The main buttons, shown in the bar itself. */
  children: ReactNode;
  /** Menu rows (MenuToggle, MenuAction, MenuTables). */
  menu: ReactNode;
  /** Adds the reactions button when set. */
  onReact?: (emoji: ReactionEmoji) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<Popover>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (popover: Exclude<Popover, null>) =>
    setOpen((current) => (current === popover ? null : popover));

  return (
    <div
      ref={rootRef}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden",
        className,
      )}
    >
      {open === "reactions" && onReact && (
        // Stays open for several taps in a row; a tap elsewhere closes it.
        <div
          role="toolbar"
          aria-label="Reaksiyalar"
          className="pointer-events-auto flex w-full max-w-sm justify-between rounded-full border border-border bg-surface/95 p-1 shadow-soft-lg backdrop-blur motion-safe:animate-[pop_150ms_ease-out]"
        >
          {REACTION_EMOJIS.map((emoji, index) => (
            <ReactionButton key={emoji} emoji={emoji} index={index} onReact={onReact} size="lg" />
          ))}
        </div>
      )}

      {open === "menu" && (
        <div
          role="menu"
          aria-label="Sozlamalar"
          className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-lg backdrop-blur motion-safe:animate-[pop_150ms_ease-out]"
        >
          <CloseMenuContext.Provider value={() => setOpen(null)}>{menu}</CloseMenuContext.Provider>
        </div>
      )}

      <TooltipPlacementProvider value="top">
        <nav
          aria-label="Asboblar"
          className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-border bg-surface/95 px-1.5 py-1 shadow-soft-md backdrop-blur"
        >
          {children}
          {onReact && (
            <ToolButton
              label={open === "reactions" ? "Reaksiyalarni yopish" : "Reaksiya yuborish"}
              active={open === "reactions"}
              onClick={() => toggle("reactions")}
              className="rounded-full"
            >
              {open === "reactions" ? <X /> : <SmilePlus />}
            </ToolButton>
          )}
          <ToolButton
            label="Sozlamalar"
            active={open === "menu"}
            onClick={() => toggle("menu")}
            className="rounded-full"
          >
            {open === "menu" ? <X /> : <Settings />}
          </ToolButton>
        </nav>
      </TooltipPlacementProvider>
    </div>
  );
}

const ROW =
  "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] font-medium transition-colors active:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted";

/** An on/off row with a switch; the menu stays open. */
export function MenuToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={ROW}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-muted ring-1 ring-border ring-inset",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-soft-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

/** A one-off action; the menu closes after it runs. */
export function MenuAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  const close = useContext(CloseMenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        onClick();
      }}
      className={ROW}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </button>
  );
}

/** Table background swatches in one row. */
export function MenuTables({
  value,
  onChange,
}: {
  value: Table;
  onChange: (table: Table) => void;
}) {
  return (
    <div className="mt-1 border-t border-border px-3 pt-2.5 pb-1.5">
      <p className="text-xs font-medium text-muted">Stol foni</p>
      <div role="radiogroup" aria-label="Stol foni" className="mt-2 grid grid-cols-4 gap-2">
        {(Object.entries(TABLES) as [Table, string][]).map(([key, label]) => {
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className="flex flex-col items-center gap-1 text-xs"
            >
              <span
                aria-hidden
                className={cn(
                  "relative flex h-10 w-full items-center justify-center rounded-lg ring-1 ring-black/10 ring-inset",
                  tableClass(key),
                  selected && "ring-2 ring-primary",
                )}
              >
                {selected && <Check className="size-4 text-white drop-shadow" />}
              </span>
              <span className={cn(selected ? "font-semibold text-primary" : "text-muted")}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
