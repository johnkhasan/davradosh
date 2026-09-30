"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/env";
import { cn } from "@/lib/utils";

type Status = "checking" | "online" | "degraded" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Server tekshirilmoqda…",
  online: "Server ishlayapti",
  degraded: "Server qisman ishlayapti",
  offline: "Server bilan aloqa yo'q",
};

const DETAILS: Record<Status, string> = {
  checking: "",
  online: "Server va ma'lumotlar bazasi javob bermoqda",
  degraded: "Server ishlayapti, lekin ma'lumotlar bazasi javob bermayapti",
  offline: "Serverga ulanib bo'lmadi",
};

/** Re-checked this often while the tab is visible. */
const INTERVAL_MS = 30_000;
/** A server that does not answer in time counts as down. */
const TIMEOUT_MS = 5_000;

async function check(): Promise<Status> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return "online";
    // 503 with a body means the server runs but its database is unreachable.
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "degraded" ? "degraded" : "offline";
  } catch {
    return "offline";
  }
}

export function ServerStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      window.clearTimeout(timer);
      // The last known state stays on screen while a re-check runs.
      const next = await check();
      if (cancelled) return;
      setStatus(next);
      setCheckedAt(new Date());
      if (document.visibilityState === "visible")
        timer = window.setTimeout(() => void run(), INTERVAL_MS);
    };

    // Background tabs stop polling; coming back (or back online) checks right away.
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
      else window.clearTimeout(timer);
    };
    const onOffline = () => setStatus("offline");

    void run();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const time = checkedAt?.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

  return (
    <span
      role="status"
      title={time ? `${DETAILS[status]} · tekshirildi ${time}` : undefined}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted shadow-soft-sm"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "checking" && "animate-pulse bg-muted",
          status === "online" && "bg-snap",
          status === "degraded" && "bg-amber-500",
          status === "offline" && "bg-danger",
        )}
      />
      {LABELS[status]}
    </span>
  );
}
