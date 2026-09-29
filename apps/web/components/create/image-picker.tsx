"use client";

import { ImageUp } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { PuzzleMark } from "@/components/puzzle-loader";
import { api, type GalleryItem } from "@/lib/api";
import type { CropRect } from "@/lib/game/crop";
import { loadImageFile } from "@/lib/game/images";
import { cn } from "@/lib/utils";
import { Cropper } from "./cropper";

export type PickedImage =
  | { kind: "gallery"; item: GalleryItem }
  | { kind: "upload"; canvas: HTMLCanvasElement; crop: CropRect };

const CATEGORY_LABELS: Record<string, string> = {
  nature: "Tabiat",
  cities: "Shaharlar",
  animals: "Hayvonlar",
  art: "San'at",
  uzbekistan: "O'zbekiston",
};

const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export function ImagePicker({
  value,
  onChange,
}: {
  value: PickedImage | null;
  onChange: (value: PickedImage | null) => void;
}) {
  const [tab, setTab] = useState<"gallery" | "upload">(
    value?.kind === "upload" ? "upload" : "gallery",
  );
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-control bg-surface-muted p-1" role="tablist">
        {(
          [
            ["gallery", "Galereya"],
            ["upload", "O'z rasmim"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === key ? "bg-surface shadow-soft-sm" : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "gallery" ? (
        <Gallery
          selected={value?.kind === "gallery" ? value.item : null}
          onSelect={(item) => onChange({ kind: "gallery", item })}
        />
      ) : (
        <Upload value={value?.kind === "upload" ? value : null} onChange={onChange} />
      )}
    </div>
  );
}

function Gallery({
  selected,
  onSelect,
}: {
  selected: GalleryItem | null;
  onSelect: (item: GalleryItem) => void;
}) {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [data, setData] = useState<{ categories: string[]; items: GalleryItem[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .gallery(category)
      .then((result) => !cancelled && (setData(result), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (failed) {
    return (
      <p className="rounded-card border border-dashed border-border p-8 text-center text-muted">
        Galereya hozircha mavjud emas. &quot;O&apos;z rasmim&quot; bo&apos;limidan rasm yuklang.
      </p>
    );
  }

  return (
    <div>
      {data && data.categories.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {data.categories.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                (category ?? "nature") === key
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border hover:bg-surface-muted",
              )}
            >
              {CATEGORY_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      )}
      <div className="grid max-h-[52vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {!data &&
          Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-control bg-surface-muted" />
          ))}
        {data?.items.map((item) => {
          const active = selected?.id === item.id && selected.provider === item.provider;
          return (
            <button
              key={`${item.provider}-${item.id}`}
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={active}
              aria-label={`Rasm: ${item.author}`}
              className={cn(
                "group relative aspect-[4/3] overflow-hidden rounded-control bg-surface-muted ring-offset-2 ring-offset-surface transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                active && "ring-3 ring-primary",
              )}
            >
              <Image
                src={item.thumbUrl}
                alt=""
                fill
                unoptimized
                // Picsum rejects hotlinked thumbnails that carry our domain as Referer (403).
                referrerPolicy="no-referrer"
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.author}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Rasmlar: Unsplash mualliflari</p>
    </div>
  );
}

function Upload({
  value,
  onChange,
}: {
  value: Extract<PickedImage, { kind: "upload" }> | null;
  onChange: (value: PickedImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(value?.canvas ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Faqat rasm fayllarini yuklash mumkin.");
    if (file.size > MAX_INPUT_BYTES) return setError("Rasm juda katta (30 MB gacha).");
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadImageFile(file);
      if (loaded.width < 300 || loaded.height < 300) throw new Error("small");
      setCanvas(loaded);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "small"
          ? "Rasm juda kichik (kamida 300×300 px)."
          : "Bu rasmni ochib bo'lmadi. JPG, PNG yoki WebP formatini sinab ko'ring.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  // Paste an image from the clipboard (Ctrl+V / Cmd+V).
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) void accept(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  const onCrop = useCallback(
    (crop: CropRect) => {
      if (canvas) onChange({ kind: "upload", canvas, crop });
    },
    [canvas, onChange],
  );

  if (canvas) {
    return (
      <div>
        <Cropper image={canvas} onChange={onCrop} />
        <button
          type="button"
          onClick={() => {
            setCanvas(null);
            onChange(null);
          }}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          Boshqa rasm tanlash
        </button>
      </div>
    );
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    void accept(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-border px-6 py-14 text-center transition-colors hover:border-primary hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          dragOver && "border-primary bg-primary-soft/60",
        )}
      >
        {busy ? (
          <PuzzleMark className="size-10" />
        ) : (
          <ImageUp className="size-10 text-primary" aria-hidden />
        )}
        <span className="font-display text-lg font-semibold">Rasmni shu yerga tashlang</span>
        <span className="text-sm text-muted">
          yoki bosing va tanlang · Ctrl+V bilan ham qo&apos;yish mumkin · JPG, PNG, WebP
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void accept(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
