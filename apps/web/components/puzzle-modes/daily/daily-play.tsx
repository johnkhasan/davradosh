"use client";

import { gridForPieceCount, type PuzzleSnapshot } from "@puzzle/shared";
import { Timer, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PuzzleCanvas, type PuzzleCanvasHandle } from "@/components/game/puzzle-canvas";
import { ProgressBar } from "@/components/game/ui";
import { PuzzleLoader } from "@/components/puzzle-loader";
import type { DailyPuzzleDTO } from "@/lib/api";
import { CanvasTools } from "../canvas-tools";
import { clearModeSave, formatClock, loadModeSave, pruneModeSaves, writeModeSave } from "../save";
import { useNow } from "../use-now";
import { usePuzzleImage } from "../use-puzzle-image";

/** Full-screen solving view of the daily puzzle, with a running clock. */
export function DailyPlay({
  puzzle,
  finishedMs,
  onComplete,
  onExit,
}: {
  puzzle: DailyPuzzleDTO;
  /** Set once solved: the clock stops and a small result card shows. */
  finishedMs: number | null;
  onComplete: (ms: number) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<PuzzleCanvasHandle>(null);
  const { image, failed } = usePuzzleImage(puzzle.image);
  const grid = gridForPieceCount(puzzle.pieces, puzzle.image.width / puzzle.image.height);
  const saveKey = `daily:${puzzle.day}`;
  const [saved] = useState(() => {
    pruneModeSaves("daily:", saveKey);
    return loadModeSave(saveKey, puzzle.seed, grid.cols * grid.rows);
  });
  const [startedAt] = useState(() => Date.now() - (saved?.elapsedMs ?? 0));
  const [ghost, setGhost] = useState(false);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [progress, setProgress] = useState({ connected: 0, total: 0 });
  const [cardOpen, setCardOpen] = useState(true);
  const now = useNow(500, finishedMs === null);
  const done = finishedMs !== null;

  const latest = useRef<{ snapshot: PuzzleSnapshot | null; done: boolean }>({
    snapshot: null,
    done,
  });
  const persistRef = useRef(() => {});
  // Layout effect: current before the canvas reports its first layout.
  useLayoutEffect(() => {
    latest.current.done = done;
    persistRef.current = () => {
      const { snapshot, done } = latest.current;
      if (!snapshot || done) return;
      writeModeSave(saveKey, {
        seed: puzzle.seed,
        snapshot,
        elapsedMs: Date.now() - startedAt,
      });
    };
  });
  const persist = useCallback(() => persistRef.current(), []);

  useEffect(() => {
    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      persist();
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  const complete = useCallback(() => {
    latest.current.done = true;
    clearModeSave(saveKey);
    onComplete(Date.now() - startedAt);
  }, [onComplete, saveKey, startedAt]);

  const elapsed = finishedMs ?? now - startedAt;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      <header className="z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur">
        <span className="font-display text-lg font-bold select-none">🗓️ Kunlik puzzle</span>
        <span
          className={
            done
              ? "flex items-center gap-1.5 rounded-full bg-snap px-3 py-1 font-mono text-sm font-semibold text-white tabular-nums"
              : "flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 font-mono text-sm font-semibold text-primary tabular-nums"
          }
        >
          {done ? (
            <Trophy className="size-4" aria-hidden />
          ) : (
            <Timer className="size-4" aria-hidden />
          )}
          {formatClock(elapsed)}
        </span>
        <div className="order-last flex w-full sm:order-none sm:ml-auto sm:w-auto sm:flex-1 sm:justify-end">
          <ProgressBar connected={progress.connected} total={progress.total} />
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label={done ? "Natijalarga qaytish" : "Chiqish (natija saqlanadi)"}
          className="ml-auto flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground sm:ml-0"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="table-felt relative flex-1">
        {!image && !failed && <PuzzleLoader variant="overlay" label="Rasm yuklanmoqda" />}
        {failed && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
            Rasmni yuklab bo&apos;lmadi. Sahifani yangilab ko&apos;ring.
          </p>
        )}
        {image && (
          <PuzzleCanvas
            ref={canvasRef}
            image={image}
            cols={grid.cols}
            rows={grid.rows}
            seed={puzzle.seed}
            ghost={ghost}
            edgesOnly={edgesOnly}
            initialSnapshot={saved?.snapshot}
            onChange={(snapshot) => {
              latest.current.snapshot = snapshot;
              persist();
            }}
            onProgress={setProgress}
            onComplete={complete}
            className="absolute inset-0"
          />
        )}
        {image && (
          <CanvasTools
            canvas={canvasRef}
            ghost={ghost}
            onGhost={setGhost}
            edgesOnly={edgesOnly}
            onEdgesOnly={setEdgesOnly}
            editing={!done}
            className="absolute right-3 bottom-3 z-10"
          />
        )}

        {done && cardOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-soft-lg motion-safe:animate-[pop_180ms_ease-out]">
              <div className="text-5xl" aria-hidden>
                🎉
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold">Tabriklaymiz!</h2>
              <p className="mt-1 text-muted">
                Bugungi puzzle {formatClock(finishedMs)} da yig&apos;ildi.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCardOpen(false)}
                  className="flex-1 rounded-control border border-border px-4 py-2.5 font-medium"
                >
                  Rasmni ko&apos;rish
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="flex-1 rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground"
                >
                  Reyting
                </button>
              </div>
            </div>
          </div>
        )}
        {done && !cardOpen && (
          <button
            type="button"
            onClick={onExit}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft-md"
          >
            <Trophy className="size-4" aria-hidden /> Reyting
          </button>
        )}
      </div>
    </div>
  );
}
