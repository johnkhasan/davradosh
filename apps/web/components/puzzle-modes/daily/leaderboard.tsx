import type { DailyLeaderboardDTO, DailyLeaderRow } from "@/lib/api";
import { Avatar } from "@/components/game/ui";
import { cn } from "@/lib/utils";
import { formatClock } from "../save";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Fastest times of the day; the viewer's own row is highlighted (and added when outside). */
export function DailyLeaderboard({
  board,
  limit,
  className,
}: {
  board: DailyLeaderboardDTO;
  limit?: number;
  className?: string;
}) {
  const rows = limit ? board.top.slice(0, limit) : board.top;
  const own = board.you && !rows.some((row) => row.you) ? board.you : null;
  if (rows.length === 0)
    return (
      <p
        className={cn(
          "rounded-card bg-surface-muted p-4 text-center text-sm text-muted",
          className,
        )}
      >
        Bugun hali hech kim yig&apos;madi. Birinchi bo&apos;ling!
      </p>
    );
  return (
    <ol
      className={cn(
        "divide-y divide-border rounded-card border border-border bg-surface",
        className,
      )}
    >
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
      {own && (
        <>
          <li aria-hidden className="px-4 py-1 text-center text-xs text-muted">
            ···
          </li>
          <Row row={own} />
        </>
      )}
    </ol>
  );
}

function Row({ row }: { row: DailyLeaderRow }) {
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2", row.you && "bg-primary-soft")}>
      <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums">
        {MEDALS[row.rank - 1] ?? row.rank}
      </span>
      <Avatar name={row.name} color={row.color} avatar={row.avatar} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {row.name}
        {row.you && <span className="text-muted"> (siz)</span>}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums">{formatClock(row.ms)}</span>
    </li>
  );
}
