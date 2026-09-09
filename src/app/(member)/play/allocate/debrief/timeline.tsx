import type { TimelinePoint } from "@/lib/runs/debrief-data";
import { formatMonthInIST } from "@/lib/time";

/**
 * Portfolio value across the run, with markers for the months something
 * happened. Scannable rather than analytical: the point is that a player can
 * find March 2020 and see what they did, not that they can read a value off
 * the axis.
 *
 * Plain SVG, server-rendered. A chart library would be a dependency and a
 * client bundle for one static line.
 */
export function Timeline({ points }: { points: readonly TimelinePoint[] }) {
  if (points.length < 2) return null;

  const values = points.map((p) => Number(BigInt(p.valuePaise) / 100n));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 720;
  const height = 180;
  const pad = 8;

  const x = (index: number) =>
    pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) =>
    pad + (1 - (value - min) / span) * (height - pad * 2);

  const line = points
    .map((_, index) => `${x(index)},${y(values[index] ?? min)}`)
    .join(" ");

  return (
    <figure className="mt-4">
      <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="timeline-title timeline-desc"
          className="h-44 w-full min-w-[36rem] text-wows-ink"
        >
          <title id="timeline-title">Portfolio value, month by month</title>
          <desc id="timeline-desc">
            {`Portfolio value across ${points.length} months, from ${points[0]?.date} to ${points[points.length - 1]?.date}. Markers show months in which trades were made, the month of the unplanned expense, and months carrying a news card.`}
          </desc>
          <polyline
            points={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {points.map((point, index) =>
            point.trades > 0 ? (
              <circle
                key={`t-${point.step}`}
                cx={x(index)}
                cy={y(values[index] ?? min)}
                r={2}
                fill="var(--wows-muted)"
              />
            ) : null,
          )}
          {points.map((point, index) =>
            point.shock ? (
              <g key={`s-${point.step}`}>
                <line
                  x1={x(index)}
                  y1={pad}
                  x2={x(index)}
                  y2={height - pad}
                  stroke="var(--wows-accent)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <circle
                  cx={x(index)}
                  cy={y(values[index] ?? min)}
                  r={4}
                  fill="var(--wows-accent)"
                />
              </g>
            ) : null,
          )}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-wows-muted">
        <span>
          <span aria-hidden="true">●</span> a month you traded
        </span>
        <span className="text-wows-accent">
          <span aria-hidden="true">●</span> the unplanned expense
        </span>
        <span>
          {formatMonthInIST(`${points[0]?.date ?? ""}T00:00:00Z`)} to{" "}
          {formatMonthInIST(
            `${points[points.length - 1]?.date ?? ""}T00:00:00Z`,
          )}
        </span>
      </figcaption>
    </figure>
  );
}
