"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/env";
import { cn } from "@/lib/utils";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Server tekshirilmoqda…",
  online: "Server ishlayapti",
  offline: "Server bilan aloqa yo'q",
};

export function ServerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? "online" : "offline"))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setStatus("offline");
        return error;
      });
    return () => controller.abort();
  }, []);

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted shadow-soft-sm"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "checking" && "animate-pulse bg-muted",
          status === "online" && "bg-snap",
          status === "offline" && "bg-danger",
        )}
      />
      {LABELS[status]}
    </span>
  );
}
