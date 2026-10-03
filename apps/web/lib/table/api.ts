import { TABLE_GAMES, type TableGameKind } from "@puzzle/shared/games";
import { API_URL } from "../env";

/** Creates a room on the server and returns the page to open (`/shaxmat/abc123`). */
export async function createTableRoom(
  kind: TableGameKind,
  clientId: string,
  options?: unknown,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/table/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, kind, options }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const { id } = (await res.json()) as { id: string };
  return `${TABLE_GAMES[kind].path}/${id}`;
}
