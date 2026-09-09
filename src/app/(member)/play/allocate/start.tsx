"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Starting a run. Ranked or practice is chosen once and cannot be changed
 * afterwards, so the difference is spelled out rather than hidden behind a
 * toggle label.
 */
export function StartRun({
  gameInstanceId,
  scenarioName,
}: {
  gameInstanceId: string;
  scenarioName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"ranked" | "practice">("practice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ error: string; detail?: string } | null>(
    null,
  );

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/play/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameInstanceId, mode }),
      });
      const body = (await response.json()) as {
        runId?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok || body.runId === undefined) {
        // Never pretend a failed start worked (H34).
        setError({
          error: body.error ?? "The run could not be started",
          detail: body.detail,
        });
        return;
      }
      router.push(`/play/allocate?run=${body.runId}`);
      router.refresh();
    } catch {
      setError({
        error: "The run could not be started",
        detail: "The server could not be reached. Nothing was created.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="max-w-prose text-[15px] text-wows-ink">
        {scenarioName}. Sixty monthly steps through a real stretch of market
        history, on a pinned snapshot of end-of-day prices.
      </p>

      <fieldset className="mt-6">
        <legend className="text-[15px] font-semibold text-wows-ink">
          How do you want to play?
        </legend>
        <div className="mt-3 flex flex-col gap-3">
          {[
            {
              value: "practice" as const,
              title: "Practice",
              body: "Unlimited, never ranked, never shown on a leaderboard. Start as many as you like.",
            },
            {
              value: "ranked" as const,
              title: "Ranked",
              body: "One attempt for this scenario version, and it counts. You cannot restart it.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 border p-4 ${
                mode === option.value
                  ? "border-wows-accent bg-wows-surface"
                  : "border-wows-rule"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="mt-1 accent-wows-accent"
              />
              <span>
                <span className="block text-[15px] font-medium text-wows-ink">
                  {option.title}
                </span>
                <span className="block text-[13px] text-wows-muted">
                  {option.body}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="mt-5 border-l-[3px] border-wows-accent bg-wows-surface p-4"
        >
          <p className="text-[15px] font-semibold text-wows-ink">
            {error.error}
          </p>
          {error.detail ? (
            <p className="mt-1 text-[15px] text-wows-muted">{error.detail}</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={start}
        disabled={busy}
        data-testid="start-run"
        data-game-instance={gameInstanceId}
        className="mt-6 inline-flex items-center justify-center bg-wows-accent px-4 py-2 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft disabled:opacity-50"
      >
        {busy ? "Starting…" : `Start a ${mode} run`}
      </button>
    </div>
  );
}
