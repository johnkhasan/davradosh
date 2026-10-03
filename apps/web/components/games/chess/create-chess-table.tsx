"use client";

import type { ChessOptions } from "@puzzle/shared/games/chess";
import { Timer } from "lucide-react";
import { useState } from "react";
import { CreateTableButton } from "@/components/table/create-button";
import { cn } from "@/lib/utils";
import { timeControlText } from "./text";

const PRESETS: ChessOptions[] = [
  { minutes: 3, increment: 0 },
  { minutes: 3, increment: 2 },
  { minutes: 5, increment: 0 },
  { minutes: 5, increment: 3 },
  { minutes: 10, increment: 0 },
  { minutes: 10, increment: 5 },
  { minutes: 15, increment: 10 },
  { minutes: 30, increment: 0 },
  { minutes: 0, increment: 0 },
];

const GROUPS: Record<number, string> = {
  3: "Blits",
  5: "Blits",
  10: "Rapid",
  15: "Rapid",
  30: "Rapid",
};

/** Time control picker plus the create button for the landing page. */
export function CreateChessTable({ className }: { className?: string }) {
  const [choice, setChoice] = useState(4);
  const options = PRESETS[choice]!;
  return (
    <div className={cn("flex flex-col items-center gap-4 md:items-start", className)}>
      <fieldset className="w-full max-w-md">
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Timer className="size-4" aria-hidden /> Vaqt nazorati
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset, i) => (
            <button
              key={`${preset.minutes}-${preset.increment}`}
              type="button"
              aria-pressed={i === choice}
              onClick={() => setChoice(i)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-control border px-2 py-1.5 transition-colors",
                i === choice
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              <span className="font-semibold tabular-nums">
                {preset.minutes === 0 ? "Soatsiz" : `${preset.minutes} + ${preset.increment}`}
              </span>
              <span className="text-[11px] text-muted">
                {preset.minutes === 0 ? "erkin" : GROUPS[preset.minutes]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <CreateTableButton kind="chess" options={options}>
        Stol yaratish · {timeControlText(options.minutes, options.increment)}
      </CreateTableButton>
    </div>
  );
}
