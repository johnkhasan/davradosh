"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ASPECTS, clampCrop, fitCrop, type AspectKey, type CropRect } from "@/lib/game/crop";
import { cn } from "@/lib/utils";

interface CropperProps {
  image: HTMLCanvasElement;
  onChange: (rect: CropRect) => void;
}

/** Fixed-aspect crop frame: pick a ratio, zoom with the slider, drag to reposition. */
export function Cropper({ image, onChange }: CropperProps) {
  const [aspect, setAspect] = useState<AspectKey>("4:3");
  const [zoom, setZoom] = useState(1);
  const [rect, setRect] = useState<CropRect>(() =>
    fitCrop(image.width, image.height, ASPECTS["4:3"].ratio),
  );
  const boxRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; rect: CropRect } | null>(null);

  useEffect(() => onChange(rect), [rect, onChange]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  }, [image]);

  const reset = (nextAspect: AspectKey, nextZoom: number) => {
    setRect((current) => {
      const fitted = fitCrop(image.width, image.height, ASPECTS[nextAspect].ratio, nextZoom);
      // Keep the frame centred on the same spot when zooming.
      const cx = current.x + current.width / 2;
      const cy = current.y + current.height / 2;
      return clampCrop(
        { ...fitted, x: cx - fitted.width / 2, y: cy - fitted.height / 2 },
        image.width,
        image.height,
      );
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already released (fast taps); dragging still works without capture.
    }
    drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, rect };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    const box = boxRef.current;
    if (!current || current.id !== event.pointerId || !box) return;
    const scale = image.width / box.clientWidth;
    setRect(
      clampCrop(
        {
          ...current.rect,
          x: current.rect.x + (event.clientX - current.startX) * scale,
          y: current.rect.y + (event.clientY - current.startY) * scale,
        },
        image.width,
        image.height,
      ),
    );
  };

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        className="relative mx-auto max-h-[55vh] overflow-hidden rounded-card bg-black select-none"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        <canvas ref={previewRef} className="block h-full w-full" />
        <div
          role="group"
          aria-roledescription="kesish maydoni"
          aria-label="Kesish maydoni: sudrab yoki strelka tugmalari bilan siljiting"
          tabIndex={0}
          onKeyDown={(e) => {
            const step = image.width / 50;
            const d = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            }[e.key];
            if (!d) return;
            e.preventDefault();
            setRect((r) =>
              clampCrop({ ...r, x: r.x + d[0]!, y: r.y + d[1]! }, image.width, image.height),
            );
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          className="absolute cursor-move touch-none rounded-sm outline-2 outline-white focus-visible:outline-primary"
          style={{
            left: pct(rect.x, image.width),
            top: pct(rect.y, image.height),
            width: pct(rect.width, image.width),
            height: pct(rect.height, image.height),
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
            outlineStyle: "solid",
          }}
        >
          {/* Rule-of-thirds guides */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="border-[0.5px] border-white/30" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex gap-1 rounded-control bg-surface-muted p-1"
          role="radiogroup"
          aria-label="Nisbat"
        >
          {(Object.keys(ASPECTS) as AspectKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={aspect === key}
              onClick={() => {
                setAspect(key);
                reset(key, zoom);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                aspect === key ? "bg-surface shadow-soft-sm" : "text-muted hover:text-foreground",
              )}
            >
              {ASPECTS[key].label}
            </button>
          ))}
        </div>
        <label className="flex min-w-40 flex-1 items-center gap-2 text-sm text-muted">
          Yaqinlashtirish
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const next = Number(e.target.value);
              setZoom(next);
              reset(aspect, next);
            }}
            className="flex-1 accent-[var(--primary)]"
          />
        </label>
      </div>
    </div>
  );
}
