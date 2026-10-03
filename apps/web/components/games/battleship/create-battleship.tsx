"use client";

import {
  BATTLESHIP_DEFAULT_TURN_SECONDS,
  BATTLESHIP_TURN_SECONDS,
} from "@puzzle/shared/games/battleship";
import { useState } from "react";
import { CreateTableButton } from "@/components/table/create-button";
import { cn } from "@/lib/utils";

type TurnSeconds = (typeof BATTLESHIP_TURN_SECONDS)[number];

/** Turn-time choice plus the create button for the landing page. */
export function CreateBattleship({ compact = false }: { compact?: boolean }) {
  const [turnSeconds, setTurnSeconds] = useState<TurnSeconds>(BATTLESHIP_DEFAULT_TURN_SECONDS);
  return (
    <div className={cn("flex flex-col items-center gap-3", !compact && "md:items-start")}>
      <CreateTableButton kind="battleship" options={{ turnSeconds }}>
        🚢 Stol yaratish
      </CreateTableButton>
      <div
        role="radiogroup"
        aria-label="Har o'q uchun vaqt"
        className="flex items-center gap-1 rounded-control border border-border bg-surface p-1 text-sm"
      >
        <span className="px-2 text-muted">O&apos;q vaqti:</span>
        {BATTLESHIP_TURN_SECONDS.filter((s) => s > 0)
          .concat(0)
          .map((seconds) => (
            <button
              key={seconds}
              type="button"
              role="radio"
              aria-checked={turnSeconds === seconds}
              aria-label={seconds === 0 ? "Vaqt cheklovsiz" : `${seconds} soniya`}
              onClick={() => setTurnSeconds(seconds)}
              className={cn(
                "min-h-9 rounded-[9px] px-2.5 font-medium transition-colors",
                turnSeconds === seconds
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-surface-muted",
              )}
            >
              {seconds === 0 ? "∞" : `${seconds}s`}
            </button>
          ))}
      </div>
    </div>
  );
}
