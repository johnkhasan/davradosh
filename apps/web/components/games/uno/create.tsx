"use client";

import { UNO_TURN_SECONDS, type UnoOptions, type UnoTurnSeconds } from "@puzzle/shared/games/uno";
import { useState } from "react";
import { CreateTableButton } from "@/components/table/create-button";
import { cn } from "@/lib/utils";

/** Room options (turn length, stacking) and the create button for the Uno page. */
export function UnoCreate({ compact = false }: { compact?: boolean }) {
  const [turnSeconds, setTurnSeconds] = useState<UnoTurnSeconds>(30);
  const [stacking, setStacking] = useState(false);
  const options: UnoOptions = { turnSeconds, stacking };

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        compact ? "items-center" : "items-center md:items-start",
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <div
          role="radiogroup"
          aria-label="Navbat vaqti"
          className="flex items-center gap-1 rounded-control border border-border bg-surface p-1"
        >
          <span className="px-2 text-muted">Navbat</span>
          {UNO_TURN_SECONDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={turnSeconds === s}
              onClick={() => setTurnSeconds(s)}
              className={cn(
                "min-h-9 rounded-[calc(var(--radius-control)-4px)] px-3 font-semibold",
                turnSeconds === s ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted",
              )}
            >
              {s} s
            </button>
          ))}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3">
          <input
            type="checkbox"
            checked={stacking}
            onChange={(e) => setStacking(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
          +2 / +4 ustiga qo&apos;yish
        </label>
      </div>
      <CreateTableButton kind="uno" options={options}>
        Stol yaratish
      </CreateTableButton>
    </div>
  );
}
