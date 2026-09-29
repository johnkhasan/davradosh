"use client";

import { PuzzleState, type PuzzleConfig } from "@puzzle/shared";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { PuzzleImage } from "@/lib/game/images";
import type { PuzzleView } from "@/lib/game/puzzle-view";
import { haptic, sounds } from "@/lib/game/sounds";

export interface PuzzleCanvasHandle {
  fit(): void;
  zoomBy(factor: number): void;
  arrange(): void;
}

export interface PuzzleProgress {
  connected: number;
  total: number;
  complete: boolean;
}

interface PuzzleCanvasProps {
  image: PuzzleImage;
  cols: number;
  rows: number;
  seed: number;
  ghost: boolean;
  edgesOnly: boolean;
  onProgress?: (progress: PuzzleProgress) => void;
  onComplete?: () => void;
  onFps?: (fps: number) => void;
  ref?: Ref<PuzzleCanvasHandle>;
  className?: string;
}

/**
 * Single-player puzzle: owns a PuzzleState and a PuzzleView and applies
 * every drop locally. The multiplayer version will route the same
 * callbacks through the game server instead.
 */
export function PuzzleCanvas({
  image,
  cols,
  rows,
  seed,
  ghost,
  edgesOnly,
  onProgress,
  onComplete,
  onFps,
  ref,
  className,
}: PuzzleCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<PuzzleView | null>(null);
  const stateRef = useRef<PuzzleState | null>(null);
  const callbacks = useRef({ onProgress, onComplete, onFps });
  const tools = useRef({ ghost, edgesOnly });
  useEffect(() => {
    callbacks.current = { onProgress, onComplete, onFps };
    tools.current = { ghost, edgesOnly };
  });

  useImperativeHandle(ref, () => ({
    fit: () => viewRef.current?.fitToContent(),
    zoomBy: (factor) => viewRef.current?.zoomBy(factor),
    arrange: () => {
      const state = stateRef.current;
      const view = viewRef.current;
      if (!state || !view) return;
      for (const id of state.arrange({ edgesFirst: true, seed }))
        view.syncGroup(id, { animate: true });
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let view: PuzzleView | null = null;

    const config: PuzzleConfig = {
      cols,
      rows,
      pieceWidth: image.width / cols,
      pieceHeight: image.height / rows,
    };
    const state = PuzzleState.create(config, seed);
    stateRef.current = state;

    const report = () => {
      const progress = {
        connected: state.connectedPieceCount(),
        total: state.pieceCount,
        complete: state.isComplete(),
      };
      callbacks.current.onProgress?.(progress);
      return progress;
    };
    report();

    // Pixi touches browser globals at import time, so it is loaded lazily on the client.
    void import("@/lib/game/puzzle-view").then(async ({ PuzzleView }) => {
      if (disposed) return;
      const created = await PuzzleView.create({
        host,
        image,
        state,
        seed,
        onGrab: () => {
          sounds.pick();
          return true;
        },
        onDrop: (groupId, x, y) => {
          state.moveGroup(groupId, x, y);
          const result = state.snap(groupId);
          if (!result) {
            sounds.drop();
            return;
          }
          created.applySnap(result);
          if (result.placed) sounds.place();
          else sounds.snap();
          haptic();
          const progress = report();
          if (progress.complete) {
            sounds.complete();
            callbacks.current.onComplete?.();
          }
        },
      });
      if (disposed) {
        created.destroy();
        return;
      }
      view = created;
      viewRef.current = created;
      created.setGhostVisible(tools.current.ghost);
      created.setEdgeFilter(tools.current.edgesOnly);
      if (process.env.NODE_ENV !== "production") {
        // Debug hook for manual testing and browser automation.
        (window as unknown as { __puzzle: unknown }).__puzzle = { state, view: created };
      }
    });

    const fpsTimer = window.setInterval(() => {
      if (view) callbacks.current.onFps?.(Math.round(view.fps));
    }, 500);

    return () => {
      disposed = true;
      window.clearInterval(fpsTimer);
      view?.destroy();
      viewRef.current = null;
      stateRef.current = null;
    };
  }, [image, cols, rows, seed]);

  useEffect(() => {
    viewRef.current?.setGhostVisible(ghost);
  }, [ghost]);

  useEffect(() => {
    viewRef.current?.setEdgeFilter(edgesOnly);
  }, [edgesOnly]);

  return <div ref={hostRef} className={className} />;
}
