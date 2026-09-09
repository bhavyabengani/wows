# Engine rules

Rules the simulation engine and every table that stores its output must
follow. They live here, not in comments, so that a rule can be read, argued
with and cited without opening a file of TypeScript.

The engine is `src/engine/`: a pure, deterministic library with no knowledge
of HTTP, React, Next.js or the database. Prices arrive through an injected
accessor, time arrives as an argument, randomness arrives as seeded state.
`src/engine/architecture.test.ts` fails if any of that stops being true.

## Numbers

**Money is integer paise (H12).** Every currency column is `bigint` and is
named with a `_paise` suffix (`price_paise`, `open_paise`). One rupee is
`100n` paise. In TypeScript, currency is `bigint`, never `number`; Drizzle
columns use `mode: "bigint"`. Display formatting divides by 100 at the last
possible moment, in the presentation layer, and never feeds back into
arithmetic.

**Quantities are `numeric(18, 4)`.** Four decimal places is the fixed scale
for instrument quantities (`orders.quantity`, `fills.quantity`,
`holdings_cache.quantity`). Drizzle returns `numeric` as a string; the engine
parses it into a fixed-point integer of ten-thousandths (`bigint`) and never
into a float.

**One rounding rule, applied once.** When a computation produces a quantity
or a paise amount with more precision than its scale, round **half away from
zero** to the scale, at the single point where the value is produced. Never
round intermediate results; never round twice. The only functions allowed to
round are `divRoundHalfAwayFromZero`, `valueOf` and `feeOn` in
`src/engine/money.ts`.

**The one exception: a buy quantity floors.** Converting a target weight into
a quantity at scale 4 under the global rule can round _up_, and an order that
rounds up overdraws cash by a paise. So buy quantities floor to the scale and
the remainder stays in cash (`affordableQuantity`, `divFloor`). This is a
stated exception, written beside the rule it excepts, so that nobody later
"corrects" it back and reintroduces the overdraw.

**Never `Number` for anything scored.** `parseFloat`, `toFixed`, and
floating-point division are defects in engine code and in any code that
writes to `orders`, `fills`, `holdings_cache`, `scores` or `price_bars`.

## Owed by Phase 3, from the market data (Phase 2)

Recorded here so these do not live only in a data file's comments. See
`docs/DATA.md` for the evidence behind each.

**A day with no trade: carry forward, and record that you did.** Decided
9 September 2026; applies to every missing bar, whatever the cause.

Two causes exist today and the policy is the same for both. `LTGILTBEES` has
no bar on about one trading day in ten because long-dated gilt ETFs on the NSE
are thinly traded. Separately, four rows were removed from the snapshot as
recorded source defects, so `GOLDBEES` and `NIFTYBEES` have no bar on 19 and
20 December 2019, inside the replay window.

The data layer never invents a price. The engine, on a day the calendar says
the market was open but an instrument has no bar:

- values the holding at that instrument's **previous available close**;
- marks the valuation as having used a **synthetic bar**, carrying the date of
  the close it actually used;
- surfaces that marking in whatever it returns, so a run touching those days
  is auditable rather than merely plausible.

It must never fall out of a null. A missing bar that silently becomes zero, or
that propagates as `undefined` into a valuation, is the kind of defect this
whole pipeline exists to prevent. The same policy applies to any future
removal, so a new recorded defect never needs a new rule.

**Fixed deposits are not just a price series.** `FD1Y` is a rolling
reinvestment index: it re-rates whenever the published rate changes and knows
nothing about any individual member. Three things belong to the engine, not to
the data:

- the rate prevailing at _that member's_ deposit date, fixed for the tenure;
- lock-in, so a deposit cannot be moved freely between timesteps;
- the premature-withdrawal penalty.

That penalty is the actual educational content of a deposit against equity. A
game that lets a member move in and out of a deposit without cost teaches the
opposite of the intended lesson.

**Prices are adjusted to the fetch date, and carry no dividends.** Stored
levels are not the levels that traded, because the source adjusts history for
later splits. Returns are correct; absolute levels are not comparable to a
contemporary newspaper.

The `snapshots` table records this per version: `is_adjusted`,
`adjusted_as_of`, `price_basis` and `dividends_included`. The engine carries
these through to whatever it returns and does **not** act on them; a screen
renders "adjusted close (as of ...)" rather than a bare rupee figure. Deciding
to un-adjust was considered and rejected: see docs/DATA.md.

