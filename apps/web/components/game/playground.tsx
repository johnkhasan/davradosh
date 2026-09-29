"use client";

import {
  gridForPieceCount,
  PIECE_COUNT_OPTIONS,
  randomSeed,
  type PuzzleSnapshot,
} from "@puzzle/shared";
import {
  Eye,
  Frame,
  ImageUp,
  LayoutGrid,
  Lightbulb,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PuzzleLoader } from "@/components/puzzle-loader";
import { createDemoImage, loadImageFile, type PuzzleImage } from "@/lib/game/images";
import {
  clearPracticeSave,
  decodeImage,
  encodeImage,
  loadPracticeSave,
  snapshotFits,
  writePracticeSave,
} from "@/lib/game/practice-save";
import { setSoundEnabled } from "@/lib/game/sounds";
import { cn } from "@/lib/utils";
import { PuzzleCanvas, type PuzzleCanvasHandle, type PuzzleProgress } from "./puzzle-canvas";
import {
  formatDuration,
  FullscreenButton,
  ProgressBar,
  TABLES,
  tableClass,
  TablePicker,
  ToolButton,
  TooltipPlacementProvider,
  type Table,
} from "./ui";

export function Playground() {
  const canvasRef = useRef<PuzzleCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Rendered client-only (see playground-loader), so browser APIs are safe in initializers.
  const [params] = useState(() => new URLSearchParams(window.location.search));
  // Progress from before a reload; ignored when the link asks for a different piece count.
  const [saved] = useState(() => {
    const save = loadPracticeSave();
    const requested = Number(params.get("pieces"));
    return save && (!requested || requested === save.pieces) ? save : null;
  });
  // An uploaded picture is decoded asynchronously (see below); the demo one is drawn right away.
  const [image, setImage] = useState<PuzzleImage | null>(() =>
    saved && saved.image !== "demo" ? null : createDemoImage(),
  );
  const [isDemo, setIsDemo] = useState(() => !saved || saved.image === "demo");
  const [pieces, setPieces] = useState<number>(
    () => saved?.pieces ?? (Number(params.get("pieces")) || 48),
  );
  const [seed, setSeed] = useState(() => saved?.seed ?? randomSeed());
  const [ghost, setGhost] = useState(false);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [sound, setSound] = useState(true);
  const [table, setTable] = useState<Table>(() =>
    saved && saved.table in TABLES ? (saved.table as Table) : "felt",
  );
  const [progress, setProgress] = useState<PuzzleProgress>({
    connected: 0,
    total: 0,
    complete: false,
  });
  const [fps, setFps] = useState<number | null>(null);
  const debug = params.has("debug");
  const [startedAt, setStartedAt] = useState(() => Date.now() - (saved?.elapsedMs ?? 0));
  const [finishedIn, setFinishedIn] = useState<number | null>(null);
  // After finishing, "Ko'rish" closes the result card to admire the picture.
  const [resultOpen, setResultOpen] = useState(true);
  const finished = finishedIn !== null;
  const viewing = finished && !resultOpen;

  useEffect(() => setSoundEnabled(sound), [sound]);

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (
        e.key === "Tab" &&
        (document.activeElement === document.body || e.target === document.body)
      ) {
        e.preventDefault();
        setGhost(true);
      }
      if (e.key === "f" || e.key === "F") canvasRef.current?.fit();
      if (!e.repeat && (e.key === "h" || e.key === "H")) canvasRef.current?.hint();
      if (e.key === "+" || e.key === "=") canvasRef.current?.zoomBy(1.25);
      if (e.key === "-" || e.key === "_") canvasRef.current?.zoomBy(0.8);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Tab") setGhost(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const grid = gridForPieceCount(pieces, image ? image.width / image.height : 4 / 3);
  const initialSnapshot =
    saved && saved.seed === seed && snapshotFits(saved.snapshot, grid.cols * grid.rows)
      ? saved.snapshot
      : undefined;

  // Last reported layout; PuzzleCanvas reports a fresh one whenever a new puzzle is built.
  const latest = useRef({ snapshot: null as PuzzleSnapshot | null, finished: false });

  const restart = useCallback(() => {
    latest.current.finished = false;
    setSeed(randomSeed());
    setStartedAt(Date.now());
    setFinishedIn(null);
    setResultOpen(true);
  }, []);

  // Writes everything needed to rebuild this exact puzzle after a reload.
  const persistRef = useRef(() => {});
  // Layout effect: it must be current before PuzzleCanvas reports its first layout (child effects run first).
  useLayoutEffect(() => {
    persistRef.current = () => {
      const { snapshot, finished } = latest.current;
      if (!snapshot || !image || finished) return;
      writePracticeSave({
        pieces,
        seed,
        table,
        elapsedMs: Date.now() - startedAt,
        image: isDemo
          ? "demo"
          : { src: encodeImage(image), width: image.width, height: image.height },
        snapshot,
      });
    };
  });
  const persist = useCallback(() => persistRef.current(), []);

  useEffect(() => persist(), [table, persist]);

  // Keep the clock accurate when the tab is closed or reloaded between moves.
  useEffect(() => {
    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  useEffect(() => {
    if (!saved || saved.image === "demo") return;
    let cancelled = false;
    decodeImage(saved.image)
      .then((restored) => !cancelled && setImage(restored))
      .catch(() => {
        if (cancelled) return;
        // The saved picture is unreadable: fall back to a fresh demo puzzle.
        clearPracticeSave();
        setImage(createDemoImage());
        setIsDemo(true);
        setSeed(randomSeed());
        setStartedAt(Date.now());
      });
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImage(await loadImageFile(file));
    setIsDemo(false);
    restart();
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur">
        {/* Not a link: a stray click mid-game must not leave the puzzle. */}
        <span className="font-display text-lg font-bold select-none">🧩 Puzzle</span>
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
          Mashq maydoni
        </span>
        <div className="ml-auto flex flex-1 justify-end">
          <ProgressBar connected={progress.connected} total={progress.total} />
        </div>
        <select
          value={pieces}
          onChange={(e) => {
            setPieces(Number(e.target.value));
            restart();
          }}
          className="rounded-control border border-border bg-surface px-2 py-1 text-sm"
          aria-label="Bo'laklar soni"
        >
          {PIECE_COUNT_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count} bo&apos;lak
            </option>
          ))}
        </select>
      </header>

      <div className={cn("relative flex-1", tableClass(table))}>
        {!image && <PuzzleLoader variant="overlay" label="Puzzle tiklanmoqda" />}
        {image && (
          <PuzzleCanvas
            ref={canvasRef}
            key={`${seed}-${grid.cols}x${grid.rows}`}
            image={image}
            cols={grid.cols}
            rows={grid.rows}
            seed={seed}
            ghost={ghost}
            edgesOnly={edgesOnly}
            initialSnapshot={initialSnapshot}
            onChange={(snapshot) => {
              latest.current.snapshot = snapshot;
              persist();
            }}
            onProgress={setProgress}
            onComplete={() => {
              latest.current.finished = true;
              clearPracticeSave();
              setFinishedIn(Date.now() - startedAt);
            }}
            onFps={debug ? setFps : undefined}
            className="absolute inset-0"
          />
        )}

        {/* While admiring the finished picture only the view controls stay. */}
        {!viewing && (
          <TooltipPlacementProvider value="side">
            <nav
              aria-label="Asboblar"
              className="absolute bottom-3 left-3 z-10 flex flex-row gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-md backdrop-blur sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:flex-col"
            >
              <ToolButton
                label="Asl rasm (Tab ni bosib turing)"
                active={ghost}
                onClick={() => setGhost((v) => !v)}
              >
                <Eye />
              </ToolButton>
              <ToolButton
                label="Faqat chekka bo'laklar"
                active={edgesOnly}
                onClick={() => setEdgesOnly((v) => !v)}
              >
                <Frame />
              </ToolButton>
              <ToolButton
                label="Bo'laklarni tartiblash"
                onClick={() => canvasRef.current?.arrange()}
              >
                <LayoutGrid />
              </ToolButton>
              <ToolButton label="Maslahat (H)" onClick={() => canvasRef.current?.hint()}>
                <Lightbulb />
              </ToolButton>
              <ToolButton label="Rasm yuklash" onClick={() => fileRef.current?.click()}>
                <ImageUp />
              </ToolButton>
              <ToolButton label="Qaytadan boshlash" onClick={restart}>
                <RotateCcw />
              </ToolButton>
              <ToolButton
                label={sound ? "Ovozni o'chirish" : "Ovozni yoqish"}
                onClick={() => setSound((v) => !v)}
              >
                {sound ? <Volume2 /> : <VolumeX />}
              </ToolButton>
            </nav>
          </TooltipPlacementProvider>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        <TooltipPlacementProvider value="top-end">
          <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-md backdrop-blur">
            <TablePicker value={table} onChange={setTable} className="hidden sm:block" />
            <ToolButton
              label="Kichiklashtirish (−)"
              className="hidden sm:flex"
              onClick={() => canvasRef.current?.zoomBy(0.8)}
            >
              <Minus />
            </ToolButton>
            <ToolButton
              label="Kattalashtirish (+)"
              className="hidden sm:flex"
              onClick={() => canvasRef.current?.zoomBy(1.25)}
            >
              <Plus />
            </ToolButton>
            <ToolButton label="Hammasini ko'rsatish (F)" onClick={() => canvasRef.current?.fit()}>
              <LocateFixed />
            </ToolButton>
            <FullscreenButton />
          </div>
        </TooltipPlacementProvider>

        {debug && fps !== null && (
          <span className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white">
            {fps} fps · {grid.cols * grid.rows} bo&apos;lak
          </span>
        )}

        {viewing && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 motion-safe:animate-[pop_160ms_ease-out]">
            <button
              type="button"
              onClick={() => setResultOpen(true)}
              className="flex items-center gap-1.5 rounded-control border border-border bg-surface/95 px-3 py-2 text-sm font-medium shadow-soft-md backdrop-blur hover:bg-surface-muted"
            >
              <Trophy className="size-4" aria-hidden /> Natija
            </button>
            <button
              type="button"
              onClick={restart}
              className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft-md transition-transform hover:-translate-y-0.5"
            >
              <RotateCcw className="size-4" aria-hidden /> Yangi o&apos;yin
            </button>
          </div>
        )}

        {finished && resultOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-soft-lg">
              <div className="text-5xl" aria-hidden>
                🎉
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold">Tabriklaymiz!</h2>
              <p className="mt-1 text-muted">
                {progress.total} bo&apos;lakli puzzle {formatDuration(finishedIn)} da yig&apos;ildi.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setResultOpen(false)}
                  className="flex-1 rounded-control border border-border px-4 py-2.5 font-medium"
                >
                  Ko&apos;rish
                </button>
                <button
                  onClick={restart}
                  className="flex-1 rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground"
                >
                  Yana o&apos;ynash
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
