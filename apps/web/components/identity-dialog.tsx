"use client";

import {
  AVATAR_EMOJIS,
  PLAYER_COLORS,
  randomAvatar,
  randomUsername,
  sanitizeName,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type PlayerColor,
} from "@puzzle/shared";
import { Dices } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { randomColor, saveIdentity, type Identity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { Avatar } from "./game/ui";

interface IdentityDialogProps {
  initial?: Identity | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (identity: Identity) => void;
  onCancel?: () => void;
}

/** Username, colour and avatar picker. No account needed; saved in localStorage. */
export function IdentityDialog({
  initial,
  title = "Sizni qanday chaqiramiz?",
  description = "Ismingiz boshqa o'yinchilarga kursoringiz yonida ko'rinadi.",
  submitLabel = "Davom etish",
  onSubmit,
  onCancel,
}: IdentityDialogProps) {
  const nameId = useId();
  const [name, setName] = useState(() => initial?.name ?? "");
  const [color, setColor] = useState<PlayerColor>(() => initial?.color ?? randomColor());
  const [avatar, setAvatar] = useState(() => initial?.avatar ?? randomAvatar());
  const [touched, setTouched] = useState(false);

  const clean = sanitizeName(name);
  const valid = clean.length >= USERNAME_MIN_LENGTH && clean.length <= USERNAME_MAX_LENGTH;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit(saveIdentity({ name: clean, color, avatar }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${nameId}-title`}
      onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card bg-surface p-6 shadow-soft-lg motion-safe:animate-[pop_180ms_ease-out]"
      >
        <div className="flex items-center gap-4">
          <Avatar name={clean || "?"} color={color} avatar={avatar} size="lg" />
          <div>
            <h2 id={`${nameId}-title`} className="font-display text-xl font-bold">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          </div>
        </div>

        <label htmlFor={nameId} className="mt-6 block text-sm font-medium">
          Ism yoki username
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id={nameId}
            autoFocus
            value={name}
            maxLength={USERNAME_MAX_LENGTH + 5}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Masalan, Aziz"
            autoComplete="nickname"
            aria-invalid={touched && !valid}
            aria-describedby={`${nameId}-hint`}
            className={cn(
              "min-w-0 flex-1 rounded-control border border-border bg-background px-3.5 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
              touched && !valid && "border-danger focus:border-danger focus:ring-danger/30",
            )}
          />
          <button
            type="button"
            onClick={() => {
              setName(randomUsername());
              setAvatar(randomAvatar());
            }}
            className="flex items-center gap-1.5 rounded-control border border-border px-3 text-sm font-medium hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            title="Tasodifiy ism"
          >
            <Dices className="size-4" aria-hidden />
            <span className="hidden sm:inline">Tasodifiy</span>
          </button>
        </div>
        <p
          id={`${nameId}-hint`}
          className={cn("mt-1.5 text-xs text-muted", touched && !valid && "text-danger")}
        >
          {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} ta belgi
        </p>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Kursor rangi</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Rang ${c}`}
                aria-pressed={color === c}
                className={cn(
                  "size-8 rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                  color === c &&
                    "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Avatar</legend>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                aria-label={`Avatar ${emoji}`}
                aria-pressed={avatar === emoji}
                className={cn(
                  "flex h-10 items-center justify-center rounded-control text-xl transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  avatar === emoji && "bg-primary-soft ring-2 ring-primary",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-control border border-border px-4 py-2.5 font-medium hover:bg-surface-muted"
            >
              Bekor qilish
            </button>
          )}
          <button
            type="submit"
            className="flex-1 rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-soft-sm transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
