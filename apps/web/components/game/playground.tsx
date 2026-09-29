"use client";

import { gridForPieceCount, PIECE_COUNT_OPTIONS, randomSeed } from "@puzzle/shared";
import {
  Eye,
  Frame,
  ImageUp,
  LayoutGrid,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createDemoImage, loadImageFile, type PuzzleImage } from "@/lib/game/images";
import { setSoundEnabled } from "@/lib/game/sounds";
import { cn } from "@/lib/utils";
import { PuzzleCanvas, type PuzzleCanvasHandle, type PuzzleProgress } from "./puzzle-canvas";
import { formatDuration, ProgressBar, TABLES, tableClass, ToolButton, type Table } from "./ui";

export function Playground() {
  const canvasRef = useRef<PuzzleCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Rendered client-only (see playground-loader), so browser APIs are safe in initializers.
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [image, setImage] = useState<PuzzleImage>(() => createDemoImage());
  const [pieces, setPieces] = useState<number>(() => Number(params.get("pieces")) || 48);
  const [seed, setSeed] = useState(() => randomSeed());
  const [ghost, setGhost] = useState(false);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [sound, setSound] = useState(true);
  const [table, setTable] = useState<Table>("felt");
  const [progress, setProgress] = useState<PuzzleProgress>({
    connected: 0,
    total: 0,
    complete: false,
  });
  const [fps, setFps] = useState<number | null>(null);
  const debug = params.has("debug");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [finishedIn, setFinishedIn] = useState<number | null>(null);

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

  const grid = gridForPieceCount(pieces, image.width / image.height);

  const restart = useCallback(() => {
    setSeed(randomSeed());
    setStartedAt(Date.now());
    setFinishedIn(null);
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImage(await loadImageFile(file));
    restart();
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur">
        <Link href="/" className="font-display text-lg font-bold">
          🧩 Puzzle
        </Link>
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
        <PuzzleCanvas
          ref={canvasRef}
          key={`${seed}-${grid.cols}x${grid.rows}`}
          image={image}
          cols={grid.cols}
          rows={grid.rows}
          seed={seed}
          ghost={ghost}
          edgesOnly={edgesOnly}
          onProgress={setProgress}
          onComplete={() => setFinishedIn(Date.now() - startedAt)}
          onFps={debug ? setFps : undefined}
          className="absolute inset-0"
        />

        <nav
          aria-label="Asboblar"
          className="absolute top-1/2 left-3 flex -translate-y-1/2 flex-col gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-md backdrop-blur"
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
          <ToolButton label="Bo'laklarni tartiblash" onClick={() => canvasRef.current?.arrange()}>
            <LayoutGrid />
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-md backdrop-blur">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value as Table)}
            className="rounded-control bg-transparent px-2 py-1 text-sm"
            aria-label="Stol foni"
          >
            {Object.entries(TABLES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ToolButton label="Kichiklashtirish (−)" onClick={() => canvasRef.current?.zoomBy(0.8)}>
            <Minus />
          </ToolButton>
          <ToolButton label="Kattalashtirish (+)" onClick={() => canvasRef.current?.zoomBy(1.25)}>
            <Plus />
          </ToolButton>
          <ToolButton label="Hammasini ko'rsatish (F)" onClick={() => canvasRef.current?.fit()}>
            <Maximize />
          </ToolButton>
        </div>

        {debug && fps !== null && (
          <span className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white">
            {fps} fps · {grid.cols * grid.rows} bo&apos;lak
          </span>
        )}

        {finishedIn !== null && (
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
                  onClick={() => setFinishedIn(null)}
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
