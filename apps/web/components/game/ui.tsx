"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-10 items-center justify-center rounded-control text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none [&_svg]:size-5",
        active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
        className,
      )}
    >
      {children}
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
