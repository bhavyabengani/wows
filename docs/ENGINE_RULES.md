# Engine rules

Rules the simulation engine and every table that stores its output must
follow. Phase 1 states the numeric representation; Phase 3 extends this file
with matching, valuation and settlement rules.

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
round intermediate results; never round twice. Phase 3 names the exact
functions that are allowed to round.

**Never `Number` for anything scored.** `parseFloat`, `toFixed`, and
floating-point division are defects in engine code and in any code that
writes to `orders`, `fills`, `holdings_cache`, `scores` or `price_bars`.

## Owed by Phase 3, from the market data (Phase 2)

Recorded here so these do not live only in a data file's comments. See
`docs/DATA.md` for the evidence behind each.

**A day with no trade.** `LTGILTBEES` has no bar on about one trading day in
ten, because long-dated gilt ETFs on the NSE are thinly traded. The data layer
does not invent a price. The engine must mark a holding on such a day by
carrying the last close forward, and must say so wherever a value is shown.

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

**Prices are adjusted to the fetch date.** Stored levels are not the levels
that traded, because the source adjusts history for later splits. Returns are
correct; absolute levels are not comparable to a contemporary newspaper. If a
screen shows a price, it should say which snapshot version it came from.
