/**
 * DESIGN PREVIEW — sample data only. Everything the preview pages render
 * comes from this file so it can be deleted in one step. Names are invented;
 * figures are illustrative and not analysis. Money is integer paise (bigint).
 */

export const PREVIEW_BANNER = "Design preview — all figures are sample data.";

export const previewUser = {
  name: "Meera Iyer",
  initials: "MI",
  cohort: "UG 2027",
  vertical: "Equities",
  role: "member",
  email: "meera.iyer_ug27@ashoka.edu.in",
};

export const season = {
  name: "Monsoon 2026",
  startsAt: "2026-08-24T00:00:00Z",
  endsAt: "2026-12-04T00:00:00Z",
  week: 3,
  weeks: 15,
};

// ---------------------------------------------------------------------------
// Members and leaderboards
// ---------------------------------------------------------------------------

export interface Member {
  id: string;
  name: string;
  cohort: string;
  vertical: "Equities" | "Macro & Fixed Income" | "Quant";
}

export const members: Member[] = [
  { id: "m01", name: "Aarav Mehta", cohort: "UG 2026", vertical: "Equities" },
  { id: "m02", name: "Diya Raghunathan", cohort: "UG 2027", vertical: "Quant" },
  {
    id: "m03",
    name: "Kabir Sethi",
    cohort: "UG 2026",
    vertical: "Macro & Fixed Income",
  },
  { id: "m04", name: "Meera Iyer", cohort: "UG 2027", vertical: "Equities" },
  {
    id: "m05",
    name: "Rohan Chatterjee",
    cohort: "UG 2027",
    vertical: "Equities",
  },
  { id: "m06", name: "Sara Qureshi", cohort: "UG 2026", vertical: "Quant" },
  {
    id: "m07",
    name: "Vihaan Nair",
    cohort: "UG 2027",
    vertical: "Macro & Fixed Income",
  },
  { id: "m08", name: "Ananya Bose", cohort: "UG 2026", vertical: "Equities" },
  { id: "m09", name: "Ishaan Kapoor", cohort: "UG 2027", vertical: "Quant" },
  {
    id: "m10",
    name: "Zara Fernandes",
    cohort: "UG 2027",
    vertical: "Macro & Fixed Income",
  },
  { id: "m11", name: "Arjun Menon", cohort: "UG 2026", vertical: "Equities" },
  { id: "m12", name: "Nisha Pillai", cohort: "UG 2027", vertical: "Quant" },
  {
    id: "m13",
    name: "Dev Malhotra",
    cohort: "UG 2026",
    vertical: "Macro & Fixed Income",
  },
  { id: "m14", name: "Tara Banerjee", cohort: "UG 2027", vertical: "Equities" },
  { id: "m15", name: "Yash Agarwal", cohort: "UG 2027", vertical: "Quant" },
];

export const memberById = (id: string): Member => {
  const m = members.find((x) => x.id === id);
  if (!m) throw new Error(`preview member ${id}`);
  return m;
};

export type TrackKey =
  "calibration" | "research" | "risk" | "scenario" | "contribution" | "overall";

export interface TrackInfo {
  key: TrackKey;
  label: string;
  /** How the rank is computed, in one paragraph. */
  method: string;
  minimum: string;
  updatedAt: string;
  valueLabel: string;
  /** Overall only: the openly shown weights. */
  weights?: { track: TrackKey; label: string; weight: number }[];
}

export const trackInfo: TrackInfo[] = [
  {
    key: "calibration",
    label: "Calibration",
    method:
      "Ranked by Brier score across every resolved forecast question this season (lower is better), with a small-sample shrinkage toward the club median so three lucky calls cannot top the table. Confidence is rewarded only when it is earned: a 90% forecast that resolves the other way costs far more than a 60% one.",
    minimum: "Minimum 8 resolved forecasts to be ranked.",
    updatedAt: "2026-09-08T03:00:00Z",
    valueLabel: "Brier",
  },
  {
    key: "research",
    label: "Research",
    method:
      "Sum of rubric scores on published research notes, reviewed by a vertical lead and a second reviewer. The rubric scores reasoning, evidence, an explicit falsifier and clarity; it never scores whether the stock went up.",
    minimum: "Minimum 1 published note.",
    updatedAt: "2026-09-08T03:00:00Z",
    valueLabel: "Rubric pts",
  },
  {
    key: "risk",
    label: "Risk-adjusted",
    method:
      "Season-portfolio return divided by realised volatility of daily marks (a simple Sharpe-style ratio), computed from the ledger, not from self-reported values. A concentrated position that happened to work is penalised by the volatility it carried.",
    minimum: "Minimum 4 weeks of open positions.",
    updatedAt: "2026-09-08T03:00:00Z",
    valueLabel: "Ratio",
  },
  {
    key: "scenario",
    label: "Scenario",
    method:
      "Allocation-game score for the pinned scenario version: final corpus relative to the two counterfactuals (did nothing, all index), plus a decision-quality component from the debrief. Everyone plays the same replay from the same seed.",
    minimum: "Completed run required.",
    updatedAt: "2026-09-07T18:30:00Z",
    valueLabel: "Score",
  },
  {
    key: "contribution",
    label: "Contribution",
    method:
      "Reviews written, sessions run, curriculum modules authored and events attended, each with a fixed point value set by core at the start of the season. Points are recorded in the audit log with the action that earned them.",
    minimum: "No minimum.",
    updatedAt: "2026-09-08T03:00:00Z",
    valueLabel: "Points",
  },
  {
    key: "overall",
    label: "Overall",
    method:
      "A weighted blend of the five tracks after normalising each to a 0–100 scale within the season. The weights are fixed for the season and shown below; the blend is only as opaque as its parts, and each part is explainable on its own tab.",
    minimum:
      "Ranked only on tracks where the member meets that track's minimum.",
    updatedAt: "2026-09-08T03:00:00Z",
    valueLabel: "Index",
    weights: [
      { track: "calibration", label: "Calibration", weight: 30 },
      { track: "research", label: "Research", weight: 25 },
      { track: "risk", label: "Risk-adjusted", weight: 15 },
      { track: "scenario", label: "Scenario", weight: 15 },
      { track: "contribution", label: "Contribution", weight: 15 },
    ],
  },
];

