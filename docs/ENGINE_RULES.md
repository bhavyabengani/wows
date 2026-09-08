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
