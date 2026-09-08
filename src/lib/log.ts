/**
 * Structured logging with request IDs (CLAUDE.md > Conventions).
 *
 * Every line is one JSON object on stdout (stderr for errors) so Vercel and
 * any log drain can index it. Never log secrets, tokens, or full request
 * bodies. Use `requestLogger()` in server code so the request ID assigned by
 * src/proxy.ts is attached to every line.
 */
import { headers } from "next/headers";
import { REQUEST_ID_HEADER } from "./request-id";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause ? serializeError(value.cause) : undefined,
    };
  }
  return value;
}

function write(
  level: LogLevel,
  base: LogFields,
  message: string,
  fields?: LogFields,
) {
  const entry: LogFields = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...base,
  };
  if (fields) {
    for (const [key, value] of Object.entries(fields))
      entry[key] = serializeError(value);
  }
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export function createLogger(base: LogFields = {}): Logger {
  return {
    debug: (m, f) => write("debug", base, m, f),
    info: (m, f) => write("info", base, m, f),
    warn: (m, f) => write("warn", base, m, f),
    error: (m, f) => write("error", base, m, f),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

/** Logger for the current server request, carrying its request ID. */
export async function requestLogger(fields: LogFields = {}): Promise<Logger> {
  const requestId = (await headers()).get(REQUEST_ID_HEADER) ?? "unknown";
  return createLogger({ requestId, ...fields });
}
