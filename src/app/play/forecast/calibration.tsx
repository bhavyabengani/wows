import { Section } from "@/components/preview/ui";
import { calibration } from "@/preview-data";

/** Reliability curve, plain SVG. Diagonal is perfect calibration. */
export function CalibrationView() {
  const size = 260;
  const pad = 32;
  const inner = size - pad * 2;
  const x = (p: number) => pad + (p / 100) * inner;
  const y = (p: number) => pad + inner - (p / 100) * inner;
  const points = calibration.bins
    .map((b) => `${x(b.predicted)},${y(b.actual)}`)
    .join(" ");

  return (
    <Section title="Your calibration">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-wows-muted">Brier score</p>
          <p className="numeric text-xl font-semibold text-wows-ink">
            {calibration.brier}
          </p>
        </div>
        <div>
          <p className="text-xs text-wows-muted">Club median</p>
          <p className="numeric text-xl text-wows-ink">
            {calibration.clubMedianBrier}
          </p>
        </div>
        <div>
          <p className="text-xs text-wows-muted">Resolved</p>
          <p className="numeric text-xl text-wows-ink">
            {calibration.resolved}
          </p>
        </div>
      </div>
      <figure className="mt-4">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-labelledby="cal-title cal-desc"
          className="w-full max-w-sm text-wows-ink"
        >
          <title id="cal-title">Reliability curve</title>
          <desc id="cal-desc">
            Predicted probability against the share of questions that resolved
            yes, in five bins. Points near the diagonal are well calibrated.
          </desc>
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(100)}
            y2={y(100)}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="1 3"
            strokeLinecap="round"
          />
          {[0, 25, 50, 75, 100].map((t) => (
            <g
              key={t}
              className="numeric"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.6}
            >
              <text x={x(t)} y={size - pad + 16} textAnchor="middle">
                {t}
              </text>
              <text x={pad - 8} y={y(t) + 3} textAnchor="end">
                {t}
              </text>
              <line
                x1={x(t)}
                y1={y(0)}
                x2={x(t)}
                y2={y(0) + 4}
                stroke="currentColor"
                strokeOpacity={0.4}
              />
              <line
                x1={x(0) - 4}
                y1={y(t)}
                x2={x(0)}
                y2={y(t)}
                stroke="currentColor"
                strokeOpacity={0.4}
              />
            </g>
          ))}
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(100)}
            y2={y(0)}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(0)}
            y2={y(100)}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <polyline
            points={points}
            fill="none"
            stroke="var(--wows-accent)"
            strokeWidth={1.5}
          />
          {calibration.bins.map((b) => (
            <g key={b.predicted}>
              <circle
                cx={x(b.predicted)}
                cy={y(b.actual)}
                r={3 + b.n}
                fill="var(--wows-accent)"
                fillOpacity={0.9}
              />
              <title>{`Said ${b.predicted}%: ${b.actual}% resolved yes (${b.n} question${b.n === 1 ? "" : "s"})`}</title>
            </g>
          ))}
          <text
            x={size / 2}
            y={size - 4}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.7}
          >
            What you said (%)
          </text>
          <text
            x={10}
            y={size / 2}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.7}
            transform={`rotate(-90 10 ${size / 2})`}
          >
            What happened (%)
          </text>
        </svg>
        <figcaption className="mt-1 text-xs text-wows-muted">
          Dot size is the number of questions in the bin. Above the line you
          were underconfident; below it, overconfident.
        </figcaption>
      </figure>
      <table className="numeric mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-wows-muted">
            <th scope="col" className="py-1 font-medium">
              Said
            </th>
            <th scope="col" className="py-1 font-medium">
              Happened
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              n
            </th>
          </tr>
        </thead>
        <tbody className="text-wows-ink">
          {calibration.bins.map((b) => (
            <tr key={b.predicted} className="border-t border-wows-rule">
              <td className="py-1">{b.predicted}%</td>
              <td className="py-1">{b.actual}%</td>
              <td className="py-1 text-right">{b.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
