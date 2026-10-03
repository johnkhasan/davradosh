import { permanentRedirect } from "next/navigation";

// Race rooms live under /puzzle/poyga/{id}; the mode itself is described on the puzzle page.
export default function RacePage() {
  permanentRedirect("/puzzle#poyga");
}
