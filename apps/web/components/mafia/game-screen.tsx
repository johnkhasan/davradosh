"use client";

import {
  BEST_MOVE_SIZE,
  type MafiaAction,
  type MafiaMemberDTO,
  type MafiaRoomStateDTO,
  type MafiaSeatView,
  type MafiaView,
} from "@puzzle/shared/mafia";
import { Eye, EyeOff, Mic } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/game/ui";
import {
  errorText,
  eventText,
  phaseTitle,
  RESULT_TEXT,
  ROLE_TEXT,
  seatColumns,
} from "@/lib/mafia/text";
import type { MafiaActions } from "@/lib/mafia/use-mafia-room";
import type { MafiaVoiceHandle } from "@/lib/mafia/use-mafia-voice";
import { cn } from "@/lib/utils";
import { useCountdown } from "./use-countdown";
import { currentSaying, GameHistory, HostTools, SayBox, TeamChat } from "./game-extras";
import { VoiceControls } from "./voice-controls";

type PickAction = Extract<MafiaAction, "nominate" | "vote" | "shoot" | "check" | "bestMove">;

const NIGHT: ReadonlyArray<MafiaView["phase"]> = [
  "night",
  "zeroNight",
  "shoot",
  "donCheck",
  "sheriffCheck",
  "bestMove",
];

const EXIT_TEXT = {
  fouled: "4 foll bilan chiqdi",
  voted: "ovoz bilan chiqdi",
  killed: "o'ldirildi",
  left: "chiqib ketdi",
} as const;

/** Which seat-picking action is open for the viewer right now, if any. */
function pickAction(view: MafiaView): PickAction | null {
  const order: PickAction[] = ["bestMove", "shoot", "check", "vote", "nominate"];
  return order.find((a) => view.actions.includes(a)) ?? null;
}

function canPick(view: MafiaView, action: PickAction, seat: MafiaSeatView): boolean {
  switch (action) {
    case "nominate":
      return seat.alive && !view.nominations.some((n) => n.seat === seat.seat);
    case "vote":
      return view.ballot.includes(seat.seat);
    case "shoot":
      return seat.alive;
    case "check":
    case "bestMove":
      return seat.alive && seat.seat !== view.me;
  }
}

