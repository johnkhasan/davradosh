"use client";

import {
  generatePieceShapes,
  gridForPieceCount,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_PER_ROOM,
  PIECE_COUNT_OPTIONS,
  type PathCommand,
  type PieceCountOption,
} from "@puzzle/shared";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Rough solo solving time; shown so people pick a size that fits their evening. */
const ESTIMATES: Record<PieceCountOption, string> = {
  24: "~5 daqiqa",
  48: "~10 daqiqa",
  100: "~25 daqiqa",
  200: "~1 soat",
  500: "~3 soat",
};

export interface PuzzleSettings {
  pieces: PieceCountOption;
  maxPlayers: number;
}

interface SettingsStepProps {
  previewUrl: string;
  aspect: number;
  value: PuzzleSettings;
  onChange: (value: PuzzleSettings) => void;
}

export function SettingsStep({ previewUrl, aspect, value, onChange }: SettingsStepProps) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <fieldset>
          <legend className="font-medium">Bo&apos;laklar soni</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
            {PIECE_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={value.pieces === count}
                onClick={() => onChange({ ...value, pieces: count })}
                className={cn(
                  "rounded-control border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  value.pieces === count
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-surface-muted",
                )}
              >
                <span className="block font-display text-lg font-bold">{count}</span>
                <span className="block text-xs text-muted">{ESTIMATES[count]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium">Ko&apos;pi bilan nechta o&apos;yinchi</legend>
          <div className="mt-2 flex gap-2">
            {Array.from(
              { length: MAX_PLAYERS_PER_ROOM - MIN_PLAYERS_PER_ROOM + 1 },
              (_, i) => MIN_PLAYERS_PER_ROOM + i,
            ).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={value.maxPlayers === n}
                onClick={() => onChange({ ...value, maxPlayers: n })}
                className={cn(
                  "size-11 rounded-control border font-display text-lg font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  value.maxPlayers === n
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border hover:bg-surface-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">Siz ham shu songa kirasiz.</p>
        </fieldset>
      </div>

      <GridPreview previewUrl={previewUrl} aspect={aspect} pieces={value.pieces} />
    </div>
  );
}

function toSvgPath(path: PathCommand[], ox: number, oy: number) {
  return path
    .map((c) =>
      c.type === "C"
        ? `C${c.x1 + ox} ${c.y1 + oy} ${c.x2 + ox} ${c.y2 + oy} ${c.x + ox} ${c.y + oy}`
        : `${c.type}${c.x + ox} ${c.y + oy}`,
    )
    .join("");
}

/** The chosen image with the real piece outlines on top, updating live. */
function GridPreview({
  previewUrl,
  aspect,
  pieces,
}: {
  previewUrl: string;
  aspect: number;
  pieces: number;
}) {
  const width = 1000;
  const height = width / aspect;
  const { cols, rows } = gridForPieceCount(pieces, aspect);
  const d = useMemo(() => {
    const shapes = generatePieceShapes({
      cols,
      rows,
      pieceWidth: width / cols,
      pieceHeight: height / rows,
      seed: 42,
    });
    return shapes
      .map((s) => toSvgPath(s.path, (s.col * width) / cols, (s.row * height) / rows))
      .join("");
  }, [cols, rows, height]);

  return (
    <figure>
      <div
        className="relative overflow-hidden rounded-card shadow-soft-md"
        style={{ aspectRatio: `${aspect}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- blob: and remote previews */}
        <img
          src={previewUrl}
          alt="Tanlangan rasm"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <path
            d={d}
            fill="none"
            stroke="white"
            strokeOpacity={0.85}
            strokeWidth={pieces > 200 ? 1 : 1.6}
          />
          <path d={d} fill="none" stroke="black" strokeOpacity={0.25} strokeWidth={0.6} />
        </svg>
      </div>
      <figcaption className="mt-2 text-center text-sm text-muted">
        {cols} × {rows} = {cols * rows} bo&apos;lak
      </figcaption>
    </figure>
  );
}
