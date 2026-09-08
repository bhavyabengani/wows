import { EDUCATIONAL_DISCLAIMER } from "@/lib/disclaimer";

/**
 * Persistent footer disclaimer. Rendered from the root layout so it appears
 * on every page; do not conditionally hide it.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-wows-rule bg-wows-surface">
      <div className="mx-auto max-w-4xl px-6 py-6 text-sm leading-relaxed text-wows-muted">
        <p>{EDUCATIONAL_DISCLAIMER}</p>
      </div>
    </footer>
  );
}
