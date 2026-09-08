/**
 * Walks an error's `cause` chain and joins the messages, innermost last.
 * Drizzle wraps driver errors ("Failed query: ...") and keeps the Postgres
 * message in `cause`; matching on the chain avoids depending on that.
 */
export function errorChainMessage(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current instanceof Error && depth < 10) {
    parts.push(current.message);
    current = current.cause;
    depth += 1;
  }
  if (parts.length === 0) parts.push(String(error));
  return parts.join(" <- ");
}