Every instrument is `price_return`, so comparisons between them, including the
debrief's counterfactuals, are consistent. All of them understate real equity
returns by roughly the dividend yield, which the debrief copy must say.

## The replay

**A step is a month, and lands on the last trading day of that month.** A
scenario declares a window and a monthly cadence; the step dates are the
calendar's own last trading day in each month of that window, so a step never
falls on a holiday and never needs a rule about what to do when it does. The
2019-2023 window gives 60 steps, which is a 15-to-25-minute session at roughly
20 seconds a step. Cadence is fixed per scenario, in its config.

**Trades execute at the close of the step the decision is made at.** Not the
next month's close. This is not look-ahead: the player cannot see beyond the
current step, and the price accessor cannot read beyond it either, so the
close being traded at is the last thing the player was shown before deciding.
Executing a month later would put a month of drift between a decision and its
fill, which teaches nothing and reads as a bug.

**The player sets target weights; the engine turns them into orders.** Weights
are whole basis points and must total exactly 10000, so no floating point
enters a decision. `CASH` is a valid weight and is simply not traded: whatever
is not deployed stays as cash. Orders are still written to the ledger, so the
audit trail and the schema are unchanged by this choice.

**Sells are planned before buys**, in sorted symbol order, so proceeds are
available to fund the buys and a full rebalance completes in one step. Sorted
order also means the plan never depends on the iteration order of a map, which
is what determinism requires.

**The final step is a valuation step.** Arriving at it completes the run:
there is no further month to hold through, so no action is accepted there.

**Every missing bar carries forward.** Decided 9 September 2026; see below.

## Cash flows

**Income lands in cash.** It is never auto-invested at current weights.
Deciding what to do with each month's money is the game.

**The expense shock does not force a liquidation.** Its size and timing are
drawn once, from the scenario's seed, inside the middle fraction of the run,
so every player of a scenario meets the same shock and a replay meets it
again. If cash covers it, it is absorbed and nothing is sold. Only when cash
falls short does the engine sell, largest holding first, and only as much as
the shortfall requires. Which of the two happened is **recorded on the ledger
entry**, not inferred later, because that contrast is the emergency-fund
lesson and the debrief has to be able to state it plainly.

**Idle cash earns nothing.** Inflation is not modelled either, so the cost of
holding cash is invisible except through the counterfactuals. The Phase 4
debrief copy has to say so, or a player will conclude that cash is free.

## Transaction costs

**10 basis points per side**, charged on the gross value of every trade,
including the initial deployment of the corpus and any later deployment of
income. A round trip therefore costs 20 bps. Charging "per round trip"
directly is not implementable: a ledger charges at trade time, and at trade
time nothing knows whether a buy will ever be sold.

The flat symmetric rate is a **deliberate simplification, not an oversight**.
Real Indian costs are asymmetric: roughly 3 bps to buy and 13 bps to sell
delivery equity, once securities transaction tax, stamp duty and exchange fees
are counted. A single symmetric number keeps the arithmetic explainable to a
first-year while preserving the thing that matters, which is that trading is
never free. Making over-trading costless would quietly gut the over-trading
finding the whole debrief is built around.

## The ledger

**Append-only entries are the truth (H13).** Portfolio state is folded from
them every time it is asked for. There is no mutable balance anywhere in the
engine.

An order is a record of intent and moves nothing; only its fill changes cash
or holdings. That is what lets a rejected or unfilled order sit in the ledger
without ever having touched a balance.

`holdings_cache` is a cache in the strict sense. `npm run engine:rebuild-cache`
truncates it and refolds it from `orders` and `fills`, and
`src/db/holdings-cache.db.test.ts` corrupts it deliberately and checks the
right answer comes back.

## Missing bars

**Carry the previous close forward, and record that you did.** Decided
9 September 2026; applies to every missing bar, whatever the cause, so a
future recorded defect never needs a new rule.

Two causes exist today. The gilt ETF has no trade on about one trading day in
ten because it is thinly traded. Separately, four rows were removed from the
snapshot as recorded source defects, so two ETFs have no bar on 19 and
20 December 2019, inside the replay window.

