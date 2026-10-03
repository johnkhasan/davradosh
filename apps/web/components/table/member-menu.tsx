"use client";

import type { TableMemberDTO } from "@puzzle/shared/games";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/game/ui";
import type { TableActions } from "@/lib/table/use-table-room";

/** Host menu for one member: hand the room over, remove, or remove for good. */
export function MemberMenu({
  member,
  onClose,
  onAction,
  actions,
}: {
  member: TableMemberDTO;
  onClose: () => void;
  onAction: (call: () => Promise<{ ok: boolean; error?: string }>) => void;
  actions: TableActions;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.name}: stol egasi amallari`}
        className="mafia-enter w-full max-w-sm rounded-card bg-surface p-5 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar name={member.name} color={member.color} avatar={member.avatar} size="md" />
          <h2 className="font-display text-xl font-bold">{member.name}</h2>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {member.connected && (
            <button
              type="button"
              onClick={() => onAction(() => actions.transferHost(member.id))}
              className="flex items-center gap-2 rounded-control border border-border px-4 py-3 text-left font-medium"
            >
              <Crown className="size-4 text-amber-500" aria-hidden /> Stol egasi qilish
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction(() => actions.kick(member.id, false))}
            className="rounded-control border border-border px-4 py-3 text-left font-medium"
          >
            👋 Stoldan chiqarish
          </button>
          <button
            type="button"
            onClick={() => onAction(() => actions.kick(member.id, true))}
            className="rounded-control bg-danger px-4 py-3 text-left font-semibold text-white"
          >
            🚫 Ban qilish (qayta kira olmaydi)
          </button>
          <button type="button" onClick={onClose} className="mt-1 px-4 py-2 text-muted">
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}
