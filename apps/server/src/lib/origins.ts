/**
 * Parses CORS_ORIGINS entries. Exact origins stay strings; entries with `*`
 * become anchored regexes, e.g. `https://davradosh-*-johnkhasan.vercel.app`
 * for Vercel preview deployments. `*` never matches dots or slashes.
 */
export function parseOrigins(origins: string[]): Array<string | RegExp> {
  return origins.map((origin) => {
    if (!origin.includes("*")) return origin;
    const pattern = origin
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[a-z0-9-]+");
    return new RegExp(`^${pattern}$`);
  });
}
