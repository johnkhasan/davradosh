"use client";

import { Eye, Frame, LayoutGrid, Lightbulb, LocateFixed, Minus, Plus } from "lucide-react";
import type { RefObject } from "react";
import type { PuzzleCanvasHandle } from "@/components/game/puzzle-canvas";
import { ToolButton, TooltipPlacementProvider } from "@/components/game/ui";
import { cn } from "@/lib/utils";

/** Compact toolbar over a puzzle canvas: peek, edges, arrange, hint and view controls. */
export function CanvasTools({
  canvas,
  ghost,
  onGhost,
  edgesOnly,
  onEdgesOnly,
  hint = true,
  editing = true,
  className,
}: {
  canvas: RefObject<PuzzleCanvasHandle | null>;
  ghost: boolean;
  onGhost: (value: boolean) => void;
  edgesOnly: boolean;
  onEdgesOnly: (value: boolean) => void;
  hint?: boolean;
  /** False once the puzzle is done: only the view controls stay. */
  editing?: boolean;
  className?: string;
}) {
  return (
    <TooltipPlacementProvider value="top-end">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-card border border-border bg-surface/95 p-1 shadow-soft-md backdrop-blur",
          className,
        )}
      >
        {editing && (
          <>
            <ToolButton label="Asl rasm" active={ghost} onClick={() => onGhost(!ghost)}>
              <Eye />
            </ToolButton>
            <ToolButton
              label="Faqat chekka bo'laklar"
              active={edgesOnly}
              onClick={() => onEdgesOnly(!edgesOnly)}
            >
              <Frame />
            </ToolButton>
            <ToolButton label="Bo'laklarni tartiblash" onClick={() => canvas.current?.arrange()}>
              <LayoutGrid />
            </ToolButton>
            {hint && (
              <ToolButton label="Maslahat" onClick={() => canvas.current?.hint()}>
                <Lightbulb />
              </ToolButton>
            )}
          </>
        )}
        <ToolButton
          label="Kichiklashtirish"
          className="hidden sm:flex"
          onClick={() => canvas.current?.zoomBy(0.8)}
        >
          <Minus />
        </ToolButton>
        <ToolButton
          label="Kattalashtirish"
          className="hidden sm:flex"
          onClick={() => canvas.current?.zoomBy(1.25)}
        >
          <Plus />
        </ToolButton>
        <ToolButton label="Hammasini ko'rsatish" onClick={() => canvas.current?.fit()}>
          <LocateFixed />
        </ToolButton>
      </div>
    </TooltipPlacementProvider>
  );
}
