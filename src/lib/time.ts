/**
 * The single timezone conversion point in the codebase (H33).
 *
 * Rule: store and transport UTC; display IST (Asia/Kolkata, UTC+05:30, no
 * daylight saving). Nothing else in the app may call `toLocale*`,
 * `getTimezoneOffset`, or construct a `Date` from a zone-less string.
 *
 * Output is built from `Intl.DateTimeFormat#formatToParts` rather than a
 * locale's opaque string, so it is byte-identical regardless of the host
 * machine's locale or timezone — CI, Vercel, and a student's laptop agree.
 */

export const DISPLAY_TIME_ZONE = "Asia/Kolkata";
export const DISPLAY_TIME_ZONE_LABEL = "IST";

/** An instant in time: a `Date`, or an ISO 8601 string with an explicit offset. */
export type Instant = Date | string;

/**
 * Matches an ISO 8601 date-time that carries an explicit UTC designator or
 * numeric offset, e.g. `2026-09-08T07:20:00Z` or `2026-09-08T12:50:00+05:30`.
 * A bare `2026-09-08T12:50:00` is rejected: JavaScript would parse it in the
 * host's local zone, which is exactly the ambiguity this module exists to
 * prevent.
 */
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export class InvalidInstantError extends Error {
  constructor(input: unknown) {
    super(`Not a valid UTC instant: ${JSON.stringify(input)}`);
    this.name = "InvalidInstantError";
  }
}

/**
 * Normalises an `Instant` into a `Date`, throwing on anything ambiguous or
 * unparsable. A failed conversion is an error the caller must surface (H34),
 * never a silently-empty string.
 */
export function toDate(instant: Instant): Date {
  if (instant instanceof Date) {
    if (Number.isNaN(instant.getTime())) throw new InvalidInstantError(instant);
    return instant;
  }
  if (typeof instant !== "string" || !ISO_WITH_OFFSET.test(instant)) {
    throw new InvalidInstantError(instant);
  }
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new InvalidInstantError(instant);
  return date;
}

/**
 * Intl is used for exactly one thing: resolving the wall-clock fields of an
 * instant in IST. Every field is read back as a number and formatted by hand,
 * because locale data drifts between ICU releases (day padding, "Sep" versus
 * "Sept", hour cycles) and this output must be byte-identical everywhere.
 */
const istFields = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
}

function numericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const found = parts.find((p) => p.type === type);
  const value = found ? Number.parseInt(found.value, 10) : Number.NaN;
  if (Number.isNaN(value)) {
    throw new Error(`Intl did not return a numeric "${type}" part`);
  }
  return value;
}

/** The IST wall-clock reading of a UTC instant. */
export function toISTWallClock(instant: Instant): WallClock {
  const parts = istFields.formatToParts(toDate(instant));
  return {
    year: numericPart(parts, "year"),
    month: numericPart(parts, "month"),
    day: numericPart(parts, "day"),
    hour: numericPart(parts, "hour") % 24, // some ICU builds emit 24 for midnight
    minute: numericPart(parts, "minute"),
  };
}

const pad2 = (n: number): string => n.toString().padStart(2, "0");

export interface FormatOptions {
  /** Include the wall-clock time. Defaults to `true`. */
  withTime?: boolean;
}

/**
 * Formats a UTC instant for display in IST.
 *
 * @example
 * formatInIST("2026-01-01T00:00:00Z")                    // "1 Jan 2026, 05:30 IST"
 * formatInIST("2026-01-01T00:00:00Z", { withTime: false }) // "1 Jan 2026"
 */
export function formatInIST(
  instant: Instant,
  options: FormatOptions = {},
): string {
  const { withTime = true } = options;
  const wc = toISTWallClock(instant);
  const month = MONTH_ABBREVIATIONS[wc.month - 1];
  if (!month) throw new Error(`Impossible month ${wc.month}`);
  const date = `${wc.day} ${month} ${wc.year}`;
  if (!withTime) return date;
  return `${date}, ${pad2(wc.hour)}:${pad2(wc.minute)} ${DISPLAY_TIME_ZONE_LABEL}`;
}

/**
 * The month an instant falls in, in IST: "March 2020".
 *
 * Narrative copy reads better with a month than with a date. "You sold in
 * March 2020" is a sentence; "you sold in 31 Mar 2020" is a data field with a
 * preposition in front of it. Lives here so that IST conversion still happens
 * in exactly one place (H33).
 */
export function formatMonthInIST(instant: Instant): string {
  const wc = toISTWallClock(instant);
  const month = MONTH_NAMES[wc.month - 1];
  if (!month) throw new Error(`Impossible month ${wc.month}`);
  return `${month} ${wc.year}`;
}
