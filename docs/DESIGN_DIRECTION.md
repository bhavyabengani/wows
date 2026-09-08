# Design direction

**Reference point: a broadsheet financial page set on paper, with the
tabular discipline of an annual report.** Not a trading terminal, not an
admin template. The page is typeset, not decorated: authority comes from
type, rules and numbers, never from shadows, gradients or colour washes.

## Type pairing

- **Schibsted Grotesk** for interface and headlines. A newspaper grotesk
  with a firm, slightly narrow voice; reads well at 15px on a phone and has
  real presence at display size. Loaded through `next/font/google`, self-
  hosted at build, one variable weight axis.
- **IBM Plex Mono** for every number: prices, returns, ranks, scores,
  dates, times. True lining figures, tabular by construction, and it makes a
  column of paise line up like a ledger. Never used for labels or prose.

Four sizes only: display 40px (32px on phones) with tight leading, section
20px, body 15px, caption 12.5px. Weight, size and ink-versus-muted colour
carry hierarchy. No all-caps tracked labels anywhere.

## Grid and surface

Twelve columns inside a 1200px measure, 8px vertical rhythm. Paper
`#F6F5F2` is the ground; white surfaces sit on it separated by 1px rules in
`#E3DFDA`. Zero drop shadows. Treatment varies with importance: the
leaderboard is the page and gets no box at all; a secondary note gets a rule
above it; a callout gets an oxblood left rule; a form gets a white panel with
a rule border. Related things are separated by lines and space, like a
printed table.

## Colour

Oxblood `#5E011D` is the club's colour and is used as a **surface**: the
masthead bar, the one primary button on a screen, the selected leaderboard
tab, the current timestep marker, the locked state of a forecast. Green
`#14603C` is only ever text, for gains, and always with `+` and `▲`; losses
are oxblood text with `−` and `▼`. Everything else is ink, muted and rule.

## The signature move

**Numbers are the subject.** Wherever a page is about a figure, that figure
is set in Plex Mono at display size with paise dropped to caption size and
lower weight, and next to it an inline sparkline in ink: the six-week shape
of the thing. Portfolio value on the allocation cockpit, rank and Brier on
the dashboard, every row of the leaderboard. Charts have no axes and no
legends; the number beside them is the axis.

## Motion

One orchestrated moment per flow, answering the user's action: the
portfolio value counts to its new figure when you advance; the forecast
input settles into its oxblood recorded state on submit; the leaderboard
drawer slides open. Nothing moves on scroll, hover or load. Reduced motion
turns all of it off.
