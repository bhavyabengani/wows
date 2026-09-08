import { cn } from "cn";
import { PageHeader, When, td, th, TableWrap } from "@/components/preview/ui";
import { auditEntries } from "@/preview-data";

export const metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        lede="Every admin action that changes what members see: who, what, before, after, when. Append-only; nothing here can be edited or deleted. Score overrides require a reason."
      />
      <TableWrap>
        <thead>
          <tr>
            <th scope="col" className={cn(th, "w-14")}>
              ID
            </th>
            <th scope="col" className={cn(th, "w-40")}>
              When
            </th>
            <th scope="col" className={th}>
              Actor
            </th>
            <th scope="col" className={th}>
              Action
            </th>
            <th scope="col" className={th}>
              Entity
            </th>
            <th scope="col" className={th}>
              Before
            </th>
            <th scope="col" className={cn(th, "pr-0")}>
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {auditEntries.map((a) => (
            <tr key={a.id}>
              <td className={cn(td, "numeric text-wows-muted")}>{a.id}</td>
              <td className={cn(td, "whitespace-nowrap text-wows-muted")}>
                <When iso={a.at} />
              </td>
              <td className={td}>{a.actor}</td>
              <td className={td}>
                <code className="text-xs text-wows-ink">{a.action}</code>
                {a.reason ? (
                  <span className="mt-0.5 block text-xs text-wows-muted">
                    Reason: {a.reason}
                  </span>
                ) : null}
              </td>
              <td className={cn(td, "text-wows-muted")}>
                <code className="text-xs">{a.entity}</code>
              </td>
              <td className={cn(td, "font-mono text-xs text-wows-muted")}>
                {a.before ?? "—"}
              </td>
              <td className={cn(td, "pr-0 font-mono text-xs text-wows-ink")}>
                {a.after ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </main>
  );
}
