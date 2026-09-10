import Link from "next/link";
import {
  Chip,
  PageHeader,
  Panel,
  TableWrap,
  When,
  td,
  tdNum,
  th,
  thNum,
} from "@/components/preview/ui";
import { directory, faculty, memberById, sparse } from "@/preview-data";

export const metadata = { title: "Members" };

/**
 * The directory. Deliberately carries no performance figures: a member's
 * standing belongs on the leaderboard they opted into, not beside their name
 * in a list everyone browses.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const isSparse = (await searchParams).state === "sparse";
  const entries = isSparse
    ? directory.filter((d) => sparse.memberIds.includes(d.memberId))
    : directory;

  const byVertical = ["Equities", "Macro & Fixed Income", "Quant"] as const;

  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Members"
        lede="Everyone in the club this season, with what they have published. No returns, no ranks, no standings — those live on the leaderboard, which is a thing you opt into."
      />

      {isSparse ? (
        <Panel tone="accent">
          <p className="text-[12.5px] leading-relaxed text-wows-muted">
            {sparse.note}
          </p>
        </Panel>
      ) : null}

      <p className="numeric text-[12.5px] text-wows-muted">
        {entries.length} members · 1 faculty adviser ·{" "}
        <Link
          href={isSparse ? "/members" : "/members?state=sparse"}
          className="underline underline-offset-4"
        >
          {isSparse ? "show the full roster" : "show the sparse view"}
        </Link>
      </p>

      {byVertical.map((vertical) => {
        const rows = entries.filter(
          (d) => memberById(d.memberId).vertical === vertical,
        );
        if (rows.length === 0) {
          return (
            <section key={vertical} className="border-t border-wows-rule pt-4">
              <h2 className="text-xl font-semibold tracking-tight text-wows-ink">
                {vertical}
              </h2>
              <p className="mt-2 text-[15px] text-wows-muted">
                Nobody has joined this vertical yet. It opens when its lead is
                appointed.
              </p>
            </section>
          );
        }
        return (
          <section key={vertical} className="border-t border-wows-rule pt-4">
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-wows-ink">
              {vertical}
            </h2>
            <TableWrap>
              <thead>
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Cohort</th>
                  <th className={th}>Role</th>
                  <th className={thNum}>Published</th>
                  <th className={th}>Member since</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const m = memberById(d.memberId);
                  return (
                    <tr key={d.memberId}>
                      <td className={td}>
                        <span className="font-medium text-wows-ink">
                          {m.name}
                        </span>
                      </td>
                      <td className={td}>
                        <span className="numeric text-wows-muted">
                          {m.cohort}
                        </span>
                      </td>
                      <td className={td}>
                        {d.role === "member" ? (
                          <span className="text-wows-muted">Member</span>
                        ) : (
                          <Chip tone={d.role === "alum" ? "neutral" : "warn"}>
                            {d.role[0]!.toUpperCase() + d.role.slice(1)}
                          </Chip>
                        )}
                      </td>
                      <td className={tdNum}>
                        {d.latestNote ? (
                          <Link
                            href={`/research/${d.latestNote}`}
                            className="text-wows-accent underline underline-offset-4"
                          >
                            {d.published}
                          </Link>
                        ) : d.published > 0 ? (
                          d.published
                        ) : (
                          <span className="text-wows-muted">—</span>
                        )}
                      </td>
                      <td className={td}>
                        <When
                          iso={`${d.joined}T00:00:00Z`}
                          withTime={false}
                          className="text-wows-muted"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </section>
        );
      })}

      <section className="border-t border-wows-rule pt-4">
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-wows-ink">
          Faculty
        </h2>
        <p className="text-[15px] text-wows-ink">
          {faculty.name}
          <span className="ml-2 text-wows-muted">{faculty.title}</span>
        </p>
      </section>
    </main>
  );
}
