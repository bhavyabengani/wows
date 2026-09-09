# WOWS Portal — Phase 2: Market data pipeline

This session is **Phase 2 of 12**. Phases 0 and 1 are merged and green: repo, CI, deployment, full schema with forward-only migrations, RLS, magic-link auth, seed, backups. Do not do anything from Phase 3 onward — in particular, **do not write any engine, valuation, or order logic**. Read this prompt, then `CLAUDE.md`, then the actual schema for `instruments`, `price_bars`, and `scenarios` before touching the filesystem. Where this prompt and the merged schema disagree, the schema wins; note the difference in your summary.

## Working agreement (applies to every session)

- One phase per session. Read before writing. Small, reviewable commits.
- If a requirement is unclear or conflicts with the code, **stop and ask**. Open questions are listed at the end; some block work.
- No features beyond the brief. Every `[HARD]` requirement traceable to a test; update the "Tested by:" lines in `CLAUDE.md`.
- Every new dependency justified in `docs/DEPENDENCIES.md`.
- End with `docs/phases/phase-2.md`: built, deferred, deviations.

## Why this phase exists

The simulation is a **historical replay over pinned, versioned end-of-day data** — never live prices. That is the single most important architectural decision in the brief: no vendor, no keys, no market-hours logic, deterministic forever, and nothing that could be mistaken for a trading product. This phase builds the one-time ingestion that produces that snapshot. Get it boring and correct; nothing downstream can be trusted otherwise.

## Scope

1. A **standalone Python ingestion script**, committed to the repo, run manually, never a service. `[HARD] H37`: it lives in its own directory (e.g. `data/ingest/`) with its own pinned `requirements.txt` and is never imported by, bundled with, or merged into the Next.js app. The only link between them is the snapshot files it produces.
2. A **versioned snapshot**: instruments plus daily bars, committed to the repo as data files with a manifest.
3. A **loader** that populates `instruments` and `price_bars` from a snapshot into a clean database, reproducibly, with one command.
4. **Data quality checks** that run before a snapshot may be committed or loaded.
5. Tests for all of the above.

## Sources (from the brief)

NSE end-of-day bhavcopy archives; `yfinance` for `.NS` tickers; index history for Nifty 50 and Nifty 500; a gold proxy; a bond/gilt index proxy; and a **modelled** fixed-deposit rate series. Which specific instruments stand in for gold, gilts, and FD is not specified — see open question 2.

`[DECIDE]` from the brief, not yet resolved: redistribution terms for market data must be confirmed with the faculty advisor before any of it is visible outside logged-in members. Nothing in this phase is public, so this does not block, but record it in the summary and in `docs/DATA.md` as an unresolved item.

## Snapshot design