On a day the calendar says the market was open but an instrument has no bar,
the engine values the holding at that instrument's **previous available
close**, marks the quote `synthetic`, and carries `asOfDate`, the date the
close actually came from. Every valuation that touched one says so, so a run
is auditable rather than merely plausible. It must never fall out of a null: a
missing bar that silently becomes zero, or propagates as `undefined` into a
valuation, is the defect this whole pipeline exists to prevent.

## The debrief

Every figure the debrief shows is a **pure function over the ledger with a
definition written here**. Nothing calls a model: the non-goals forbid
AI-generated investment analysis presented as club output, and feedback given
in the club's name has to be reproducible and explainable to the member who
disagrees with it.

**The counterfactuals run through the same valuation path as the player**, and
receive the same cash flows: same income, same expenses, same shock at the
same step. Otherwise the comparison would measure the cash flows rather than
the decisions.

- **Did nothing.** The weights the player _opened_ with, deployed once at step
  0 and held to the end. Not their latest weights, which they only reached by
  trading.
- **All index.** The whole corpus in the scenario's benchmark, deployed once
  and never touched.

**Describe, never prescribe.** Every sentence the debrief emits must survive
this test. "You sold 62% of your equity in March 2020 and rebought in August"
is a description. "You should have held" is advice, and the club has committed
in writing to giving none. A sentence that names a better decision, implies
one, or grades the player has failed the test, however gently it is phrased.
The copy lives in `src/lib/runs/debrief.ts` and every addition to it is
reviewed against this line.

**One finding, chosen by rule.** Three metrics are computed; one is shown. The
one displayed is the metric furthest past its stated benchmark, measured as a
fraction of that benchmark so the three are comparable. Ties break in a fixed
order: panic selling, then over-trading, then concentration. If nothing is past
its benchmark, the screen says so rather than manufacturing a finding out of
the least unremarkable number. Benchmarks are one turn of the portfolio
(turnover), any episode at all (panic selling), and two fifths of the book in
one holding (concentration).

**Over-trading.** Turnover is the gross value of every trade **after step 0**,
over the mean end-of-step portfolio value, in basis points. Step 0 is excluded
because deploying the corpus is starting, not trading, and counting it would
hand a buy-and-hold player a turnover figure they never earned; its cost is
still counted, because the player did pay it. A **reversal** is a trade in an
instrument whose side is opposite to the previous trade in that same
instrument within the last 2 steps.

**Panic selling.** An episode is a step at which the player sold at least 10%
of portfolio value while the portfolio was at least 10% below its own trailing
peak. It deliberately uses only what was knowable at that step: a test of the
form "and it recovered afterwards" would judge the player by hindsight they
did not have. What is measured is the decision, not the outcome.

**Concentration.** The largest single holding's weight at each step, averaged
across steps (time-weighted), plus the peak weight, the step it occurred, and
the instrument. Cash is not a holding for this purpose.

## Determinism and idempotency

**All randomness comes from the scenario's seed (H14).** `Math.random` is
banned and enforced by the architecture test. The generator is mulberry32,
committed in `src/engine/prng.ts`: well known, short enough to read in full,
and its entire state is one unsigned 32-bit integer, which is what makes a run
serialisable mid-flight. The seed is text, hashed to 32 bits with FNV-1a.

Randomness is used for exactly one thing: the shock's size and timing.

**Every action carries a client-generated idempotency key (H16).** Submitting
a key that has already been applied returns the _original_ entries and creates
nothing. The database's unique constraint on `(run_id, idempotency_key)` is
the backstop; the engine has no database, so it must hold the guarantee itself.

**A run serialises to JSON losslessly (H18)**, including decimal quantities
and the generator's state, so a resumed run produces the same subsequent
output as one that was never interrupted. Every `bigint` is written as a
tagged decimal string, because `JSON.stringify` throws on bigint and a codec
that used `number` would round above 2^53.

## Golden files

`src/engine/__goldens__/` holds a full ledger, per-step derived state, both
counterfactuals and the behavioural metrics for three fixed runs: a passive
one, an active one, and one whose shock forces a sale. CI fails on any
difference.

They are the main defence against a later edit quietly changing what a
portfolio is worth, so **regenerating them is a deliberate, reviewed act**:
`npm run engine:regenerate-goldens -- --confirm`, having first understood
which behaviour changed and why it should, with the reason recorded in the
commit message. A change nobody can explain is a bug, not a new golden.

Their bytes are compared directly, so no formatter, linter or code generator
may rewrite them (CLAUDE.md).