/** Deterministic six-point sample series for sparklines; not real data. */
export function sampleSeries(
  seed: number,
  base: number,
  spread: number,
): number[] {
  let x = (seed * 9301 + 49297) % 233280;
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < 8; i += 1) {
    x = (x * 9301 + 49297) % 233280;
    v += (x / 233280 - 0.5) * spread;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

export interface LeaderboardRow {
  memberId: string;
  rank: number;
  /** Display value for the track. */
  value: string;
  /** Change in rank since last update; 0 for none. */
  delta: number;
  /** The components behind the number (H23). */
  components: { label: string; value: string; note?: string }[];
}

const brier = (
  score: string,
  n: number,
  resolved: number,
  shrink: string,
): LeaderboardRow["components"] => [
  {
    label: "Raw Brier",
    value: score,
    note: `over ${resolved} resolved questions`,
  },
  { label: "Forecasts made", value: String(n) },
  {
    label: "Shrinkage applied",
    value: shrink,
    note: "toward club median 0.245",
  },
  {
    label: "Tie-break",
    value: "more resolved forecasts, then earlier join date",
  },
];

export const leaderboards: Record<TrackKey, LeaderboardRow[]> = {
  calibration: [
    {
      memberId: "m06",
      rank: 1,
      value: "0.164",
      delta: 1,
      components: brier("0.158", 14, 12, "+0.006"),
    },
    {
      memberId: "m02",
      rank: 2,
      value: "0.171",
      delta: -1,
      components: brier("0.169", 13, 11, "+0.002"),
    },
    {
      memberId: "m04",
      rank: 3,
      value: "0.183",
      delta: 2,
      components: brier("0.176", 12, 10, "+0.007"),
    },
    {
      memberId: "m13",
      rank: 4,
      value: "0.190",
      delta: 0,
      components: brier("0.190", 15, 12, "0.000"),
    },
    {
      memberId: "m01",
      rank: 5,
      value: "0.197",
      delta: -2,
      components: brier("0.195", 12, 11, "+0.002"),
    },
    {
      memberId: "m09",
      rank: 6,
      value: "0.204",
      delta: 0,
      components: brier("0.198", 10, 9, "+0.006"),
    },
    {
      memberId: "m03",
      rank: 7,
      value: "0.211",
      delta: 3,
      components: brier("0.211", 14, 12, "0.000"),
    },
    {
      memberId: "m10",
      rank: 8,
      value: "0.218",
      delta: -1,
      components: brier("0.214", 11, 9, "+0.004"),
    },
    {
      memberId: "m08",
      rank: 9,
      value: "0.226",
      delta: 0,
      components: brier("0.226", 13, 12, "0.000"),
    },
    {
      memberId: "m12",
      rank: 10,
      value: "0.233",
      delta: -2,
      components: brier("0.229", 9, 8, "+0.004"),
    },
    {
      memberId: "m05",
      rank: 11,
      value: "0.241",
      delta: 0,
      components: brier("0.241", 12, 10, "0.000"),
    },
    {
      memberId: "m07",
      rank: 12,
      value: "0.252",
      delta: 1,
      components: brier("0.247", 10, 8, "+0.005"),
    },
    {
      memberId: "m14",
      rank: 13,
      value: "0.263",
      delta: -1,
      components: brier("0.263", 11, 9, "0.000"),
    },
    {
      memberId: "m11",
      rank: 14,
      value: "0.279",
      delta: 0,
      components: brier("0.279", 9, 8, "0.000"),
    },
    {
      memberId: "m15",
      rank: 15,
      value: "0.301",
      delta: 0,
      components: brier("0.290", 8, 8, "+0.011"),
    },
  ],
  research: [
    {
      memberId: "m08",
      rank: 1,
      value: "47",
      delta: 0,
      components: [
        { label: "Notes published", value: "3" },
        { label: "Reasoning", value: "14 / 15" },
        { label: "Evidence", value: "12 / 15" },
        { label: "Falsifier", value: "13 / 15" },
        { label: "Clarity", value: "8 / 10" },
      ],
    },
    {
      memberId: "m03",
      rank: 2,
      value: "41",
      delta: 1,
      components: [
        { label: "Notes published", value: "2" },
        { label: "Reasoning", value: "13 / 15" },
        { label: "Evidence", value: "11 / 15" },
        { label: "Falsifier", value: "10 / 15" },
        { label: "Clarity", value: "7 / 10" },
      ],
    },
    {
      memberId: "m04",
      rank: 3,
      value: "38",
      delta: -1,
      components: [
        { label: "Notes published", value: "2" },
        { label: "Reasoning", value: "12 / 15" },
        { label: "Evidence", value: "10 / 15" },
        { label: "Falsifier", value: "9 / 15" },
        { label: "Clarity", value: "7 / 10" },
      ],
    },
    {
      memberId: "m01",
      rank: 4,
      value: "35",
      delta: 0,
      components: [
        { label: "Notes published", value: "2" },
        { label: "Reasoning", value: "11 / 15" },
        { label: "Evidence", value: "9 / 15" },
        { label: "Falsifier", value: "9 / 15" },
        { label: "Clarity", value: "6 / 10" },
      ],
    },
    {
      memberId: "m11",
      rank: 5,
      value: "30",
      delta: 2,
      components: [
        { label: "Notes published", value: "1" },
        { label: "Reasoning", value: "12 / 15" },
        { label: "Evidence", value: "8 / 15" },
        { label: "Falsifier", value: "6 / 15" },
        { label: "Clarity", value: "4 / 10" },
      ],
    },
    {
      memberId: "m14",
      rank: 6,
      value: "28",
      delta: 0,
      components: [
        { label: "Notes published", value: "1" },
        { label: "Reasoning", value: "10 / 15" },
        { label: "Evidence", value: "8 / 15" },
        { label: "Falsifier", value: "6 / 15" },
        { label: "Clarity", value: "4 / 10" },
      ],
    },
    {
      memberId: "m07",
      rank: 7,
      value: "26",
      delta: -1,
      components: [
        { label: "Notes published", value: "1" },
        { label: "Reasoning", value: "9 / 15" },
        { label: "Evidence", value: "8 / 15" },
        { label: "Falsifier", value: "5 / 15" },
        { label: "Clarity", value: "4 / 10" },
      ],
    },
    {
      memberId: "m13",
      rank: 8,
      value: "24",
      delta: 0,
      components: [
        { label: "Notes published", value: "1" },
        { label: "Reasoning", value: "9 / 15" },
        { label: "Evidence", value: "7 / 15" },
        { label: "Falsifier", value: "4 / 15" },
        { label: "Clarity", value: "4 / 10" },
      ],
    },
  ],
  risk: [
    {
      memberId: "m13",
      rank: 1,
      value: "1.42",
      delta: 0,
      components: [
        { label: "Season return", value: "+4.10%" },
        { label: "Realised volatility", value: "2.89%" },
        { label: "Open weeks", value: "3" },
        { label: "Largest position", value: "22% of book" },
      ],
    },
    {
      memberId: "m04",
      rank: 2,
      value: "1.18",
      delta: 2,
      components: [
        { label: "Season return", value: "+3.62%" },
        { label: "Realised volatility", value: "3.07%" },
        { label: "Open weeks", value: "3" },
        { label: "Largest position", value: "31% of book" },
      ],
    },
    {
      memberId: "m01",
      rank: 3,
      value: "0.97",
      delta: -1,
      components: [
        { label: "Season return", value: "+5.20%" },
        { label: "Realised volatility", value: "5.36%" },
        { label: "Open weeks", value: "3" },
        { label: "Largest position", value: "48% of book" },
      ],
    },
    {
      memberId: "m08",
      rank: 4,
      value: "0.71",
      delta: -1,
      components: [
        { label: "Season return", value: "+1.90%" },
        { label: "Realised volatility", value: "2.68%" },
        { label: "Open weeks", value: "3" },
        { label: "Largest position", value: "19% of book" },
      ],
    },
    {
      memberId: "m03",
      rank: 5,
      value: "0.33",
      delta: 0,
      components: [
        { label: "Season return", value: "+0.80%" },
        { label: "Realised volatility", value: "2.42%" },
        { label: "Open weeks", value: "3" },
        { label: "Largest position", value: "25% of book" },
      ],
    },
    {
      memberId: "m05",
      rank: 6,
      value: "−0.41",
      delta: 0,
      components: [
        { label: "Season return", value: "−2.30%" },
        { label: "Realised volatility", value: "5.61%" },
        { label: "Open weeks", value: "3" },
        { label: "Largest position", value: "55% of book" },
      ],
    },
  ],
  scenario: [
    {
      memberId: "m02",
      rank: 1,
      value: "82",
      delta: 0,
      components: [
        { label: "Final corpus vs did-nothing", value: "+6.4%" },
        { label: "Final corpus vs all-index", value: "+1.1%" },
        { label: "Decision quality", value: "31 / 40" },
        { label: "Scenario", value: "2024 H1 replay v3" },
      ],
    },
    {
      memberId: "m06",
      rank: 2,
      value: "79",
      delta: 1,
      components: [
        { label: "Final corpus vs did-nothing", value: "+5.9%" },
        { label: "Final corpus vs all-index", value: "+0.6%" },
        { label: "Decision quality", value: "30 / 40" },
        { label: "Scenario", value: "2024 H1 replay v3" },
      ],
    },
    {
      memberId: "m04",
      rank: 3,
      value: "74",
      delta: -1,
      components: [
        { label: "Final corpus vs did-nothing", value: "+4.2%" },
        { label: "Final corpus vs all-index", value: "−1.1%" },
        { label: "Decision quality", value: "32 / 40" },
        { label: "Scenario", value: "2024 H1 replay v3" },
      ],
    },
    {
      memberId: "m09",
      rank: 4,
      value: "70",
      delta: 0,
      components: [
        { label: "Final corpus vs did-nothing", value: "+3.8%" },
        { label: "Final corpus vs all-index", value: "−1.5%" },
        { label: "Decision quality", value: "29 / 40" },
        { label: "Scenario", value: "2024 H1 replay v3" },
      ],
    },
    {
      memberId: "m12",
      rank: 5,
      value: "66",
      delta: 2,
      components: [
        { label: "Final corpus vs did-nothing", value: "+2.1%" },
        { label: "Final corpus vs all-index", value: "−3.2%" },
        { label: "Decision quality", value: "30 / 40" },
        { label: "Scenario", value: "2024 H1 replay v3" },
      ],
    },
    {
      memberId: "m15",
      rank: 6,
      value: "58",
      delta: -1,
      components: [
        { label: "Final corpus vs did-nothing", value: "−0.4%" },
        { label: "Final corpus vs all-index", value: "−5.7%" },
        { label: "Decision quality", value: "26 / 40" },
        { label: "Scenario", value: "2024 H1 replay v3" },
      ],
    },
  ],
  contribution: [
    {
      memberId: "m01",
      rank: 1,
      value: "64",
      delta: 0,
      components: [
        { label: "Reviews written", value: "6 × 5" },
        { label: "Sessions run", value: "2 × 10" },
        { label: "Modules authored", value: "1 × 8" },
        { label: "Events attended", value: "6 × 1" },
      ],
    },
    {
      memberId: "m03",
      rank: 2,
      value: "52",
      delta: 0,
      components: [
        { label: "Reviews written", value: "4 × 5" },
        { label: "Sessions run", value: "2 × 10" },
        { label: "Modules authored", value: "1 × 8" },
        { label: "Events attended", value: "4 × 1" },
      ],
    },
    {
      memberId: "m02",
      rank: 3,
      value: "41",
      delta: 1,
      components: [
        { label: "Reviews written", value: "5 × 5" },
        { label: "Sessions run", value: "1 × 10" },
        { label: "Modules authored", value: "0 × 8" },
        { label: "Events attended", value: "6 × 1" },
      ],
    },
    {
      memberId: "m08",
      rank: 4,
      value: "33",
      delta: -1,
      components: [
        { label: "Reviews written", value: "3 × 5" },
        { label: "Sessions run", value: "1 × 10" },
        { label: "Modules authored", value: "1 × 8" },
        { label: "Events attended", value: "0 × 1" },
      ],
    },
    {
      memberId: "m04",
      rank: 5,
      value: "21",
      delta: 0,
      components: [
        { label: "Reviews written", value: "3 × 5" },
        { label: "Sessions run", value: "0 × 10" },
        { label: "Modules authored", value: "0 × 8" },
        { label: "Events attended", value: "6 × 1" },
      ],
    },
    {
      memberId: "m06",
      rank: 6,
      value: "19",
      delta: 0,
      components: [
        { label: "Reviews written", value: "2 × 5" },
        { label: "Sessions run", value: "0 × 10" },
        { label: "Modules authored", value: "1 × 8" },
        { label: "Events attended", value: "1 × 1" },
      ],
    },
  ],
  overall: [
    {
      memberId: "m04",
      rank: 1,
      value: "78.4",
      delta: 2,
      components: [
        { label: "Calibration", value: "88 × 0.30 = 26.4" },
        { label: "Research", value: "81 × 0.25 = 20.3" },
        { label: "Risk-adjusted", value: "83 × 0.15 = 12.5" },
        { label: "Scenario", value: "90 × 0.15 = 13.5" },
        { label: "Contribution", value: "38 × 0.15 = 5.7" },
      ],
    },
    {
      memberId: "m01",
      rank: 2,
      value: "76.9",
      delta: -1,
      components: [
        { label: "Calibration", value: "80 × 0.30 = 24.0" },
        { label: "Research", value: "74 × 0.25 = 18.5" },
        { label: "Risk-adjusted", value: "68 × 0.15 = 10.2" },
        { label: "Scenario", value: "61 × 0.15 = 9.2" },
        { label: "Contribution", value: "100 × 0.15 = 15.0" },
      ],
    },
    {
      memberId: "m06",
      rank: 3,
      value: "74.1",
      delta: -1,
      components: [
        { label: "Calibration", value: "100 × 0.30 = 30.0" },
        { label: "Research", value: "40 × 0.25 = 10.0" },
        { label: "Risk-adjusted", value: "n/a (min. not met)" },
        { label: "Scenario", value: "96 × 0.15 = 14.4" },
        { label: "Contribution", value: "30 × 0.15 = 4.5" },
      ],
    },
    {
      memberId: "m03",
      rank: 4,
      value: "70.2",
      delta: 0,
      components: [
        { label: "Calibration", value: "72 × 0.30 = 21.6" },
        { label: "Research", value: "87 × 0.25 = 21.8" },
        { label: "Risk-adjusted", value: "23 × 0.15 = 3.5" },
        { label: "Scenario", value: "n/a (no run)" },
        { label: "Contribution", value: "81 × 0.15 = 12.2" },
      ],
    },
    {
      memberId: "m02",
      rank: 5,
      value: "69.8",
      delta: 0,
      components: [
        { label: "Calibration", value: "95 × 0.30 = 28.5" },
        { label: "Research", value: "n/a (min. not met)" },
        { label: "Risk-adjusted", value: "n/a (min. not met)" },
        { label: "Scenario", value: "100 × 0.15 = 15.0" },
        { label: "Contribution", value: "64 × 0.15 = 9.6" },
      ],
    },
    {
      memberId: "m08",
      rank: 6,
      value: "66.3",
      delta: 0,
      components: [
        { label: "Calibration", value: "56 × 0.30 = 16.8" },
        { label: "Research", value: "100 × 0.25 = 25.0" },
        { label: "Risk-adjusted", value: "50 × 0.15 = 7.5" },
        { label: "Scenario", value: "n/a (no run)" },
        { label: "Contribution", value: "52 × 0.15 = 7.8" },
      ],
    },
    {
      memberId: "m13",
      rank: 7,
      value: "61.0",
      delta: 1,
      components: [
        { label: "Calibration", value: "84 × 0.30 = 25.2" },
        { label: "Research", value: "51 × 0.25 = 12.8" },
        { label: "Risk-adjusted", value: "100 × 0.15 = 15.0" },
        { label: "Scenario", value: "n/a (no run)" },
        { label: "Contribution", value: "n/a (0 pts)" },
      ],
    },
    {
      memberId: "m09",
      rank: 8,
      value: "52.7",
      delta: -1,
      components: [
        { label: "Calibration", value: "76 × 0.30 = 22.8" },
        { label: "Research", value: "n/a" },
        { label: "Risk-adjusted", value: "n/a" },
        { label: "Scenario", value: "85 × 0.15 = 12.8" },
        { label: "Contribution", value: "n/a" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Landing specimens
// ---------------------------------------------------------------------------

export const landing = {
  functions: [
    {
      title: "Play a historical replay",
      figure: "26",
      unit: "weekly steps in a season replay",
      body: "Allocate a student-sized corpus across index, large-caps, gilts, gold and FDs, one week at a time, through a real stretch of market history. The debrief compares you with doing nothing and with the index.",
    },
    {
      title: "Forecast, and learn how calibrated you are",
      figure: "0.183",
      unit: "a good Brier score after ten questions",
      body: "Answer observable questions with a probability. When they resolve you are scored on calibration, never on whether you called the market.",
    },
    {
      title: "Write research that gets reviewed",
      figure: "150",
      unit: "words minimum, with a falsifier",
      body: "A thesis, a key risk, a falsifier and sources. A vertical lead and a second reviewer score the reasoning. Published notes carry the club's disclaimer.",
    },
    {
      title: "Learn in tracks, meet in person",
      figure: "12",
      unit: "modules across three tracks",
      body: "Foundations, Applied Analysis and Quant, approved by the faculty advisor, plus workshops, guest talks and sessions with RSVPs.",
    },
  ],
  masthead: {
    faculty:
      "Faculty advisor: Department of Economics. Reviews all published curriculum; reads everything; approves nothing that reads as advice.",
    policy:
      "No real money at any stage. No buy, sell or hold recommendations under the club's name. No top picks, no copy-trading, no visible open positions. Everything on this portal is for education only.",
  },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboard = {
  standings: [
    {
      track: "Calibration",
      rank: 3,
      of: 15,
      value: "0.183",
      unit: "Brier",
      delta: 2,
      series: [0.231, 0.224, 0.219, 0.205, 0.198, 0.191, 0.187, 0.183],
    },
    {
      track: "Research",
      rank: 3,
      of: 8,
      value: "38",
      unit: "pts",
      delta: -1,
      series: [0, 0, 14, 14, 26, 26, 38, 38],
    },
    {
      track: "Risk-adjusted",
      rank: 2,
      of: 6,
      value: "1.18",
      unit: "ratio",
      delta: 2,
      series: [0.4, 0.62, 0.55, 0.9, 1.02, 0.97, 1.11, 1.18],
    },
    {
      track: "Scenario",
      rank: 3,
      of: 6,
      value: "74",
      unit: "score",
      delta: -1,
      series: [74, 74, 74, 74, 74, 74, 74, 74],
    },
    {
      track: "Overall",
      rank: 1,
      of: 15,
      value: "78.4",
      unit: "index",
      delta: 2,
      series: [61.2, 63.0, 66.4, 70.1, 72.8, 75.0, 76.9, 78.4],
    },
  ],
  activeGames: [
    {
      name: "2024 H1 replay, v3",
      step: 14,
      steps: 26,
      closesAt: "2026-09-19T18:29:59Z",
      href: "/play/allocate",
    },
  ],
  deadlines: [
    {
      label: "Forecast: RBI repo rate below 6.00% after the October MPC?",
      at: "2026-09-10T12:29:59Z",
      href: "/play/forecast",
    },
    {
      label: "Research note review due: TCS margin trajectory",
      at: "2026-09-12T12:29:59Z",
      href: "/research",
    },
    {
      label: "Allocation game closes",
      at: "2026-09-19T18:29:59Z",
      href: "/play/allocate",
    },
  ],
  nextEvent: {
    title: "Thesis workshop",
    startsAt: "2026-09-13T11:00:00Z",
    location: "AC-04 302",
    state: "going" as const,
  },
};

// ---------------------------------------------------------------------------
// Allocation game
// ---------------------------------------------------------------------------

export interface AssetClass {
  key: string;
  label: string;
  pct: number;
  valuePaise: bigint;
  /** Change since last step, basis points. */
  changeBps: number;
}

export const allocation = {
  scenario: "2024 H1 replay, v3",
  step: 14,
  steps: 26,
  replayDate: "2024-04-03T09:45:00Z",
  corpusPaise: 10_68_412_50n,
  startPaise: 10_00_000_00n,
  /** Corpus after each completed step, whole rupees, for the sparkline. */
  history: [
    1000000, 1004500, 1011200, 1004900, 1013800, 1020100, 1027300, 1019000,
    1024600, 1031900, 1009050, 1041200, 1077400, 1068412,
  ],
  nextCorpusPaise: 10_74_930_25n,
  changeSinceLastBps: -84,
  classes: [
    {
      key: "nifty",
      label: "Nifty 50 index fund",
      pct: 40,
      valuePaise: 4_27_365_00n,
      changeBps: -112,
    },
    {
      key: "largecap",
      label: "Large-cap basket (RELIANCE, TCS, HDFCBANK, INFY)",
      pct: 25,
      valuePaise: 2_67_103_12n,
      changeBps: -140,
    },
    {
      key: "gilt",
      label: "10-year gilt index",
      pct: 15,
      valuePaise: 1_60_261_88n,
      changeBps: 18,
    },
    {
      key: "gold",
      label: "Gold",
      pct: 10,
      valuePaise: 1_06_841_25n,
      changeBps: 65,
    },
    {
      key: "fd",
      label: "Fixed deposit (7.1%)",
      pct: 10,
      valuePaise: 1_06_841_25n,
      changeBps: 13,
    },
  ] satisfies AssetClass[],
  news: {
    dateline: "3 Apr 2024",
    headline:
      "RBI holds repo at 6.50%, keeps 'withdrawal of accommodation' stance",
    body: "The Monetary Policy Committee voted 5–1 to hold. Governor flags food inflation risk from a weak monsoon forecast. Bond yields eased 4 bp on the day; banks led equities lower.",
    source: "Replay wire (historical, paraphrased)",
  },
  income: [
    { label: "Stipend credited", paise: 12_000_00n },
    { label: "FD interest", paise: 631_00n },
  ],
  expenses: [
    { label: "Hostel and mess", paise: -9_500_00n },
    { label: "Unexpected: laptop repair", paise: -4_200_00n },
  ],
};

export interface DebriefDecision {
  date: string;
  step: number;
  action: string;
  reason: string;
  corpusPaise: bigint;
  flag?: "over-trading" | "panic" | "concentration" | "good";
}

export const debrief = {
  scenario: "2024 H1 replay, v3",
  startPaise: 10_00_000_00n,
  finalPaise: 10_92_310_75n,
  counterfactuals: [
    {
      key: "yours",
      label: "Your run",
      finalPaise: 10_92_310_75n,
      note: "26 steps, 19 trades",
    },
    {
      key: "nothing",
      label: "Did nothing (kept the opening mix)",
      finalPaise: 10_58_040_00n,
      note: "0 trades",
    },
    {
      key: "index",
      label: "All Nifty 50, no trades",
      finalPaise: 11_04_220_00n,
      note: "0 trades",
    },
  ],
  timeline: [
    {
      date: "2024-01-03T09:45:00Z",
      step: 1,
      action: "Opened 40 / 25 / 15 / 10 / 10",
      reason: "Default mix, planned to hold.",
      corpusPaise: 10_00_000_00n,
      flag: "good",
    },
    {
      date: "2024-01-17T09:45:00Z",
      step: 3,
      action: "Nifty 40 → 55, gilt 15 → 5",
      reason: "Budget optimism.",
      corpusPaise: 10_11_200_00n,
      flag: "over-trading",
    },
    {
      date: "2024-01-24T09:45:00Z",
      step: 4,
      action: "Nifty 55 → 45",
      reason: "Reversed last week's move.",
      corpusPaise: 10_04_900_00n,
      flag: "over-trading",
    },
    {
      date: "2024-02-14T09:45:00Z",
      step: 7,
      action: "Large-cap 25 → 45, gold 10 → 0",
      reason: "Bank results strong.",
      corpusPaise: 10_27_300_00n,
      flag: "concentration",
    },
    {
      date: "2024-03-13T09:45:00Z",
      step: 11,
      action: "Sold large-cap 45 → 10, moved to FD",
      reason: "Mid-cap sell-off, felt exposed.",
      corpusPaise: 10_09_050_00n,
      flag: "panic",
    },
    {
      date: "2024-04-03T09:45:00Z",
      step: 14,
      action: "Held",
      reason: "RBI hold, nothing to do.",
      corpusPaise: 10_68_412_50n,
      flag: "good",
    },
    {
      date: "2024-05-08T09:45:00Z",
      step: 19,
      action: "Nifty 40 → 50",
      reason: "Re-entered after rally.",
      corpusPaise: 10_71_800_00n,
      flag: "over-trading",
    },
    {
      date: "2024-06-05T09:45:00Z",
      step: 23,
      action: "Held through election-day drop",
      reason: "Stuck to the plan.",
      corpusPaise: 10_55_400_00n,
      flag: "good",
    },
    {
      date: "2024-06-26T09:45:00Z",
      step: 26,
      action: "Run complete",
      reason: "",
      corpusPaise: 10_92_310_75n,
    },
  ] satisfies DebriefDecision[],
  behaviours: [
    {
      key: "over-trading",
      label: "Over-trading",
      verdict: "Present",
      severity: "high" as const,
      detail:
        "19 allocation changes in 26 steps. Nine of them reversed a move made within the previous two steps. Each round trip cost you the spread and, more often than not, the direction: your reversed trades were net −₹18,640.",
      costPaise: -18_640_00n,
    },
    {
      key: "panic",
      label: "Panic selling",
      verdict: "Once, expensive",
      severity: "medium" as const,
      detail:
        "Step 11: you sold large-caps into a mid-cap sell-off that barely touched them, then bought back higher at step 19. That round trip alone explains most of the gap to the all-index line.",
      costPaise: -26_900_00n,
    },
    {
      key: "concentration",
      label: "Concentration",
      verdict: "Moderate",
      severity: "medium" as const,
      detail:
        "Largest single class weight reached 55% at step 3 and 45% at step 7. The scenario's worst week hit while you were at 45% large-cap; the did-nothing line felt only half of that drawdown.",
      costPaise: -9_100_00n,
    },
    {
      key: "discipline",
      label: "Holding through noise",
      verdict: "Good",
      severity: "good" as const,
      detail:
        "You held through the election-day drop at step 23 when the replay cohort's median sold. That single decision recovered ₹31,200 by the end of the run.",
      costPaise: 31_200_00n,
    },
  ],
};

// ---------------------------------------------------------------------------
// Forecasting
// ---------------------------------------------------------------------------

export interface ForecastQuestion {
  id: string;
  prompt: string;
  resolutionCriteria: string;
  closesAt: string;
  state: "open" | "submitted" | "locked";
  probability?: number;
  rationale?: string;
  revisedCount?: number;
}

export const forecastQuestions: ForecastQuestion[] = [
  {
    id: "q1",
    prompt:
      "Will the RBI repo rate be below 6.00% after the October 2026 MPC meeting?",
    resolutionCriteria:
      "Per the RBI press release on the day of the October MPC decision.",
    closesAt: "2026-09-10T12:29:59Z",
    state: "open",
  },
  {
    id: "q2",
    prompt: "Will NIFTY 50 close above 26,000 on 30 September 2026?",
    resolutionCriteria: "Official NSE closing value on 30 September 2026.",
    closesAt: "2026-09-25T12:29:59Z",
    state: "submitted",
    probability: 62,
    rationale:
      "Momentum plus FPI flows turned positive in August; a 3% move in three weeks is within one standard deviation.",
    revisedCount: 1,
  },
  {
    id: "q3",
    prompt: "Will India's August 2026 CPI print above 4.0% year on year?",
    resolutionCriteria: "MoSPI press release for August 2026 CPI.",
    closesAt: "2026-09-07T12:29:59Z",
    state: "locked",
    probability: 41,
    rationale:
      "Vegetable prices normalised; base effect favours a sub-4 print.",
    revisedCount: 0,
  },
  {
    id: "q4",
    prompt:
      "Will the 10-year G-sec yield close below 6.60% on 31 October 2026?",
    resolutionCriteria:
      "CCIL closing yield for the benchmark 10-year on 31 October 2026.",
    closesAt: "2026-10-15T12:29:59Z",
    state: "open",
  },
];

export const calibration = {
  brier: "0.183",
  resolved: 10,
  clubMedianBrier: "0.245",
  /** Reliability bins: what you said vs what happened. */
  bins: [
    { predicted: 10, actual: 0, n: 1 },
    { predicted: 30, actual: 33, n: 3 },
    { predicted: 50, actual: 50, n: 2 },
    { predicted: 70, actual: 67, n: 3 },
    { predicted: 90, actual: 100, n: 1 },
  ],
};

// ---------------------------------------------------------------------------
// Season portfolio
// ---------------------------------------------------------------------------

export interface Position {
  id: string;
  ticker: string;
  name: string;
  openedAt: string;
  entryPaise: bigint;
  lastPaise: bigint;
  quantity: number;
  thesis: string;
  keyRisk: string;
  falsifier: string;
  status: "open" | "closed";
  /** Last eight closes, whole rupees. */
  series: number[];
}

export const positions: Position[] = [
  {
    id: "p1",
    ticker: "TCS",
    name: "Tata Consultancy Services",
    openedAt: "2026-08-27T04:15:00Z",
    entryPaise: 4_112_40n,
    lastPaise: 4_248_10n,
    quantity: 25,
    thesis:
      "Deal wins in BFSI re-accelerated in the June quarter while attrition fell below 12%, and management guided to margin recovery of 100 bp over two years through pyramid correction. The market is pricing flat margins. If the pyramid mix improves as guided, EPS growth of 11–13% over FY27 is achievable at a multiple that has already de-rated to a five-year low relative to Infosys. I expect the gap to close as the next two quarters print utilisation above 86%.",
    keyRisk:
      "A US slowdown that defers discretionary spend and pushes deal ramp-ups out by two quarters.",
    falsifier:
      "Two consecutive quarters of constant-currency revenue growth below 3% with utilisation under 84%.",
    status: "open",
    series: [4112, 4098, 4131, 4160, 4149, 4201, 4236, 4248],
  },
  {
    id: "p2",
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    openedAt: "2026-09-02T04:15:00Z",
    entryPaise: 1_742_00n,
    lastPaise: 1_718_35n,
    quantity: 60,
    thesis:
      "Post-merger deposit growth has caught up with loan growth for three straight quarters, so the loan-deposit ratio should fall below 95% by March, which removes the main reason the stock has lagged private-bank peers. Net interest margin has stabilised at 3.5% and the cost of funds has peaked. At 2.3× book against a 15% ROE trajectory, the stock discounts no improvement. I expect a re-rating toward 2.8× as the LDR normalises.",
    keyRisk:
      "Deposit competition forces higher rates and NIM slips below 3.3%.",
    falsifier:
      "LDR above 98% at the March quarter, or NIM below 3.3% in any quarter.",
    status: "open",
    series: [1742, 1751, 1738, 1729, 1735, 1722, 1715, 1718],
  },
];

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export type Block =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "quote"; text: string };

export interface ResearchNote {
  slug: string;
  title: string;
  company: string;
  ticker: string;
  vertical: Member["vertical"];
  authorId: string;
  publishedAt: string;
  state: "published" | "in_review" | "changes_requested";
  stale?: boolean;
  summary: string;
  thesis: string;
  risks: string[];
  falsifier: string;
  sources: { label: string; href: string }[];
  body: Block[];
}

export const researchNotes: ResearchNote[] = [
  {
    slug: "tcs-margin-trajectory-fy27",
    title: "TCS: the margin recovery the market is not pricing",
    company: "Tata Consultancy Services",
    ticker: "TCS",
    vertical: "Equities",
    authorId: "m04",
    publishedAt: "2026-09-01T09:30:00Z",
    state: "published",
    summary:
      "Pyramid correction and falling attrition point to 100 bp of margin recovery over two years; the multiple discounts none of it.",
    thesis:
      "Margins recover 100 bp by FY27 as utilisation stays above 86% and the pyramid rebalances toward freshers.",
    risks: [
      "US discretionary spend slows and defers ramp-ups",
      "Wage inflation returns with a tighter Indian talent market",
      "Currency: a strong rupee removes the tailwind",
    ],
    falsifier:
      "Two consecutive quarters of constant-currency growth below 3% with utilisation under 84%.",
    sources: [
      { label: "TCS Q1 FY27 investor presentation", href: "#" },
      { label: "NASSCOM attrition survey, June 2026", href: "#" },
      { label: "Annual report FY26, segment note", href: "#" },
    ],
    body: [
      { type: "h2", text: "What the market sees" },
      {
        type: "p",
        text: "The consensus view is that Indian IT services have entered a low-growth decade and that TCS, as the largest, is the most exposed. The stock has de-rated from 32× to 24× trailing earnings over two years while EPS grew 9% a year. Most of that de-rating happened in the twelve months when attrition peaked above 20% and margins fell 250 bp.",
      },
      { type: "h2", text: "What I think is different" },
      {
        type: "p",
        text: "Attrition is now below 12%. Fresher intake resumed in the March quarter. Management has been explicit that the pyramid is the margin lever, and the last two quarters show utilisation at 86% and 87%. None of that requires revenue to accelerate; it requires the business to cost what it did in 2021.",
      },
      {
        type: "ul",
        items: [
          "Margin at 24.1% versus 26.5% in FY22",
          "Sub-contractor cost down 180 bp of revenue since the peak",
          "Order book at $42bn, book-to-bill above 1.2 for three quarters",
        ],
      },
      { type: "h2", text: "What would make me wrong" },
      {
        type: "p",
        text: "If US banks cut discretionary spend again, deal ramps get pushed and utilisation falls even with the pyramid fixed. That is the falsifier above, and it is observable in two quarters.",
      },
      {
        type: "quote",
        text: "This note is an exercise in reasoning for a student club. It is not a recommendation to buy, sell or hold anything.",
      },
    ],
  },
  {
    slug: "hdfc-bank-ldr-normalisation",
    title: "HDFC Bank: the loan-deposit ratio is the whole story",
    company: "HDFC Bank",
    ticker: "HDFCBANK",
    vertical: "Equities",
    authorId: "m08",
    publishedAt: "2026-08-28T06:00:00Z",
    state: "published",
    summary:
      "Deposit growth has outpaced loans for three quarters; the LDR falls below 95% by March and the discount to peers closes.",
    thesis: "LDR normalisation drives a re-rating from 2.3× to 2.8× book.",
    risks: [
      "Deposit rate competition compresses NIM",
      "Regulatory action on unsecured lending",
    ],
    falsifier: "LDR above 98% at March, or NIM below 3.3% in any quarter.",
    sources: [{ label: "HDFC Bank Q1 FY27 results", href: "#" }],
    body: [{ type: "p", text: "Body omitted in the preview." }],
  },
  {
    slug: "gilt-curve-steepening-h2",
    title: "Why the gilt curve steepens into H2",
    company: "Government of India 10-year",
    ticker: "IN10Y",
    vertical: "Macro & Fixed Income",
    authorId: "m03",
    publishedAt: "2026-06-14T06:00:00Z",
    state: "published",
    stale: true,
    summary:
      "Written before the August MPC; the stance change since then is not reflected.",
    thesis: "Supply-heavy H2 borrowing calendar steepens 2s10s by 25 bp.",
    risks: ["RBI OMO purchases absorb supply"],
    falsifier: "2s10s flatter than 40 bp at end-September.",
    sources: [
      { label: "H2 borrowing calendar, Ministry of Finance", href: "#" },
    ],
    body: [{ type: "p", text: "Body omitted in the preview." }],
  },
  {
    slug: "reliance-new-energy-optionality",
    title: "Reliance: valuing new energy as an option, not a segment",
    company: "Reliance Industries",
    ticker: "RELIANCE",
    vertical: "Equities",
    authorId: "m11",
    publishedAt: "2026-09-05T06:00:00Z",
    state: "in_review",
    summary: "Under review by the Equities lead.",
    thesis:
      "Sum-of-parts understates optionality in the giga-factory build-out.",
    risks: ["Capex overruns", "Polysilicon price collapse"],
    falsifier: "Module output below 5 GW by March 2027.",
    sources: [],
    body: [{ type: "p", text: "Body omitted in the preview." }],
  },
  {
    slug: "momentum-factor-nifty-500",
    title: "A momentum factor on the Nifty 500: what survives costs",
    company: "Nifty 500 universe",
    ticker: "N500",
    vertical: "Quant",
    authorId: "m02",
    publishedAt: "2026-09-03T06:00:00Z",
    state: "changes_requested",
    summary: "Reviewer asked for turnover-adjusted results before publication.",
    thesis:
      "12-1 momentum survives 40 bp round-trip costs at monthly rebalance.",
    risks: ["Look-ahead bias in index constituents"],
    falsifier: "Net Sharpe below 0.3 after costs on the 2015–2025 sample.",
    sources: [],
    body: [{ type: "p", text: "Body omitted in the preview." }],
  },
];

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

export interface LearnModule {
  slug: string;
  title: string;
  minutes: number;
  status: "done" | "in_progress" | "todo";
  quant?: boolean;
}

export const learnTracks: {
  key: string;
  name: string;
  description: string;
  modules: LearnModule[];
}[] = [
  {
    key: "foundations",
    name: "Foundations",
    description:
      "How markets, the club and the portal work. Required before the first season game.",
    modules: [
      {
        slug: "reading-a-price-chart-honestly",
        title: "Reading a price chart honestly",
        minutes: 25,
        status: "done",
      },
      {
        slug: "what-a-thesis-is",
        title: "What a thesis is, and what it is not",
        minutes: 30,
        status: "done",
      },
      {
        slug: "writing-a-falsifiable-thesis",
        title: "Writing a falsifiable thesis",
        minutes: 40,
        status: "in_progress",
      },
      {
        slug: "calibration-and-forecasting",
        title: "Calibration and forecasting",
        minutes: 35,
        status: "todo",
      },
      {
        slug: "the-no-advice-rule",
        title: "The no-advice rule and why it exists",
        minutes: 15,
        status: "todo",
      },
    ],
  },
  {
    key: "applied",
    name: "Applied Analysis",
    description:
      "Company and macro analysis as the club practises it: sources, rubric, review.",
    modules: [
      {
        slug: "reading-an-annual-report",
        title: "Reading an annual report in ninety minutes",
        minutes: 60,
        status: "todo",
      },
      {
        slug: "unit-economics",
        title: "Unit economics before valuation",
        minutes: 45,
        status: "todo",
      },
      {
        slug: "macro-for-equity-people",
        title: "Macro for equity people",
        minutes: 45,
        status: "todo",
      },
      {
        slug: "the-review-rubric",
        title: "The review rubric, from the reviewer's side",
        minutes: 30,
        status: "todo",
      },
    ],
  },
  {
    key: "quant",
    name: "Quant",
    description:
      "Data, backtests and the ways they lie. Hands-on modules open in the Python environment.",
    modules: [
      {
        slug: "python-setup",
        title: "Getting the Python environment running",
        minutes: 20,
        status: "todo",
        quant: true,
      },
      {
        slug: "returns-and-risk-in-pandas",
        title: "Returns and risk in pandas",
        minutes: 60,
        status: "todo",
        quant: true,
      },
      {
        slug: "backtest-pitfalls",
        title: "Backtest pitfalls: look-ahead, survivorship, costs",
        minutes: 50,
        status: "todo",
        quant: true,
      },
    ],
  },
];

export const learnModule = {
  slug: "writing-a-falsifiable-thesis",
  title: "Writing a falsifiable thesis",
  track: "Foundations",
  minutes: 40,
  position: "Module 3 of 5",
  body: [
    {
      type: "p",
      text: "A thesis is a claim about the world that could turn out to be wrong, plus the reason you think it is right. It is not a price target, and it is not a feeling about a company. The test is simple: can you name, in advance, the observation that would make you abandon it?",
    },
    { type: "h2", text: "The three parts" },
    {
      type: "ul",
      items: [
        "Reasoning: the causal chain from what you observe to what you expect",
        "Key risk: the most likely way the chain breaks",
        "Falsifier: a specific, observable fact with a date attached",
      ],
    },
    { type: "h2", text: "A weak thesis and a strong one" },
    {
      type: "quote",
      text: 'Weak: "TCS is undervalued and should re-rate." Strong: "TCS margins recover 100 bp by FY27 because attrition is below 12% and utilisation is above 86%; if two quarters print CC growth under 3% with utilisation under 84%, I am wrong."',
    },
    {
      type: "p",
      text: "Notice that the strong version could be checked by someone who disagrees with you. That is the whole point: the portal will hold your thesis next to what happened, and you will learn more from being wrong in a specific way than from being right by accident.",
    },
    { type: "h2", text: "Exercise" },
    {
      type: "p",
      text: "Rewrite the two theses below so each has a falsifier with a date. Submit them on the portfolio page as drafts; they are not positions until you open one.",
    },
  ] satisfies Block[],
  links: [
    { label: "Tetlock and Gardner, Superforecasting, chapter 3", href: "#" },
    { label: "Club rubric: thesis section", href: "#" },
  ],
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface ClubEvent {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  capacity: number;
  going: number;
  waitlist: number;
  state: "going" | "waitlisted" | "none" | "attended" | "missed";
  past: boolean;
  description: string;
}

export const events: ClubEvent[] = [
  {
    id: "e1",
    title: "Thesis workshop",
    startsAt: "2026-09-13T11:00:00Z",
    location: "AC-04 302",
    capacity: 20,
    going: 14,
    waitlist: 0,
    state: "going",
    past: false,
    description:
      "Bring a draft thesis. We rewrite it together until it has a falsifier.",
  },
  {
    id: "e2",
    title: "Guest talk: a fixed-income desk, from the inside",
    startsAt: "2026-09-20T12:30:00Z",
    location: "Auditorium",
    capacity: 40,
    going: 40,
    waitlist: 6,
    state: "none",
    past: false,
    description:
      "An alum on a rates desk walks through a day, a trade and a mistake.",
  },
  {
    id: "e3",
    title: "Allocation game debrief, cohort session",
    startsAt: "2026-09-27T11:00:00Z",
    location: "AC-02 105",
    capacity: 30,
    going: 9,
    waitlist: 0,
    state: "none",
    past: false,
    description:
      "We look at the cohort's decision timelines side by side. Anonymised.",
  },
  {
    id: "e4",
    title: "Season kickoff",
    startsAt: "2026-08-24T11:00:00Z",
    location: "Auditorium",
    capacity: 80,
    going: 71,
    waitlist: 0,
    state: "attended",
    past: true,
    description: "Rules, tracks, and the no-advice policy.",
  },
  {
    id: "e5",
    title: "Reading an annual report, live",
    startsAt: "2026-08-30T11:00:00Z",
    location: "AC-04 302",
    capacity: 20,
    going: 20,
    waitlist: 4,
    state: "missed",
    past: true,
    description: "Infosys FY26, cover to cover, with the lead.",
  },
];

// ---------------------------------------------------------------------------
// Admin audit log
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  before: string | null;
  after: string | null;
  reason?: string;
}

export const auditEntries: AuditEntry[] = [
  {
    id: 1041,
    at: "2026-09-08T03:00:12Z",
    actor: "system",
    action: "scores.recomputed",
    entity: "season:monsoon-2026",
    before: null,
    after: '{"tracks":6,"members":15}',
  },
  {
    id: 1040,
    at: "2026-09-07T14:22:41Z",
    actor: "Aarav Mehta (core)",
    action: "score.override",
    entity: "scores:m07/contribution",
    before: '{"value":"18"}',
    after: '{"value":"26"}',
    reason: "Ran the 30 Aug session; points were not auto-credited.",
  },
  {
    id: 1039,
    at: "2026-09-07T10:05:03Z",
    actor: "Kabir Sethi (lead)",
    action: "research.state",
    entity: "research_notes:reliance-new-energy-optionality",
    before: '{"state":"submitted"}',
    after: '{"state":"in_review"}',
  },
  {
    id: 1038,
    at: "2026-09-06T16:40:19Z",
    actor: "Lakshmi Krishnan (faculty)",
    action: "module.approved",
    entity: "modules:writing-a-falsifiable-thesis",
    before: '{"state":"pending_review"}',
    after: '{"state":"published"}',
  },
  {
    id: 1037,
    at: "2026-09-05T08:12:55Z",
    actor: "Aarav Mehta (core)",
    action: "role.granted",
    entity: "user_roles:m16",
    before: null,
    after: '{"role":"member","season":"monsoon-2026"}',
  },
  {
    id: 1036,
    at: "2026-09-04T12:00:00Z",
    actor: "Aarav Mehta (core)",
    action: "forecast_question.created",
    entity: "forecast_questions:q4",
    before: null,
    after: '{"closes_at":"2026-10-15T12:29:59Z"}',
  },
  {
    id: 1035,
    at: "2026-09-02T09:30:00Z",
    actor: "Diya Raghunathan (lead)",
    action: "event.capacity",
    entity: "events:e2",
    before: '{"capacity":30}',
    after: '{"capacity":40}',
  },
];

// ===========================================================================
// PASS 3 — the rest of the product
// ===========================================================================

// ---------------------------------------------------------------------------
// Public: about and apply
// ---------------------------------------------------------------------------

export const about = {
  lede: "Wolves of Wall Street is the student finance club at Ashoka University. We run a members' portal instead of a WhatsApp group, and we assess people on how they reason, not on what they returned.",
  what: [
    {
      title: "We are a teaching club, not a fund",
      body: "No money passes through WOWS at any point. There is no pooled capital, no brokerage account, no paid entry and no cash prize. Every number in the portal is a simulation over historical data that has already happened.",
    },
    {
      title: "We publish reasoning, not calls",
      body: "Members write research notes with an explicit thesis, the risks that would break it, and a falsifier stated before the fact. A note that says what to buy is sent back. A note that says what would prove its author wrong is published.",
    },
    {
      title: "We keep score on calibration",
      body: "The most prominent leaderboard is not returns. It is the Brier score across resolved forecasts: whether the things you said were 70% likely happened about 70% of the time.",
    },
  ],
  verticals: [
    {
      name: "Equities",
      lead: "Aarav Mehta",
      body: "Single-name work on Indian listed companies. Reading filings, building a view, and writing it down in a form somebody else can attack.",
      members: 24,
    },
    {
      name: "Macro & Fixed Income",
      lead: "Kabir Sethi",
      body: "Rates, inflation prints, the RBI's policy corridor, and the arithmetic of a bond. The vertical that produces most of the forecast questions.",
      members: 17,
    },
    {
      name: "Quant",
      lead: "Sara Qureshi",
      body: "Backtests that survive their own assumptions, position sizing, and why most published edges are a survivorship artefact. Python, not spreadsheets.",
      members: 19,
    },
  ],
  faculty: {
    name: "Dr. Anjali Varma",
    title: "Faculty adviser, Department of Economics",
    body: "Every piece of member-authored content that becomes visible to the club passes a review state. Curriculum modules require faculty approval before publication. The adviser can withdraw any note at any time.",
  },
  policy: [
    "No real money at any stage: no payments, brokerage linking, wallets, cash prizes, or paid entry.",
    "No buy, sell or hold recommendations under the club's name, and no ranked list of picks.",
    "Every screen that shows a simulated figure says that it is simulated.",
    "Member-authored content that becomes club-visible carries a review state and a faculty gate.",
  ],
  contact: {
    email: "wows@ashoka.edu.in",
    discord:
      "The club runs its conversation on Discord. The portal is deliberately not a chat product.",
  },
};

export interface ApplicationField {
  name: string;
  label: string;
  help: string;
  kind: "short" | "long" | "select";
  options?: string[];
  minWords?: number;
  required: boolean;
}

export const application = {
  windowCloses: "2026-09-19T18:30:00Z",
  cohortSize: 30,
  applicants: 118,
  fields: [
    {
      name: "name",
      label: "Full name",
      help: "As it appears on your university record.",
      kind: "short",
      required: true,
    },
    {
      name: "email",
      label: "Ashoka email",
      help: "Must end in @ashoka.edu.in. This is how you will sign in; there is no password.",
      kind: "short",
      required: true,
    },
    {
      name: "cohort",
      label: "Cohort",
      help: "Your expected graduating year.",
      kind: "select",
      options: ["UG 2027", "UG 2028", "UG 2029", "ASP 2027", "PhD"],
      required: true,
    },
    {
      name: "vertical",
      label: "Vertical you are applying to",
      help: "You can move later. Pick where you want to spend this semester.",
      kind: "select",
      options: ["Equities", "Macro & Fixed Income", "Quant"],
      required: true,
    },
    {
      name: "why",
      label: "Why this club, and not a trading Discord?",
      help: "We are looking for a reason that survives the first boring week.",
      kind: "long",
      minWords: 100,
      required: true,
    },
    {
      name: "wrong",
      label:
        "Describe something you believed about markets that turned out to be wrong.",
      help: "What you believed, what changed your mind, and how long it took. This is the question we actually read.",
      kind: "long",
      minWords: 150,
      required: true,
    },
    {
      name: "commitment",
      label: "Hours a week you can commit",
      help: "Be honest. Four real hours beats ten aspirational ones.",
      kind: "select",
      options: ["2–4", "4–6", "6–10", "More than 10"],
      required: true,
    },
    {
      name: "portfolio",
      label: "A link to anything you have written (optional)",
      help: "A blog, a Substack, a GitHub, a course essay. Any subject. We are reading for clarity, not finance.",
      kind: "short",
      required: false,
    },
  ] satisfies ApplicationField[],
  states: [
    {
      key: "submitted",
      label: "Submitted",
      body: "Your application is in. Nothing is expected from you until the review closes on 19 September.",
      when: "2026-09-11T10:12:00Z",
    },
    {
      key: "in_review",
      label: "In review",
      body: "Two members of core are reading your answers independently. Applications are read without names attached.",
      when: "2026-09-20T05:00:00Z",
    },
    {
      key: "interview",
      label: "Conversation scheduled",
      body: "A twenty-minute conversation, in person, about the answer you gave on being wrong. There is nothing to prepare.",
      when: "2026-09-24T11:30:00Z",
    },
    {
      key: "decided",
      label: "Decision",
      body: "You will hear either way. Members who are not offered a place this semester are told what would make the next application stronger.",
      when: "2026-09-30T12:00:00Z",
    },
  ],
};

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: QuizOption[];
  answer: string;
  explanation: string;
}

export const quiz = {
  title: "Bonds and rates",
  bank: "Curriculum · Macro track · module 2",
  questionCount: 8,
  questions: [
    {
      id: "q1",
      topic: "Duration",
      prompt:
        "A ten-year government bond and a two-year government bond both yield 7%. Yields rise by 50 basis points across the curve. Which statement is true?",
      options: [
        { key: "a", text: "Both bonds fall by roughly the same percentage." },
        { key: "b", text: "The ten-year falls by roughly four times as much." },
        {
          key: "c",
          text: "The two-year falls more, because it reprices sooner.",
        },
        { key: "d", text: "Neither falls; the coupon is unchanged." },
      ],
      answer: "b",
      explanation:
        "Price sensitivity to yield is duration, and duration rises with maturity. The ten-year has roughly four times the duration of the two-year, so it loses roughly four times as much. The coupon being unchanged is exactly why the price must move: the only way a fixed coupon can yield more is for the price to fall.",
    },
    {
      id: "q2",
      topic: "Real rates",
      prompt:
        "Inflation prints at 6% and the policy rate is 5.5%. What is the real policy rate, and what does it usually imply?",
      options: [
        { key: "a", text: "+0.5%, mildly restrictive" },
        { key: "b", text: "−0.5%, accommodative in real terms" },
        { key: "c", text: "11.5%, strongly restrictive" },
        { key: "d", text: "Cannot be computed without the repo corridor" },
      ],
      answer: "b",
      explanation:
        "The real rate is roughly the nominal rate minus inflation: 5.5 − 6 = −0.5%. A negative real policy rate means a saver holding cash loses purchasing power, which is ordinarily stimulative. Central banks rarely hold a negative real rate through a sustained inflation overshoot, which is what makes this configuration a useful forecasting question.",
    },
    {
      id: "q3",
      topic: "Curve shape",
      prompt:
        "The two-year yield rises above the ten-year yield. What has happened, in the language everyone uses?",
      options: [
        { key: "a", text: "The curve has steepened" },
        { key: "b", text: "The curve has inverted" },
        { key: "c", text: "A bull flattening" },
        { key: "d", text: "The term premium has widened" },
      ],
      answer: "b",
      explanation:
        "Short yields above long yields is an inverted curve. It says the market expects policy rates to be lower in the future than they are now, usually because it expects growth to slow. Inversion is a statement about expectations, not a mechanism that causes anything.",
    },
    {
      id: "q4",
      topic: "Credit",
      prompt:
        "A corporate bond yields 9% while the equivalent-maturity government bond yields 7%. The 200 bp difference is compensation for what?",
      options: [
        { key: "a", text: "Default risk only" },
        { key: "b", text: "Default risk, liquidity, and the tax treatment" },
        { key: "c", text: "Inflation risk the government bond does not carry" },
        { key: "d", text: "The higher coupon" },
      ],
      answer: "b",
      explanation:
        "The spread is not purely a default probability. A meaningful part of it pays for the fact that the corporate bond is harder to sell in size, and part reflects differing tax treatment. Attributing the whole spread to default risk consistently overstates the implied default rate, which is one of the oldest results in credit research.",
    },
    {
      id: "q5",
      topic: "Reinvestment",
      prompt:
        "You buy a bond at par yielding 8% and hold it to maturity. Rates fall to 5% the following year. Your realised return over the full holding period will be:",
      options: [
        { key: "a", text: "Exactly 8%, because you held to maturity" },
        { key: "b", text: "Above 8%, because prices rose" },
        { key: "c", text: "Below 8%, because coupons reinvest at 5%" },
        { key: "d", text: "Unknowable without the credit rating" },
      ],
      answer: "c",
      explanation:
        "Yield to maturity quietly assumes every coupon is reinvested at the same yield. If rates fall, coupons reinvest at less, and the realised return comes in below the quoted YTM. Holding to maturity removes price risk; it does not remove reinvestment risk. This is the single most common misreading of a bond quote.",
    },
  ] satisfies QuizQuestion[],
  /** A finished attempt, for the summary screen. */
  attempt: {
    score: 4,
    of: 5,
    takenAt: "2026-09-09T14:20:00Z",
    medianScore: 3,
    weakest: "Reinvestment risk",
    note: "Quiz results are formative. They do not enter any leaderboard and are visible only to you and to the module's author.",
  },
};

export const kiosk = {
  stall: "Orientation week · Mess lawn · Stall 4",
  questions: quiz.questions.slice(0, 3),
  leaderboard: [
    { name: "Priya S.", score: 3, seconds: 41 },
    { name: "Rehan", score: 3, seconds: 58 },
    { name: "Anonymous", score: 2, seconds: 33 },
    { name: "Kavya M.", score: 2, seconds: 47 },
    { name: "T. Krishnan", score: 1, seconds: 29 },
  ],
  note: "Kiosk mode is a sandbox. Nothing entered at a stall touches a member account, and the names here are stored only for the length of the event.",
};

// ---------------------------------------------------------------------------
// Research: submission, the author's own notes, and the review queue
// ---------------------------------------------------------------------------

export const researchRubric = [
  {
    criterion: "Falsifiability",
    weight: "Gate",
    body: 'The note states, before the fact, what observation would prove it wrong. A note without a falsifier is returned unread. "The thesis plays out over a longer horizon" is not a falsifier.',
  },
  {
    criterion: "Evidence",
    weight: "30%",
    body: "Claims are sourced to filings, transcripts or published data, and the source is linked. A number without a source is treated as an assertion.",
  },
  {
    criterion: "Risks",
    weight: "25%",
    body: 'At least three risks, each one capable of breaking the thesis rather than decorating it. "Market volatility" is not a risk.',
  },
  {
    criterion: "Clarity",
    weight: "25%",
    body: "A first-year in another vertical can follow the argument. Jargon is defined at first use or removed.",
  },
  {
    criterion: "Originality",
    weight: "20%",
    body: "The note says something the sell-side consensus does not already say, and is explicit about where it departs.",
  },
];

export const researchGuidelines = [
  'Never frame a price target as an instruction. "Fair value is ₹4,600 on 22× FY28 EPS" is analysis; "buy below ₹4,000" is a call, and the club does not make calls.',
  "Disclose any position you hold in the season portfolio. It does not disqualify the note; concealing it does.",
  "Write the falsifier first. If you cannot state one, you do not yet have a thesis.",
];

export interface MyNote {
  id: string;
  title: string;
  ticker: string;
  state:
    "draft" | "submitted" | "in_review" | "changes_requested" | "published";
  updatedAt: string;
  words: number;
  reviewer?: string;
  comments?: { author: string; at: string; body: string; criterion: string }[];
}

export const myNotes: MyNote[] = [
  {
    id: "n1",
    title: "TCS: the margin recovery the market is not pricing",
    ticker: "TCS",
    state: "published",
    updatedAt: "2026-09-01T09:30:00Z",
    words: 1840,
  },
  {
    id: "n2",
    title: "Marico: rural volume recovery is already in the price",
    ticker: "MARICO",
    state: "changes_requested",
    updatedAt: "2026-09-07T11:05:00Z",
    words: 1120,
    reviewer: "Aarav Mehta",
    comments: [
      {
        author: "Aarav Mehta",
        at: "2026-09-07T11:05:00Z",
        criterion: "Falsifiability",
        body: 'The falsifier as written — "if rural demand does not recover" — is not observable on a date. Give me a number and a quarter: which volume growth print, in which result, would make you drop this?',
      },
      {
        author: "Aarav Mehta",
        at: "2026-09-07T11:09:00Z",
        criterion: "Evidence",
        body: "Paragraph 4 cites a 9% rural volume figure with no source. If that is from the Q1 transcript, link the transcript and quote the line.",
      },
      {
        author: "Dr. Anjali Varma",
        at: "2026-09-07T15:40:00Z",
        criterion: "Clarity",
        body: 'Good structure. The last paragraph edges toward a recommendation — rewrite "worth accumulating" as a statement about value, not action.',
      },
    ],
  },
  {
    id: "n3",
    title: "Why the RBI will hold through the December meeting",
    ticker: "MACRO",
    state: "in_review",
    updatedAt: "2026-09-08T18:22:00Z",
    words: 1360,
    reviewer: "Kabir Sethi",
  },
  {
    id: "n4",
    title: "Nifty IT: dispersion is at a five-year high",
    ticker: "NIFTYIT",
    state: "submitted",
    updatedAt: "2026-09-09T07:44:00Z",
    words: 980,
  },
  {
    id: "n5",
    title: "Bajaj Finance: the AUM growth question nobody asks",
    ticker: "BAJFINANCE",
    state: "draft",
    updatedAt: "2026-09-09T21:15:00Z",
    words: 410,
  },
];

export interface ReviewItem {
  id: string;
  title: string;
  authorId: string;
  ticker: string;
  vertical: Member["vertical"];
  submittedAt: string;
  words: number;
  state: "awaiting_review" | "awaiting_faculty" | "changes_requested";
  reviewer?: string;
  flags: string[];
}

export const reviewQueue: ReviewItem[] = [
  {
    id: "r1",
    title: "Why the RBI will hold through the December meeting",
    authorId: "m04",
    ticker: "MACRO",
    vertical: "Macro & Fixed Income",
    submittedAt: "2026-09-08T18:22:00Z",
    words: 1360,
    state: "awaiting_review",
    flags: [],
  },
  {
    id: "r2",
    title: "Nifty IT: dispersion is at a five-year high",
    authorId: "m04",
    ticker: "NIFTYIT",
    vertical: "Quant",
    submittedAt: "2026-09-09T07:44:00Z",
    words: 980,
    state: "awaiting_review",
    flags: ["No falsifier detected in the falsifier field"],
  },
  {
    id: "r3",
    title: "Zomato: unit economics past the inflection",
    authorId: "m05",
    ticker: "ZOMATO",
    vertical: "Equities",
    submittedAt: "2026-09-06T13:10:00Z",
    words: 2140,
    state: "awaiting_faculty",
    reviewer: "Aarav Mehta",
    flags: ["Author holds an open position in this name (disclosed)"],
  },
  {
    id: "r4",
    title: "Marico: rural volume recovery is already in the price",
    authorId: "m04",
    ticker: "MARICO",
    vertical: "Equities",
    submittedAt: "2026-09-05T09:00:00Z",
    words: 1120,
    state: "changes_requested",
    reviewer: "Aarav Mehta",
    flags: ['Phrase flagged for review: "worth accumulating"'],
  },
];

// ---------------------------------------------------------------------------
// Directory and the member's own profile
// ---------------------------------------------------------------------------

export type MemberRole = "member" | "lead" | "core" | "faculty" | "alum";

export interface DirectoryEntry {
  memberId: string;
  role: MemberRole;
  joined: string;
  published: number;
  /** Slug of one published note, if any. */
  latestNote?: string;
}

export const directory: DirectoryEntry[] = [
  {
    memberId: "m01",
    role: "lead",
    joined: "2024-08-20",
    published: 6,
    latestNote: "hdfc-bank-ldr-normalisation",
  },
  { memberId: "m02", role: "member", joined: "2025-08-19", published: 2 },
  { memberId: "m03", role: "lead", joined: "2024-08-20", published: 5 },
  {
    memberId: "m04",
    role: "member",
    joined: "2025-08-19",
    published: 1,
    latestNote: "tcs-margin-trajectory-fy27",
  },
  { memberId: "m05", role: "member", joined: "2025-08-19", published: 3 },
  { memberId: "m06", role: "core", joined: "2024-01-15", published: 8 },
  { memberId: "m07", role: "member", joined: "2026-08-24", published: 0 },
  { memberId: "m08", role: "alum", joined: "2022-08-22", published: 11 },
  { memberId: "m09", role: "member", joined: "2026-08-24", published: 0 },
  { memberId: "m10", role: "member", joined: "2025-08-19", published: 2 },
  { memberId: "m11", role: "core", joined: "2023-08-21", published: 7 },
  { memberId: "m12", role: "member", joined: "2026-08-24", published: 1 },
  { memberId: "m13", role: "member", joined: "2025-08-19", published: 4 },
  { memberId: "m14", role: "member", joined: "2026-08-24", published: 0 },
  { memberId: "m15", role: "member", joined: "2026-08-24", published: 0 },
];

export const faculty = {
  name: "Dr. Anjali Varma",
  role: "faculty" as MemberRole,
  title: "Faculty adviser, Department of Economics",
};

export const profile = {
  joined: "2025-08-19",
  standing: [
    {
      track: "calibration" as TrackKey,
      label: "Calibration",
      rank: 4,
      of: 41,
      value: "0.163",
      qualifies: true,
    },
    {
      track: "research" as TrackKey,
      label: "Research",
      rank: 9,
      of: 41,
      value: "72",
      qualifies: true,
    },
    {
      track: "risk" as TrackKey,
      label: "Risk discipline",
      rank: 6,
      of: 41,
      value: "0.81",
      qualifies: true,
    },
    {
      track: "scenario" as TrackKey,
      label: "Scenario",
      rank: 22,
      of: 41,
      value: "—",
      qualifies: false,
    },
    {
      track: "contribution" as TrackKey,
      label: "Contribution",
      rank: 11,
      of: 41,
      value: "34",
      qualifies: true,
    },
  ],
  curriculum: [
    {
      track: "Foundations",
      done: 6,
      of: 6,
      completedAt: "2026-08-30T00:00:00Z",
    },
    { track: "Equity research", done: 3, of: 7 },
    { track: "Quant methods", done: 0, of: 5 },
  ],
  forecastHistory: [
    {
      question:
        "Will the RBI change the repo rate at the October 2026 meeting?",
      said: 25,
      outcome: false,
      brier: 0.0625,
      resolvedAt: "2026-10-08T06:00:00Z",
    },
    {
      question: "Will CPI inflation for August 2026 print above 5.0%?",
      said: 70,
      outcome: true,
      brier: 0.09,
      resolvedAt: "2026-09-12T12:30:00Z",
    },
    {
      question: "Will Nifty 50 close above 26,000 on 30 September 2026?",
      said: 55,
      outcome: false,
      brier: 0.3025,
      resolvedAt: "2026-09-30T10:00:00Z",
    },
    {
      question: "Will TCS report constant-currency growth above 3% in Q2 FY27?",
      said: 80,
      outcome: true,
      brier: 0.04,
      resolvedAt: "2026-10-11T05:00:00Z",
    },
    {
      question:
        "Will the US Fed cut by 50 bp or more at the September meeting?",
      said: 15,
      outcome: false,
      brier: 0.0225,
      resolvedAt: "2026-09-18T18:00:00Z",
    },
    {
      question: "Will India's Q1 FY27 GDP growth print above 7.0%?",
      said: 60,
      outcome: false,
      brier: 0.36,
      resolvedAt: "2026-08-30T12:00:00Z",
    },
  ],
  attendance: [
    {
      title: "Reading a cash-flow statement backwards",
      at: "2026-08-27T11:30:00Z",
      attended: true,
    },
    {
      title: "Guest: buy-side research, ten years in",
      at: "2026-09-03T12:00:00Z",
      attended: true,
    },
    {
      title: "Quant workshop: backtest survivorship",
      at: "2026-09-10T11:30:00Z",
      attended: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminSeason {
  name: string;
  state: "draft" | "open" | "closed" | "settled" | "archived";
  startsAt: string;
  endsAt: string;
  members: number;
  forecastQuestions: number;
  notes: number;
  minResolvedForecasts: number;
}

export const adminSeasons: AdminSeason[] = [
  {
    name: "Monsoon 2026",
    state: "open",
    startsAt: "2026-08-24T00:00:00Z",
    endsAt: "2026-12-04T00:00:00Z",
    members: 41,
    forecastQuestions: 14,
    notes: 9,
    minResolvedForecasts: 8,
  },
  {
    name: "Spring 2026",
    state: "settled",
    startsAt: "2026-01-12T00:00:00Z",
    endsAt: "2026-04-24T00:00:00Z",
    members: 38,
    forecastQuestions: 22,
    notes: 17,
    minResolvedForecasts: 8,
  },
  {
    name: "Monsoon 2025",
    state: "archived",
    startsAt: "2025-08-18T00:00:00Z",
    endsAt: "2025-11-28T00:00:00Z",
    members: 33,
    forecastQuestions: 19,
    notes: 12,
    minResolvedForecasts: 6,
  },
  {
    name: "Spring 2027",
    state: "draft",
    startsAt: "2027-01-11T00:00:00Z",
    endsAt: "2027-04-23T00:00:00Z",
    members: 0,
    forecastQuestions: 0,
    notes: 0,
    minResolvedForecasts: 8,
  },
];

export const settlementWarning = [
  "Every leaderboard in the season is frozen at its current values and pinned to the scenario versions in use.",
  "Open season-portfolio positions are marked at their last snapshot close and closed; theses become visible club-wide.",
  "Unresolved forecast questions must be resolved or voided first. Two are currently unresolved.",
  "Nothing inside a settled season can be edited afterwards. A correction becomes a new compensating record, never an edit.",
];

export interface AdminGame {
  scenario: string;
  version: number;
  window: string;
  steps: number;
  universe: number;
  instanceSeason: string;
  state: "draft" | "open" | "closed";
  runs: { completed: number; inProgress: number; abandoned: number };
  pinnedTo?: string;
}

export const adminGames: AdminGame[] = [
  {
    scenario: "First replay",
    version: 1,
    window: "Jan 2019 – Dec 2023",
    steps: 60,
    universe: 12,
    instanceSeason: "Monsoon 2026",
    state: "open",
    runs: { completed: 6, inProgress: 11, abandoned: 2 },
    pinnedTo: "Scenario track, Monsoon 2026",
  },
  {
    scenario: "First replay",
    version: 2,
    window: "Jan 2019 – Dec 2023",
    steps: 60,
    universe: 13,
    instanceSeason: "—",
    state: "draft",
    runs: { completed: 0, inProgress: 0, abandoned: 0 },
  },
  {
    scenario: "Rate shock",
    version: 1,
    window: "Jan 2021 – Dec 2024",
    steps: 48,
    universe: 9,
    instanceSeason: "Spring 2026",
    state: "closed",
    runs: { completed: 31, inProgress: 0, abandoned: 4 },
    pinnedTo: "Scenario track, Spring 2026",
  },
];

export interface AdminContentItem {
  id: string;
  kind: "Forecast question" | "Curriculum module" | "Quiz bank" | "News card";
  title: string;
  state: "draft" | "in_review" | "published" | "voided";
  author: string;
  when: string;
  detail: string;
  gate?: string;
}

export const adminContent: AdminContentItem[] = [
  {
    id: "c1",
    kind: "Forecast question",
    title: "Will the RBI change the repo rate at the December 2026 meeting?",
    state: "published",
    author: "Kabir Sethi",
    when: "2026-12-05T06:00:00Z",
    detail:
      "Closes 5 Dec, 11:30 IST. Resolves from the RBI's published policy statement. 31 forecasts so far.",
  },
  {
    id: "c2",
    kind: "Forecast question",
    title: "Will CPI inflation for October 2026 print above 5.0%?",
    state: "published",
    author: "Zara Fernandes",
    when: "2026-11-12T12:00:00Z",
    detail:
      "Closes 12 Nov, 17:30 IST. Resolves from MoSPI's release. 28 forecasts so far.",
  },
  {
    id: "c3",
    kind: "Forecast question",
    title: "Will the monsoon deficit narrow to under 4% by 30 September?",
    state: "voided",
    author: "Vihaan Nair",
    when: "2026-09-30T12:00:00Z",
    detail:
      "Voided: the IMD changed its regional weighting mid-season, so the stated resolution source no longer produces a comparable number. Excluded from all scoring and from every member's forecast count.",
  },
  {
    id: "c4",
    kind: "Forecast question",
    title: "Is Reliance a good buy at current levels?",
    state: "draft",
    author: "Ishaan Kapoor",
    when: "2026-09-09T10:00:00Z",
    detail:
      "Rejected by the template: no named observable and no resolution source. A forecast question must be settleable by a published number, not by opinion.",
  },
  {
    id: "c5",
    kind: "Curriculum module",
    title: "Writing a falsifiable thesis",
    state: "published",
    author: "Sara Qureshi",
    when: "2026-08-26T04:00:00Z",
    detail: "Foundations, module 3. 34 members completed.",
    gate: "Faculty approved by Dr. Anjali Varma, 25 Aug",
  },
  {
    id: "c6",
    kind: "Curriculum module",
    title: "Position sizing and the Kelly trap",
    state: "in_review",
    author: "Diya Raghunathan",
    when: "2026-09-08T09:00:00Z",
    detail:
      "Quant methods, module 4. Awaiting the faculty gate before it can publish.",
    gate: "Awaiting faculty approval",
  },
  {
    id: "c7",
    kind: "Quiz bank",
    title: "Bonds and rates",
    state: "published",
    author: "Kabir Sethi",
    when: "2026-08-30T04:00:00Z",
    detail:
      "8 questions. Used by the Macro track module 2 and by the orientation kiosk.",
  },
  {
    id: "c8",
    kind: "News card",
    title: "Step 15 — March 2020: markets fall sharply on pandemic news",
    state: "draft",
    author: "Aarav Mehta",
    when: "2020-03-31T00:00:00Z",
    detail:
      "Written from sources dated on or before 31 Mar 2020. The written-from check is what stops a card describing what happened next.",
  },
];

export interface AdminMember {
  memberId: string;
  role: MemberRole;
  status: "active" | "inactive";
  forecasts: number;
  notes: number;
  lastSeen: string;
}

export const adminMembers: AdminMember[] = directory.map((d, i) => ({
  memberId: d.memberId,
  role: d.role,
  status: i % 7 === 5 ? "inactive" : "active",
  forecasts: [14, 9, 12, 11, 8, 15, 2, 0, 1, 7, 13, 5, 10, 3, 0][i] ?? 0,
  notes: d.published,
  lastSeen: [
    "2026-09-09T18:00:00Z",
    "2026-09-09T12:00:00Z",
    "2026-09-08T09:00:00Z",
  ][i % 3]!,
}));

export interface Applicant {
  id: string;
  name: string;
  cohort: string;
  vertical: Member["vertical"];
  appliedAt: string;
  state: "submitted" | "in_review" | "interview" | "offered" | "declined";
  readBy: string[];
}

export const applicants: Applicant[] = [
  {
    id: "a1",
    name: "Neha Raghavan",
    cohort: "UG 2029",
    vertical: "Equities",
    appliedAt: "2026-09-08T07:20:00Z",
    state: "in_review",
    readBy: ["Sara Qureshi"],
  },
  {
    id: "a2",
    name: "Farhan Sheikh",
    cohort: "UG 2028",
    vertical: "Quant",
    appliedAt: "2026-09-08T11:02:00Z",
    state: "interview",
    readBy: ["Sara Qureshi", "Arjun Menon"],
  },
  {
    id: "a3",
    name: "Lakshmi Iyengar",
    cohort: "UG 2029",
    vertical: "Macro & Fixed Income",
    appliedAt: "2026-09-09T05:45:00Z",
    state: "submitted",
    readBy: [],
  },
  {
    id: "a4",
    name: "Oliver D'Souza",
    cohort: "ASP 2027",
    vertical: "Equities",
    appliedAt: "2026-09-09T09:31:00Z",
    state: "submitted",
    readBy: [],
  },
  {
    id: "a5",
    name: "Riya Kulkarni",
    cohort: "UG 2028",
    vertical: "Quant",
    appliedAt: "2026-09-07T16:12:00Z",
    state: "offered",
    readBy: ["Sara Qureshi", "Arjun Menon"],
  },
];

// ---------------------------------------------------------------------------
// A closed position, with the outcome beside what the author originally said
// ---------------------------------------------------------------------------

export interface ClosedPosition extends Position {
  closedAt: string;
  exitPaise: bigint;
  /** Did the falsifier trigger, and was it acted on? */
  falsifierTriggered: boolean;
  outcome: string;
  reflection: string;
}

export const closedPositions: ClosedPosition[] = [
  {
    id: "p3",
    ticker: "ASIANPAINT",
    name: "Asian Paints",
    openedAt: "2026-02-11T04:15:00Z",
    closedAt: "2026-04-21T09:45:00Z",
    entryPaise: 2_884_50n,
    exitPaise: 2_512_75n,
    lastPaise: 2_512_75n,
    quantity: 30,
    thesis:
      "Crude-linked input costs have fallen 18% from the peak and the company has not yet passed the benefit through to margins, so the next two quarters should show gross-margin expansion of 150–200 bp while volume growth holds at high single digits. The market is treating the input-cost move as already reflected.",
    keyRisk:
      "A new entrant with a large balance sheet starts a price war, so the input-cost benefit is competed away rather than kept.",
    falsifier:
      "Gross margin flat or down in either of the next two quarters, or volume growth below 5%.",
    status: "closed",
    series: [2884, 2901, 2860, 2795, 2740, 2688, 2601, 2512],
    falsifierTriggered: true,
    outcome:
      "Gross margin fell 40 bp in the March quarter and volume growth printed 3.1%. Both halves of the falsifier triggered in the same result. The position was closed nine days later at a loss of ₹11,152.50.",
    reflection:
      "The falsifier worked exactly as written and I still waited nine days to act on it, which is the part worth recording. The thesis was not wrong about input costs; it was wrong that the benefit would be kept rather than competed away — which is what the key risk said, and I sized as though the risk were remote.",
  },
];

// ---------------------------------------------------------------------------
// Sparse variants: what September actually looks like
// ---------------------------------------------------------------------------

export const sparse = {
  note: "Sparse view — the club's first weeks, when there is not much data yet. This is the state most screens will be in for the first month of a season.",
  /** Six members, not fifteen. */
  memberIds: ["m01", "m04", "m05", "m06", "m09", "m14"],
  /** Four resolved forecasts is not a calibration curve. */
  resolvedForecasts: 4,
  calibrationBins: [
    { bin: 30, predicted: 0.3, observed: 0, count: 1 },
    { bin: 60, predicted: 0.6, observed: 0.5, count: 2 },
    { bin: 80, predicted: 0.8, observed: 1, count: 1 },
  ],
  /** Two published notes. */
  noteSlugs: ["tcs-margin-trajectory-fy27"],
  rsvps: 3,
};
