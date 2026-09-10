import {
  Chip,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  When,
  buttonClass,
  td,
  tdNum,
  th,
  thNum,
} from "@/components/preview/ui";
import { adminMembers, applicants, memberById } from "@/preview-data";
import { AdminNav } from "../nav";

export const metadata = { title: "Admin — members" };

export default function AdminMembersPage() {
  return (
    <main className="flex flex-col gap-8">
      <PageHeader
        title="Members"
        lede="The roster, roles and verticals, plus this round's applicants. Every change here writes to the audit log with actor, timestamp, before and after."
      />
      <AdminNav />

      <Section title="Applicant review">
        <p className="mb-3 max-w-prose text-[15px] text-wows-muted">
          Applications are read with names hidden; the names appear here only
          once two readers have recorded a view. Promoting an applicant grants
          the <span className="numeric">member</span> role for the current
          season.
        </p>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Applicant</th>
              <th className={th}>Cohort</th>
              <th className={th}>Vertical</th>
              <th className={th}>Applied</th>
              <th className={th}>Read by</th>
              <th className={th}>State</th>
              <th className={thNum}>Action</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((a) => (
              <tr key={a.id}>
                <td className={td}>{a.name}</td>
                <td className={td}>
                  <span className="numeric text-wows-muted">{a.cohort}</span>
                </td>
                <td className={td}>
                  <span className="text-wows-muted">{a.vertical}</span>
                </td>
                <td className={td}>
                  <When
                    iso={a.appliedAt}
                    withTime={false}
                    className="text-wows-muted"
                  />
                </td>
                <td className={td}>
                  {a.readBy.length === 0 ? (
                    <span className="text-wows-muted">Nobody yet</span>
                  ) : (
                    <span className="numeric text-wows-muted">
                      {a.readBy.length} of 2
                    </span>
                  )}
                </td>
                <td className={td}>
                  <Chip
                    tone={
                      a.state === "offered"
                        ? "positive"
                        : a.state === "submitted"
                          ? "neutral"
                          : "warn"
                    }
                  >
                    {a.state.replace("_", " ")}
                  </Chip>
                </td>
                <td className={tdNum}>
                  <button type="button" className={buttonClass.quiet}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Roster">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Vertical</th>
              <th className={th}>Role</th>
              <th className={thNum}>Forecasts</th>
              <th className={thNum}>Notes</th>
              <th className={th}>Last seen</th>
              <th className={thNum}>Role change</th>
            </tr>
          </thead>
          <tbody>
            {adminMembers.map((m) => {
              const member = memberById(m.memberId);
              return (
                <tr key={m.memberId}>
                  <td className={td}>
                    <span className="font-medium text-wows-ink">
                      {member.name}
                    </span>
                    {m.status === "inactive" ? (
                      <Chip className="ml-2">Inactive</Chip>
                    ) : null}
                  </td>
                  <td className={td}>
                    <span className="text-wows-muted">{member.vertical}</span>
                  </td>
                  <td className={td}>
                    <Chip tone={m.role === "member" ? "neutral" : "warn"}>
                      {m.role}
                    </Chip>
                  </td>
                  <td className={tdNum}>{m.forecasts}</td>
                  <td className={tdNum}>{m.notes}</td>
                  <td className={td}>
                    <When iso={m.lastSeen} className="text-wows-muted" />
                  </td>
                  <td className={tdNum}>
                    <button type="button" className={buttonClass.quiet}>
                      {m.role === "member" ? "Promote" : "Change"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Section>

      <Panel tone="accent">
        <h2 className="text-[15px] font-semibold text-wows-ink">
          Roles are additive
        </h2>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          A person holds any number of roles.{" "}
          <span className="numeric">core</span>,{" "}
          <span className="numeric">faculty</span>,{" "}
          <span className="numeric">alum</span> and{" "}
          <span className="numeric">applicant</span> are global;{" "}
          <span className="numeric">member</span> and{" "}
          <span className="numeric">lead</span> are granted per season, so
          removing someone from this season does not erase last season&rsquo;s
          record. Who leads a vertical is derived from the season&rsquo;s lead
          role plus that person&rsquo;s vertical, not stored separately.
        </p>
      </Panel>
    </main>
  );
}
