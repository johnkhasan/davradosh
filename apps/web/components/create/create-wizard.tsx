"use client";

import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { api } from "@/lib/api";
import { exportCrop } from "@/lib/game/crop";
import { loadIdentity, type Identity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { ImagePicker, type PickedImage } from "./image-picker";
import { SettingsStep, type PuzzleSettings } from "./settings-step";

const STEPS = ["Rasm", "Sozlamalar", "Boshlash"] as const;

export function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [settings, setSettings] = useState<PuzzleSettings>({ pieces: 48, maxPlayers: 5 });
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = usePreview(picked);

  const create = async (who: Identity) => {
    if (!picked) return;
    setError(null);
    try {
      let imageId: string;
      if (picked.kind === "gallery") {
        setBusy("Rasm tayyorlanmoqda…");
        imageId = (await api.importGallery(picked.item)).id;
      } else {
        setBusy("Rasm yuklanmoqda…");
        const blob = await exportCrop(picked.canvas, picked.crop);
        imageId = (await api.upload(blob)).id;
      }
      setBusy("Puzzle yaratilmoqda…");
      const { id } = await api.createRoom({
        clientId: who.clientId,
        imageId,
        pieces: settings.pieces,
        maxPlayers: settings.maxPlayers,
      });
      router.push(`/room/${id}`);
    } catch {
      setBusy(null);
      setError("Nimadir xato ketdi. Internetni tekshirib, qayta urinib ko'ring.");
    }
  };

  const start = () => {
    if (identity) void create(identity);
    else setAskName(true);
  };

  const canContinue = step === 0 ? Boolean(picked && preview) : true;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-bold">
          🧩 Puzzle
        </Link>
        <ol className="flex items-center gap-2 text-sm" aria-label="Qadamlar">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={index === step ? "step" : undefined}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  index < step && "bg-snap text-white",
                  index === step && "bg-primary text-primary-foreground",
                  index > step && "bg-surface-muted text-muted",
                )}
              >
                {index < step ? "✓" : index + 1}
              </span>
              <span
                className={cn("hidden sm:inline", index === step ? "font-medium" : "text-muted")}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>
      </div>

      <section className="rounded-card border border-border bg-surface p-4 shadow-soft-sm sm:p-6">
        <h1 className="mb-4 font-display text-2xl font-bold">
          {step === 0 && "Qaysi rasmni yig'amiz?"}
          {step === 1 && "Qanchalik qiyin bo'lsin?"}
          {step === 2 && "Hammasi tayyor!"}
        </h1>

        {step === 0 && <ImagePicker value={picked} onChange={setPicked} />}
        {step === 1 && preview && (
          <SettingsStep
            previewUrl={preview.url}
            aspect={preview.aspect}
            value={settings}
            onChange={setSettings}
          />
        )}
        {step === 2 && preview && (
          <div className="flex flex-col items-center gap-5 py-4 text-center sm:flex-row sm:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: and remote previews */}
            <img
              src={preview.url}
              alt=""
              referrerPolicy="no-referrer"
              className="w-56 rounded-control object-cover shadow-soft-md"
              style={{ aspectRatio: `${preview.aspect}` }}
            />
            <div className="space-y-2">
              <p className="text-lg">
                <b>{settings.pieces}</b> bo&apos;lak · <b>{settings.maxPlayers}</b> kishigacha
              </p>
              <p className="text-muted">
                Puzzle yaratilgach, havolani do&apos;stlaringizga yuboring: ular darhol
                qo&apos;shilishadi. Puzzle 7 kun saqlanadi.
              </p>
              {identity && (
                <p className="text-sm text-muted">
                  Siz: <b style={{ color: identity.color }}>{identity.name}</b>{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setAskName(true)}
                  >
                    o&apos;zgartirish
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0 || busy !== null}
            className="flex items-center gap-1.5 rounded-control px-3 py-2.5 font-medium text-muted hover:text-foreground disabled:invisible"
          >
            <ArrowLeft className="size-4" aria-hidden /> Orqaga
          </button>
          {step < 2 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-control bg-primary px-5 py-2.5 font-medium text-primary-foreground shadow-soft-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Davom etish <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={start}
              className="flex items-center gap-2 rounded-control bg-primary px-6 py-3 font-medium text-primary-foreground shadow-soft-md transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {busy ?? "Puzzle yaratish"}
            </button>
          )}
        </div>
      </section>

      {askName && (
        <IdentityDialog
          initial={identity}
          onCancel={() => setAskName(false)}
          onSubmit={(who) => {
            setIdentity(who);
            setAskName(false);
            if (step === 2 && !identity) void create(who);
          }}
        />
      )}
    </main>
  );
}

/** Preview URL and aspect ratio for the picked image (object URLs are revoked). */
function usePreview(picked: PickedImage | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const crop = picked?.kind === "upload" ? picked.crop : null;
  const canvas = picked?.kind === "upload" ? picked.canvas : null;

  useEffect(() => {
    if (!canvas || !crop) return;
    let url: string | null = null;
    let cancelled = false;
    // Debounced: the crop changes on every drag frame.
    const timer = window.setTimeout(() => {
      void exportCrop(canvas, crop, 900).then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [canvas, crop]);

  return useMemo(() => {
    if (!picked) return null;
    if (picked.kind === "gallery") {
      return { url: picked.item.thumbUrl, aspect: picked.item.width / picked.item.height };
    }
    return objectUrl ? { url: objectUrl, aspect: picked.crop.width / picked.crop.height } : null;
  }, [picked, objectUrl]);
}