- **Reproducibility over freshness.** `yfinance` and other sources revise history retroactively (adjustments, corrections, delistings). Therefore the script has two stages: `fetch` writes the raw responses to `data/raw/<source>/<date-fetched>/` and those raw files are committed; `build` transforms committed raw files into the snapshot. Anyone in three years must be able to rebuild the identical snapshot from the committed raw files without network access. Never fetch during `build`.
- **Snapshot layout**: `data/snapshots/v<N>/instruments.csv`, `data/snapshots/v<N>/bars.csv` (or Parquet if justified), and `manifest.json` with: snapshot version, build timestamp (UTC), source file list with SHA-256, row counts per instrument, date range per instrument, the corporate-action policy applied, and the checksum of the built bars file. The manifest is how CI proves a snapshot was not edited by hand.
- `[HARD] H7`: **`price_bars` are immutable.** A correction is a new snapshot version `v<N+1>`, loaded alongside, never an edit. The loader refuses to load a version that already exists in the database and refuses to load a snapshot whose manifest checksum does not match its files.
- `[HARD] H12`: **all prices are integer paise.** `open/high/low/close` are integers in the CSV and `bigint` in the DB. In Python, never `float` for a price at any point — parse source strings to `Decimal`, quantize with `ROUND_HALF_EVEN` (or whichever rule `docs/ENGINE_RULES.md` already states — read it, and if it says something else, follow that and don't change it), then convert to `int` paise. A test asserts no `float` type ever holds a price value in the pipeline; a lint rule or type check, not just a comment.
- **Volume** is an integer number of units. The FD series has no volume; store zero or null consistently, and say which.
- **Corporate actions**: the brief allows either handling splits and bonuses in the data, or restricting the universe to instruments with none during the replay window. **You must state which choice was made** in `docs/DATA.md`. See open question 3 — do not decide alone.
- **Trading calendar**: the gap check needs an NSE holiday calendar for the covered years, stored in the snapshot (`calendar.csv`) so the check is reproducible offline.

## Quality checks (`check` command; fail loudly, exit non-zero)

Run on every snapshot before commit and again in the loader before insert:

- No gaps: every NSE trading day in each instrument's range has a bar; every bar falls on a trading day. Report the exact missing dates.
- No negative or zero prices. No negative volume.
- OHLC consistency: `low ≤ open, close ≤ high` for every row.
- No unadjusted split discontinuities: flag any day-over-day close ratio outside a stated band (e.g. below 0.6 or above 1.6) that is not explained by a listed corporate action or a documented market event. The band and the exceptions list live in the snapshot, not in code.
- No duplicate `(instrument, trade_date)`.
- Manifest checksums match files. Row counts match manifest.
- Index and proxy series cover the full date range of every scenario window that will use them (windows from open question 1).

Write the check report to `data/snapshots/v<N>/check-report.txt` and commit it.

## Loader

- `npm run db:load-snapshot -- v<N>` (or a Python entry point called by it — say which and why) loads instruments and bars in a single transaction, refusing on any check failure, existing version, or checksum mismatch. Loads must be reproducible: loading `v1` into two clean databases yields identical `price_bars` row sets (test this by comparing a sorted checksum of the table).
- Instruments carry `symbol`, `name`, `asset_class` (use the seven classes from the brief: large-cap index, mid/small-cap index, individual equity, government bonds, gold, fixed deposit, cash), and `is_active`. Cash has no bars.
- Update the Phase 1 seed: the placeholder scenario should now reference a real universe and date range from `v1`. Do **not** write `config_json` fields the engine hasn't defined yet — leave the placeholder config and note it.

## Tests

- **Python (pytest)**: each quality check on small fixtures that deliberately violate it; the paise conversion on awkward inputs (`1234.565`, `0.005`, strings with commas); the no-float guarantee; `build` is deterministic — building twice from the same raw files produces byte-identical output.
- **TypeScript (Vitest)**: loader refuses an existing version; loader refuses a bad checksum; loaded row counts match the manifest; two clean loads produce identical table checksums.
- **CI**: the Python tests run in CI as a separate job with its own pinned Python version. The `check` command runs in CI against every committed snapshot, so a hand-edited snapshot fails the build.
- Update "Tested by:" for H7 (now covered end to end), H11 (the snapshot _is_ the enforcement — note that; the "never live" test is that the app has no network call to any price source, which you can assert with a dependency/grep test), H12 (Python side), H37.

## Acceptance criteria — Phase 2 is done when

1. `db:reset && db:seed && db:load-snapshot v1` produces a working database with all instruments and bars, reproducibly, from a clean state.
2. Quality checks pass on `v1` and the check report is committed.
3. `build` is deterministic and offline; raw source files and the manifest are committed.
4. All pytest and Vitest tests above pass in CI, including the Python job.
5. `docs/DATA.md` exists: sources, fetch dates, universe with rationale, corporate-action policy, proxy choices, the FD model, the redistribution question, and how to produce `v2` when a correction is needed.
6. `docs/phases/phase-2.md` written.

## Open questions — stop and ask

1. **Replay windows.** The brief never says _which_ multi-year windows the scenarios will replay (e.g. 2007–2011, 2016–2021, 2019–2023). The snapshot's date range and the corporate-action decision both depend on this. Ask for at least the first scenario's window, and fetch generously around it.
2. **Proxies.** What stands in for gold (a gold ETF like GOLDBEES? spot INR gold?), gilts (a gilt index? a G-sec ETF?), and the fixed-deposit rate (which bank's historical card rates, or an RBI series, and modelled how — monthly compounding at the rate prevailing at deposit?). Each choice changes the game's lesson; ask rather than pick.
3. **Corporate actions.** Handle splits/bonuses via adjustment factors, or restrict the universe? Adjustment is more work and adds a place for silent errors; restriction limits the curated equity list. Ask which, and if restriction, ask for the curated universe (or propose ~15–20 large-caps for approval).
4. **Source availability.** NSE bhavcopy archive access is sometimes blocked from cloud IPs and the archive URL format has changed over the years; `yfinance` is unofficial and can break. Ask whether the user is comfortable with `yfinance` as the primary source with bhavcopy as cross-check, or the reverse. Whichever it is, the committed raw files make the choice recoverable.
5. **Snapshot size in git.** Multi-year daily bars for ~30 instruments is small (single-digit MB), but raw bhavcopy files for the same period are hundreds of files. Ask whether raw files should be committed directly or stored as a single compressed archive per fetch with its checksum in the manifest.
6. **Loader location.** The brief says the Python script's output is "committed or loaded as a versioned snapshot." Loading can be done from Python (psycopg, direct) or from TypeScript (Drizzle, reusing the schema types). TypeScript keeps one DB access path and reuses the append-only guarantees; Python keeps the pipeline self-contained. Recommend TypeScript; ask.
