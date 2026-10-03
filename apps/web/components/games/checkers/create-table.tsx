"use client";

import { useState } from "react";
import { CreateTableButton } from "@/components/table/create-button";
import { cn } from "@/lib/utils";

const CHOICES = [
  { value: 0, label: "Cheklovsiz" },
  { value: 30, label: "30 soniya" },
  { value: 60, label: "60 soniya" },
] as const;

/** Turn-limit choice plus the create button for the shashka landing page. */
export function CreateCheckersTable({ className }: { className?: string }) {
  const [turnSeconds, setTurnSeconds] = useState<0 | 30 | 60>(0);
  return (
    <div className={cn("flex flex-col items-center gap-3 md:items-start", className)}>
      <div
        role="radiogroup"
        aria-label="Har bir yurish uchun vaqt"
        className="inline-flex rounded-control border border-border bg-surface p-1 text-sm shadow-soft-sm"
      >
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={turnSeconds === choice.value}
            onClick={() => setTurnSeconds(choice.value)}
            className={cn(
              "min-h-10 rounded-[8px] px-3 font-medium transition-colors",
              turnSeconds === choice.value
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <CreateTableButton kind="checkers" options={{ turnSeconds }}>
        Shashka stolini yaratish
      </CreateTableButton>
    </div>
  );
}
