/** Today's finished solve, remembered so a reload shows the result instead of a new start. */
export interface DailyDone {
  day: string;
  ms: number;
  submitted: boolean;
}

const KEY = "puzzle:daily:done";

export function loadDailyDone(day: string): DailyDone | null {
  try {
    const raw = localStorage.getItem(KEY);
    const done = raw ? (JSON.parse(raw) as DailyDone) : null;
    return done?.day === day && typeof done.ms === "number" ? done : null;
  } catch {
    return null;
  }
}

export function saveDailyDone(done: DailyDone) {
  try {
    localStorage.setItem(KEY, JSON.stringify(done));
  } catch {
    // ignore
  }
}