/** The table while a game runs (and its result once it is over). */
export function MafiaGameScreen({
  state,
  clockOffset,
  actions,
  voice,
}: {
  state: MafiaRoomStateDTO;
  clockOffset: number;
  actions: MafiaActions;
  voice: MafiaVoiceHandle;
}) {
  const view = state.game!;
  const members = new Map(state.members.map((m) => [m.id, m]));
  const me = view.seats.find((s) => s.seat === view.me) ?? null;
  const night = NIGHT.includes(view.phase);
  const seconds = useCountdown(view.phase === "gameOver" ? null : view.endsAt, clockOffset);
  const action = pickAction(view);

  // A selection belongs to one step of the game; a new step starts with nothing picked.
  const step = `${view.phase}|${view.day}|${view.night}|${view.speaker}|${action}`;
  const [pick, setPick] = useState<{ step: string; seats: number[] }>({ step, seats: [] });
  const picked = pick.step === step ? pick.seats : [];
  // Errors belong to a step too: a refusal from the last speech is noise during the vote.
  const [failure, setFailure] = useState<{ step: string; text: string } | null>(null);
  const error = failure?.step === step ? failure.text : null;
  const setError = (text: string | null) => setFailure(text ? { step, text } : null);

  const toggle = (seat: MafiaSeatView) => {
    if (!action || !canPick(view, action, seat)) return;
    setError(null);
    // Functional updates: quick taps in a row must all count, not just the last one.
    setPick((previous) => {
      const current = previous.step === step ? previous.seats : [];
      if (action !== "bestMove")
        return { step, seats: current[0] === seat.seat ? [] : [seat.seat] };
      const seats = current.includes(seat.seat)
        ? current.filter((s) => s !== seat.seat)
        : current.length < BEST_MOVE_SIZE
          ? [...current, seat.seat]
          : current;
      return { step, seats };
    });
  };

  const run = async (call: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await call();
    if (!result.ok) setError(errorText(result.error ?? ""));
    else setPick({ step, seats: [] });
  };

  const confirm = () => {
    if (!action || picked.length === 0) return;
    const [seat] = picked;
    const call = {
      nominate: () => actions.nominate(seat!),
      vote: () => actions.vote(seat!),
      shoot: () => actions.shoot(seat!),
      check: () => actions.check(seat!),
      bestMove: () => actions.bestMove(picked),
    }[action];
    void run(call);
  };

  const isHost = members.get(state.you)?.isHost ?? false;

  return (
    <div
      className={cn(
        "min-h-dvh transition-colors duration-700",
        night ? "bg-[#0e0b1a] text-white" : "bg-background text-foreground",
      )}
    >
      <PhaseBar
        view={view}
        seconds={seconds}
        night={night}
        me={me}
        voice={voice}
        hostTools={
          isHost && view.phase !== "gameOver" ? (
            <HostTools view={view} actions={actions} dark={night} />
          ) : null
        }
      />

      <main className="mx-auto w-full max-w-4xl px-3 pt-3 pb-40 sm:px-4">
        {view.phase === "roleReveal" && me?.role && <RoleCard seat={me} view={view} />}
        {view.phase === "dawn" && <DawnBanner view={view} />}
        <VoteTally view={view} />

        {view.phase === "gameOver" && view.result && (
          <section className="mafia-dawn rounded-card bg-gradient-to-br from-primary to-[#4b3bc9] p-6 text-center text-white shadow-soft-lg">
            <div className="text-5xl" aria-hidden>
              {view.result === "red" ? "🏙️" : view.result === "black" ? "🕶️" : "🤝"}
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold">{RESULT_TEXT[view.result]}</h2>
            <p className="mt-1 text-white/80">Hamma rollar ochildi.</p>
            {isHost && (
              <button
                type="button"
                onClick={() => void run(actions.rematch)}
                className="mt-5 rounded-control bg-white px-6 py-3 font-semibold text-primary"
              >
                Yana o&apos;ynash
              </button>
            )}
          </section>
        )}

        {view.phase === "gameOver" && <GameHistory view={view} />}
        {view.phase === "zeroNight" && <TeamChat view={view} actions={actions} />}

        {view.phase === "night" ? (
          <SleepingCity view={view} />
        ) : (
          <ol className={cn("mt-3 grid grid-cols-2 gap-2", seatColumns(view.seats.length))}>
            {view.seats.map((seat) => (
              <SeatCard
                key={seat.seat}
                seat={seat}
                view={view}
                member={members.get(seat.playerId)}
                night={night}
                selectable={action !== null && canPick(view, action, seat)}
                selected={picked.includes(seat.seat)}
                talking={Boolean(voice.snapshot.speaking[seat.playerId])}
                onSelect={() => toggle(seat)}
              />
            ))}
          </ol>
        )}

        <GameLog view={view} night={night} />
      </main>

      <ActionPanel
        view={view}
        me={me}
        night={night}
        action={action}
        picked={picked}
        error={error}
        onConfirm={confirm}
        onPass={() => void run(actions.pass)}
        onLiftAll={(agree) => void run(() => actions.liftAll(agree))}
        onSay={actions.say}
      />
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function PhaseBar({
  view,
  seconds,
  night,
  me,
  voice,
  hostTools,
}: {
  view: MafiaView;
  seconds: number | null;
  night: boolean;
  me: MafiaSeatView | null;
  voice: MafiaVoiceHandle;
  hostTools: ReactNode;
}) {
  const [showRole, setShowRole] = useState(false);
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b backdrop-blur",
        night ? "border-white/10 bg-[#0e0b1a]/85" : "border-border bg-surface/90",
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{phaseTitle(view)}</p>
          {view.speaker !== null && !night && (
            <p className={cn("text-sm", night ? "text-white/70" : "text-muted")}>
              🎙️ {view.speaker}-raqam gapiryapti
            </p>
          )}
        </div>
        {hostTools}
        <VoiceControls handle={voice} dark={night} />
        {seconds !== null && (
          <span
            className={cn(
              "rounded-full px-3 py-1 font-mono text-lg font-semibold tabular-nums",
              seconds <= 5
                ? "mafia-urgent bg-danger text-white"
                : night
                  ? "bg-white/10"
                  : "bg-surface-muted",
            )}
            aria-label={`${seconds} soniya qoldi`}
          >
            {seconds}
          </span>
        )}
        {me?.role && (
          <button
            type="button"
            onClick={() => setShowRole((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
              night ? "bg-white/10" : "bg-primary-soft text-primary",
            )}
            aria-pressed={showRole}
          >
            {showRole ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
            <span className="font-mono">№{me.seat}</span>
            {showRole && ` · ${ROLE_TEXT[me.role].emoji} ${ROLE_TEXT[me.role].name}`}
          </button>
        )}
      </div>
    </header>
  );
}

function RoleCard({ seat, view }: { seat: MafiaSeatView; view: MafiaView }) {
  const [open, setOpen] = useState(false);
  const role = ROLE_TEXT[seat.role!];
  const team = view.seats.filter((s) => s.role !== null && s.seat !== seat.seat);
  return (
    <section className="mafia-enter mx-auto mt-4 max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full [perspective:1000px]"
        aria-label={open ? "Rolni yashirish" : "Rolimni ko'rish"}
      >
        <div
          className={cn(
            "relative h-64 w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            open && "[transform:rotateY(180deg)]",
          )}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-card bg-gradient-to-br from-[#2b1b67] to-primary text-white shadow-soft-lg [backface-visibility:hidden]">
            <span className="text-5xl" aria-hidden>
              🂠
            </span>
            <span className="font-display text-xl font-bold">
              Rolingizni ko&apos;rish uchun bosing
            </span>
            <span className="text-sm text-white/70">Atrofdagilar ko&apos;rmasin!</span>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface p-5 text-foreground shadow-soft-lg [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <span className="text-5xl" aria-hidden>
              {role.emoji}
            </span>
            <span className="font-display text-2xl font-bold">{role.name}</span>
            <span className="text-sm font-medium text-muted">{role.team}</span>
            <span className="text-center text-sm">{role.goal}</span>
            {team.length > 0 && (
              <span className="text-center text-sm text-muted">
                Jamoangiz: {team.map((s) => `${s.seat}-raqam`).join(", ")}
              </span>
            )}
          </div>
        </div>
      </button>
    </section>
  );
}

function SleepingCity({ view }: { view: MafiaView }) {
  return (
    <section className="mafia-enter flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      <div className="text-6xl" aria-hidden>
        🌙
      </div>
      <h2 className="font-display text-2xl font-bold">Shahar uxlayapti…</h2>
      <p className="max-w-xs text-white/70">
        {view.me === null
          ? "Tungi harakatlar sir saqlanadi. Tong otishini kuting."
          : "Ko'zingizni yuming. Tongda nima bo'lganini bilib olasiz."}
      </p>
    </section>
  );
}

function SeatCard({
  seat,
  view,
  member,
  night,
  selectable,
  selected,
  talking,
  onSelect,
}: {
  seat: MafiaSeatView;
  view: MafiaView;
  member: MafiaMemberDTO | undefined;
  night: boolean;
  selectable: boolean;
  selected: boolean;
  talking: boolean;
  onSelect: () => void;
}) {
  const speaking = view.speaker === seat.seat;
  // Nominations only mean something during the day's discussion and vote.
  const dayPhase = ["speech", "voting", "tieSpeech", "liftAllVote"].includes(view.phase);
  const nominated = dayPhase ? view.nominations.findIndex((n) => n.seat === seat.seat) : -1;
  const check = [...view.checks].reverse().find((c) => c.seat === seat.seat);
  const role = seat.role ? ROLE_TEXT[seat.role] : null;
  const mine = seat.seat === view.me;
  const over = view.phase === "gameOver";
  const tied = view.phase === "tieSpeech" && view.ballot.includes(seat.seat);
  const saying = currentSaying(view, seat.seat);
  const checkText =
    check?.result === "red"
      ? "✅ qizil"
      : check?.result === "black"
        ? "❌ qora"
        : check?.result === "sheriff"
          ? "⭐ Sherif!"
          : check
            ? "Sherif emas"
            : null;

  const exit = !seat.alive && seat.exit ? EXIT_TEXT[seat.exit] : null;
  const roleText = role && (over || !mine) ? `${role.emoji} ${role.name}` : null;
  // One main line, most important first; the game-over table shows every role, dead or alive.
  const status = over
    ? roleText
    : (exit ??
      roleText ??
      (tied ? "⚖️ teng ovoz" : nominated >= 0 ? `🗳️ nomzod #${nominated + 1}` : checkText));
  const detail = over ? exit : status !== checkText && seat.alive ? checkText : null;

  return (
    <li>
      <button
        type="button"
        disabled={!selectable}
        onClick={onSelect}
        aria-pressed={selectable ? selected : undefined}
        className={cn(
          "relative flex h-28 w-full flex-col items-center justify-center gap-1 rounded-card border p-2 text-center transition",
          night ? "border-white/10 bg-white/5" : "border-border bg-surface shadow-soft-sm",
          mine && (night ? "border-white/40" : "border-primary"),
          speaking && "ring-2 ring-snap ring-offset-2 ring-offset-transparent",
          talking && "mafia-talking",
          selectable && "cursor-pointer hover:-translate-y-0.5",
          selected && "ring-4 ring-primary",
          !seat.alive && "opacity-45 grayscale",
          !selectable && "cursor-default",
        )}
      >
        <span
          className={cn(
            "absolute top-1.5 left-2 font-mono text-sm font-bold",
            night ? "text-white/60" : "text-muted",
          )}
        >
          {seat.seat}
        </span>
        {speaking && (
          <Mic className="absolute top-2 right-2 size-4 text-snap" aria-label="Gapiryapti" />
        )}
        {seat.fouls > 0 && seat.alive && (
          <span
            className="absolute right-2 bottom-1.5 text-[11px] font-semibold text-amber-600 tabular-nums"
            aria-label={`${seat.fouls} foll`}
          >
            ⚠️{seat.fouls}
          </span>
        )}
        {saying && (
          <span className="mafia-enter absolute inset-x-1 -top-3 z-10 line-clamp-2 rounded-control bg-foreground px-2 py-1 text-xs text-background shadow-soft-md">
            💬 {saying}
          </span>
        )}
        {member ? (
          <Avatar name={member.name} color={member.color} avatar={member.avatar} size="md" />
        ) : (
          <span className="size-9 rounded-full bg-surface-muted" />
        )}
        <span className="max-w-full truncate text-sm font-medium">
          {seat.name}
          {mine && " (siz)"}
        </span>
        <span className={cn("min-h-4 text-xs", night ? "text-white/60" : "text-muted")}>
          {status}
        </span>
        {detail && (
          <span className={cn("text-xs", night ? "text-white/60" : "text-muted")}>{detail}</span>
        )}
      </button>
    </li>
  );
}

/** Morning news, big: who was shot (or nobody) and the best move of the first victim. */
function DawnBanner({ view }: { view: MafiaView }) {
  const nightStart = view.log.map((e) => e.type).lastIndexOf("night");
  const tonight = view.log.slice(nightStart + 1);
  const killed = tonight.find((e) => e.type === "killed");
  const best = tonight.find((e) => e.type === "bestMove");
  const name = (seat: number) => view.seats.find((s) => s.seat === seat)?.name ?? "";
  return (
    <section
      role="status"
      className="mafia-dawn mt-4 rounded-card bg-gradient-to-br from-[#ffb86b] to-[#c2477a] p-6 text-center text-white shadow-soft-lg"
    >
      <div className="text-5xl" aria-hidden>
        {killed ? "🔫" : "🌅"}
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold">
        {killed?.type === "killed"
          ? `Kechasi ${killed.seat}-raqam — ${name(killed.seat)} o'ldirildi`
          : "O'q tegmadi: bu kecha hech kim o'lmadi"}
      </h2>
      {killed && <p className="mt-1 text-white/85">Hozir oxirgi so&apos;zini aytadi.</p>}
      {best?.type === "bestMove" && (
        <p className="mt-3 rounded-control bg-black/15 px-3 py-2 text-sm">
          🎯 Eng yaxshi yurish: {best.seats.map((s) => `${s}-raqam`).join(", ")}
        </p>
      )}
    </section>
  );
}

/** The latest vote of the day as bars, shown from the count until the night starts. */
function VoteTally({ view }: { view: MafiaView }) {
  const lastVotes = view.log.map((e) => e.type).lastIndexOf("votes");
  const lastDay = view.log.map((e) => e.type).lastIndexOf("day");
  const lastNight = view.log.map((e) => e.type).lastIndexOf("night");
  const event = view.log[lastVotes];
  if (!event || event.type !== "votes" || lastVotes < lastDay || lastNight > lastVotes) return null;
  if (view.phase === "gameOver" || view.phase === "voting") return null;
  const voters = event.tally.reduce((sum, t) => sum + t.voters.length, 0) || 1;
  const most = Math.max(...event.tally.map((t) => t.voters.length));
  const name = (seat: number) => view.seats.find((s) => s.seat === seat)?.name ?? "";
  return (
    <section className="mafia-enter mt-4 rounded-card border border-border bg-surface p-4 shadow-soft-sm">
      <h2 className="font-display text-lg font-bold">
        Ovoz natijalari{event.round > 1 ? " (qayta ovoz)" : ""}
      </h2>
      <ol className="mt-3 space-y-2.5">
        {event.tally.map((t) => (
          <li key={t.seat}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                {t.seat}-raqam · {name(t.seat)}
              </span>
              <span className="text-muted tabular-nums">{t.voters.length} ovoz</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={cn(
                  "mafia-bar h-full rounded-full",
                  t.voters.length === most ? "bg-danger" : "bg-primary/60",
                )}
                style={{ width: `${(t.voters.length / voters) * 100}%` }}
              />
            </div>
            {t.voters.length > 0 && (
              <p className="mt-0.5 text-xs text-muted">
                {t.voters.map((v) => `${v}`).join(", ")}-raqamlar
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function GameLog({ view, night }: { view: MafiaView; night: boolean }) {
  const [open, setOpen] = useState(false);
  const events = [...view.log].reverse();
  const shown = open ? events : events.slice(0, 4);
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold">O&apos;yin jurnali</h2>
      <ol className={cn("mt-2 space-y-1 text-sm", night ? "text-white/80" : "text-muted")}>
        {shown.map((event, i) => (
          <li key={events.length - i}>{eventText(event)}</li>
        ))}
      </ol>
      <a
        href="/mafia/qoidalar"
        target="_blank"
        rel="noopener"
        className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
      >
        📖 O&apos;yin qoidalari
      </a>
      {events.length > 4 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm font-medium text-primary"
        >
          {open ? "Qisqartirish" : `Hammasi (${events.length})`}
        </button>
      )}
    </section>
  );
}

const PROMPT: Record<PickAction, string> = {
  nominate: "Kimni nomzod qilib ko'rsatasiz? (ixtiyoriy)",
  vote: "Kimga qarshi ovoz berasiz? Ovoz bermasangiz, ovozingiz oxirgi nomzodga o'tadi.",
  shoot: "Nishonni tanlang. Barcha qoralar bitta o'yinchini tanlasagina o'q tegadi.",
  check: "Kimni tekshirasiz?",
  bestMove: `Qora deb o'ylagan ${BEST_MOVE_SIZE} ta o'yinchini tanlang.`,
};

const CONFIRM: Record<PickAction, string> = {
  nominate: "Nomzod qilish",
  vote: "Ovoz berish",
  shoot: "Otish",
  check: "Tekshirish",
  bestMove: "Tasdiqlash",
};

function ActionPanel({
  view,
  me,
  night,
  action,
  picked,
  error,
  onConfirm,
  onPass,
  onLiftAll,
  onSay,
}: {
  view: MafiaView;
  me: MafiaSeatView | null;
  night: boolean;
  action: PickAction | null;
  picked: number[];
  error: string | null;
  onConfirm: () => void;
  onPass: () => void;
  onLiftAll: (agree: boolean) => void;
  onSay?: (text: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const canPass = view.actions.includes("pass");
  const canLift = view.actions.includes("liftAll");
  const needed = action === "bestMove" ? BEST_MOVE_SIZE : 1;

  let note: string | null = null;
  if (!me) note = "Siz tomoshabinsiz.";
  else if (!me.alive && view.phase !== "gameOver" && !canPass)
    note = "Siz stoldan chiqdingiz: o'yinni tomosha qiling.";
  else if (view.phase === "voting" && view.myVote !== null)
    note = `Ovozingiz qabul qilindi: ${view.myVote}-raqam.`;
  else if (view.phase === "liftAllVote" && view.myVote !== null) note = "Ovozingiz qabul qilindi.";
  else if (canPass && view.phase === "speech" && view.speakerSilenced)
    note = "3 foll: bu daqiqada gapira olmaysiz, faqat nomzod ko'rsatishingiz mumkin.";
  else if (canPass && view.phase === "speech")
    note = "Sizning so'zingiz. Gapirib bo'lgach «Pas» ni bosing.";
  else if (canPass && view.phase === "lastWords") note = "Oxirgi so'zingiz.";
  else if (canPass) note = "Sizning navbatingiz.";
  else if (view.phase === "zeroNight")
    note =
      "Tanishuv tuni: jamoangiz bilan tungi kanalda gaplashib, otish tartibini kelishib oling.";
  else if (view.phase === "dawn" && view.log.length > 0)
    note = eventText(view.log[view.log.length - 1]!);

  const canSay = view.actions.includes("say") && view.phase !== "zeroNight";
  if (!action && !canPass && !canLift && !canSay && !note && !error) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur",
        night ? "border-white/10 bg-[#0e0b1a]/90" : "border-border bg-surface/95 shadow-soft-lg",
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        {action && <p className="text-sm font-medium">{PROMPT[action]}</p>}
        {note && <p className={cn("text-sm", night ? "text-white/75" : "text-muted")}>{note}</p>}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {view.actions.includes("say") && view.phase !== "zeroNight" && onSay && (
          <SayBox dark={night} placeholder="Mikrofon yo'qmi? Shu yerga yozing…" onSay={onSay} />
        )}
        <div className="flex gap-2">
          {action && (
            <button
              type="button"
              disabled={picked.length !== needed}
              onClick={onConfirm}
              className="flex-1 rounded-control bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              {CONFIRM[action]}
              {picked.length > 0 && ` (${picked.join(", ")})`}
            </button>
          )}
          {canLift && (
            <>
              <button
                type="button"
                onClick={() => onLiftAll(true)}
                className="flex-1 rounded-control bg-danger px-4 py-3 font-semibold text-white"
              >
                Ha, chiqsin
              </button>
              <button
                type="button"
                onClick={() => onLiftAll(false)}
                className="flex-1 rounded-control border border-border px-4 py-3 font-semibold"
              >
                Yo&apos;q
              </button>
            </>
          )}
          {canPass && (
            <button
              type="button"
              onClick={onPass}
              className={cn(
                "rounded-control px-5 py-3 font-semibold",
                action ? "border border-border" : "flex-1 bg-snap text-white",
              )}
            >
              Pas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
