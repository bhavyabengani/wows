import type { ReactNode } from "react";
import { cn } from "cn";
import { formatBps, formatINR } from "@/lib/format";
import { formatInIST } from "@/lib/time";

/**
 * Small presentational primitives for the design preview. Throwaway, but
 * they follow CLAUDE.md > Design direction so later phases can borrow them.
 */

/** Page title block: one h1, optional lede. No eyebrow labels. */
export function PageHeader({
  title,
  lede,
  aside,
}: {
  title: string;
  lede?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[32px] leading-[1.05] font-bold tracking-tight text-wows-ink sm:text-[40px]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-wows-muted">
            {lede}
          </p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/** A titled region separated by rules, not a floating card. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-wows-rule pt-4", className)}>
      {title ? (
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-wows-ink">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Raised surface for content that needs to read as a distinct object (a form, a debrief). */
export function Panel({
  children,
  className,
  tone = "surface",
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "accent";
}) {
  return (
    <div
      className={cn(
        "border p-4 sm:p-5",
        tone === "surface" && "border-wows-rule bg-wows-surface",
        tone === "accent" &&
          "border-wows-rule border-l-[3px] border-l-wows-accent bg-wows-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A gain or loss. Colour is never the only signal: an explicit sign and an
 * arrow always accompany it (H38). Zero is neutral.
 */
export function SignedFigure({
  paise,
  bps,
  className,
}: {
  paise?: bigint;
  bps?: number;
  className?: string;
}) {
  const sign =
    paise !== undefined
      ? paise > 0n
        ? 1
        : paise < 0n
          ? -1
          : 0
      : bps !== undefined
        ? Math.sign(bps)
        : 0;
  const text =
    paise !== undefined
      ? formatINR(paise, { sign: true })
      : bps !== undefined
        ? formatBps(bps, { sign: true })
        : "";
  const arrow = sign > 0 ? "▲" : sign < 0 ? "▼" : "—";
  const tone =
    sign > 0
      ? "text-wows-positive"
      : sign < 0
        ? "text-wows-accent"
        : "text-wows-muted";
  const label = sign > 0 ? "up" : sign < 0 ? "down" : "unchanged";
  return (
    <span className={cn("numeric whitespace-nowrap", tone, className)}>
      <span aria-hidden="true">{arrow} </span>
      <span className="sr-only">{label} </span>
      {text}
    </span>
  );
}

export function Money({
  paise,
  className,
}: {
  paise: bigint;
  className?: string;
}) {
  return (
    <span className={cn("numeric whitespace-nowrap", className)}>
      {formatINR(paise)}
    </span>
  );
}

export function When({
  iso,
  withTime = true,
  className,
}: {
  iso: string;
  withTime?: boolean;
  className?: string;
}) {
  return (
    <time dateTime={iso} className={cn("numeric whitespace-nowrap", className)}>
      {formatInIST(iso, { withTime })}
    </time>
  );
}

/** Status chip. Tone by treatment, not by a rainbow. */
export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "warn";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "border-wows-rule bg-wows-paper text-wows-muted",
        tone === "accent" &&
          "border-wows-accent bg-wows-accent text-wows-surface",
        tone === "positive" &&
          "border-wows-positive/40 bg-wows-surface text-wows-positive",
        tone === "warn" &&
          "border-wows-accent/40 bg-wows-surface text-wows-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center bg-wows-accent px-4 py-2 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center border border-wows-ink px-4 py-2 text-sm font-semibold text-wows-ink hover:bg-wows-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft disabled:opacity-50",
  quiet:
    "inline-flex items-center justify-center px-1 py-1 text-sm font-medium text-wows-accent underline decoration-wows-accent/40 underline-offset-4 hover:decoration-wows-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft",
};

/** Table wrapper: scrolls horizontally on narrow screens, never the page. */
export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}
    >
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export const th =
  "py-2 pr-4 text-left text-xs font-medium text-wows-muted border-b border-wows-rule";
export const thNum = cn(th, "text-right pr-0 pl-4");
export const td =
  "py-2.5 pr-4 align-top text-wows-ink border-b border-wows-rule";
export const tdNum = cn(td, "numeric text-right pr-0 pl-4 whitespace-nowrap");

/** Definition list in two columns for metadata blocks. */
export function Meta({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-wows-muted">{it.label}</dt>
          <dd className="text-wows-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The in-simulation educational disclaimer. Sits inside every simulation screen. */
export function SimulationDisclaimer() {
  return (
    <p
      role="note"
      className="border-l-2 border-wows-rule pl-3 text-[12.5px] leading-relaxed text-wows-muted"
    >
      Simulation. Historical replay on a pinned data snapshot; no real money, no
      live prices, and nothing here is advice. You are being assessed on your
      reasoning, not your returns.
    </p>
  );
}

/** Oxblood left rule; for the one thing on the page that must be read. */
export function Callout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-l-[3px] border-wows-accent pl-4", className)}>
      {children}
    </div>
  );
}

/**
 * A number as the subject of the page: rupees at display size, paise at
 * caption size and lower weight, all in the numeric face.
 */
export function DisplayMoney({
  paise,
  className,
  size = "lg",
}: {
  paise: bigint;
  className?: string;
  size?: "lg" | "md";
}) {
  const text = formatINR(paise);
  const dot = text.lastIndexOf(".");
  const whole = text.slice(0, dot);
  const frac = text.slice(dot);
  return (
    <span
      className={cn(
        "numeric font-medium tracking-tight text-wows-ink",
        size === "lg"
          ? "text-[40px] leading-none sm:text-[48px]"
          : "text-[28px] leading-none",
        className,
      )}
    >
      {whole}
      <span className="text-[0.5em] font-normal text-wows-muted">{frac}</span>
    </span>
  );
}

/** Inline sparkline: the shape of a series, ink-coloured, no axes. */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  className,
  tone = "ink",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "ink" | "muted" | "accent" | "positive";
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1]!;
  const stroke =
    tone === "accent"
      ? "var(--wows-accent)"
      : tone === "positive"
        ? "var(--wows-positive)"
        : tone === "muted"
          ? "var(--wows-muted)"
          : "var(--wows-ink)";
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible", className)}
    >
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={1.75} fill={stroke} />
    </svg>
  );
}

/** Timestep strip: one tick per step, the current one filled oxblood. */
export function StepStrip({
  steps,
  current,
  className,
}: {
  steps: number;
  current: number;
  className?: string;
}) {
  return (
    <ol
      className={cn("flex items-end gap-[3px]", className)}
      aria-label={`Step ${current} of ${steps}`}
    >
      {Array.from({ length: steps }, (_, i) => i + 1).map((n) => (
        <li
          key={n}
          aria-current={n === current ? "step" : undefined}
          className={cn(
            "h-3 w-1.5 transition-colors duration-300",
            n < current && "bg-wows-ink/35",
            n === current && "h-4 bg-wows-accent",
            n > current && "bg-wows-rule",
          )}
        />
      ))}
    </ol>
  );
}
