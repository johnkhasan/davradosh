"use client";

import { Flag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ImagePicker, type PickedImage } from "@/components/create/image-picker";
import { CreateTableButton } from "@/components/table/create-button";
import { api } from "@/lib/api";
import { exportCrop } from "@/lib/game/crop";
import { cn } from "@/lib/utils";

/** Piece counts that make a good race (500 would take a whole evening). */
const RACE_PIECES = [24, 48, 100, 200] as const;

/** "Poyga" button on the puzzle page: choose a picture and a size, then open a race room. */
export function RaceCreate({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-control bg-primary px-7 py-3.5 text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        )}
      >
        <Flag className="size-5" aria-hidden /> Poyga yaratish
      </button>
      {open && <RaceDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function RaceDialog({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [pieces, setPieces] = useState<number>(48);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Stores the picture on the server (gallery import or upload) and returns the options. */
  const getOptions = async () => {
    if (!picked) return null;
    const image =
      picked.kind === "gallery"
        ? await api.importGallery(picked.item)
        : await api.upload(await exportCrop(picked.canvas, picked.crop));
    return { imageId: image.id, pieces };
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="race-create-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-card bg-surface shadow-soft-lg sm:rounded-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id="race-create-title" className="font-display text-xl font-bold">
            Puzzle poyga
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-sm text-muted">1. Hamma yig&apos;adigan rasmni tanlang.</p>
          <ImagePicker value={picked} onChange={setPicked} />
          <p className="mt-5 mb-2 text-sm text-muted">2. Bo&apos;laklar soni</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bo'laklar soni">
            {RACE_PIECES.map((count) => (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={pieces === count}
                onClick={() => setPieces(count)}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                  pieces === count
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border hover:bg-surface-muted",
                )}
              >
                {count} bo&apos;lak
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1 border-t border-border px-5 py-3 sm:items-end">
          {picked ? (
            <CreateTableButton
              kind="race"
              getOptions={getOptions}
              className="w-full px-6 py-3 text-base sm:w-auto"
            >
              Poyga stolini ochish
            </CreateTableButton>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-control bg-primary px-6 py-3 font-semibold text-primary-foreground opacity-50 sm:w-auto"
            >
              Avval rasm tanlang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
