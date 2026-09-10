import {
  Callout,
  Chip,
  PageHeader,
  Section,
  TableWrap,
  buttonClass,
  td,
  tdNum,
  th,
  thNum,
} from "@/components/preview/ui";
import { adminGames } from "@/preview-data";
import { AdminNav } from "../nav";

export const metadata = { title: "Admin — games" };

export default function AdminGamesPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Games"
        lede="Scenarios, their versions, and the game instances that put a version in front of a season."
      />
      <AdminNav />

      <Section title="Scenarios and instances">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Scenario</th>
              <th className={thNum}>Version</th>
              <th className={th}>Window</th>
              <th className={thNum}>Steps</th>
              <th className={thNum}>Universe</th>
              <th className={th}>Season</th>
              <th className={th}>State</th>
              <th className={thNum}>Runs</th>
              <th className={thNum}>Action</th>
            </tr>
          </thead>
          <tbody>
            {adminGames.map((g) => (
              <tr key={`${g.scenario}-${g.version}`}>
                <td className={td}>
                  <span className="font-medium text-wows-ink">
                    {g.scenario}
                  </span>
                  {g.pinnedTo ? (
                    <span className="mt-0.5 block text-xs text-wows-muted">
                      pinned to {g.pinnedTo}
                    </span>
                  ) : null}
                </td>
                <td className={tdNum}>v{g.version}</td>
                <td className={td}>
                  <span className="numeric text-xs text-wows-muted">
                    {g.window}
                  </span>
                </td>
                <td className={tdNum}>{g.steps}</td>
                <td className={tdNum}>{g.universe}</td>
                <td className={td}>
                  <span className="text-wows-muted">{g.instanceSeason}</span>
                </td>
                <td className={td}>
                  <Chip
                    tone={
                      g.state === "open"
                        ? "accent"
                        : g.state === "draft"
                          ? "neutral"
                          : "positive"
                    }
                  >
                    {g.state}
                  </Chip>
                </td>
                <td className={tdNum}>
                  {g.runs.completed + g.runs.inProgress}
                  <span className="block text-xs text-wows-muted">
                    {g.runs.completed} done · {g.runs.inProgress} live ·{" "}
                    {g.runs.abandoned} left
                  </span>
                </td>
                <td className={tdNum}>
                  <button
                    type="button"
                    className={buttonClass.quiet}
                    disabled={g.state === "closed"}
                  >
                    {g.state === "draft" ? "Open" : "Close"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      <Callout>
        <h2 className="text-[15px] font-semibold text-wows-ink">
          A scenario is never edited in place
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Changing a universe, a window, a cost or a seed creates a new version.
          A leaderboard is pinned to the version its runs were played on, so two
          members can never be compared across different rules. That is why v2
          of First replay is a separate row rather than an edit to v1, even
          though the only difference is one instrument.
        </p>
      </Callout>

      <Callout>
        <h2 className="text-[15px] font-semibold text-wows-ink">
          Ranked and practice
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          Each member gets one ranked attempt per scenario version and unlimited
          practice runs. Abandoning a ranked run consumes the attempt: otherwise
          a member could start ranked, see what is coming, abandon, and restart
          knowing the future. A run lost to a genuine accident is restored here,
          as an admin action with a reason, and the restore is written to the
          audit log.
        </p>
      </Callout>
    </main>
  );
}
