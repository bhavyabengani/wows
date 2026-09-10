"use client";

import { useState } from "react";
import { cn } from "cn";
import { buttonClass } from "@/components/preview/ui";
import { kiosk } from "@/preview-data";

type Stage = "entry" | "playing" | "score";

/** Deliberately a different object from the member product: a lit cabinet
 *  rather than a page, display type, one action per screen, no navigation. */
export function KioskRunner() {
  const [stage, setStage] = useState<Stage>("entry");
  const [name, setName] = useState("");
  const [index, setIndex] = useState(0);
  const [chose, setChose] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const question = kiosk.questions[index];

  return (
    <div className="glow-accent relative overflow-hidden border border-wows-accent/60 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgb(255_46_99/0.22),transparent_65%),linear-gradient(180deg,#160a12_0%,#0a0710_100%)] px-6 py-10 text-wows-ink sm:px-10 sm:py-14">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-wows-accent to-transparent"
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-wows-rule pb-4">
          <p className="text-lg font-bold tracking-tight">
            <span className="glow-text text-wows-accent">WOWS</span>{" "}
            <span className="font-normal text-wows-muted">quiz</span>
            <span className="numeric ml-3 border border-wows-data/50 px-1.5 py-0.5 align-middle text-[10px] tracking-widest text-wows-data">
              KIOSK
            </span>
          </p>
          <p className="numeric text-xs text-wows-muted">{kiosk.stall}</p>
        </div>

        {stage === "entry" ? (
          <div className="flex flex-col gap-5">
            <h1 className="text-[32px] leading-[1.05] font-bold tracking-tight sm:text-[40px]">
              Three questions.
              <br />
              Two minutes.
            </h1>
            <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
              How well do you actually understand a bond? Get all three and your
              name goes on the board. No account, nothing installed, and we do
              not keep your email after the day is over.
            </p>
            <div className="flex flex-col gap-3 sm:max-w-sm">
              <label htmlFor="kiosk-name" className="text-sm font-medium">
                Your name
              </label>
              <input
                id="kiosk-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name is enough"
                className="border border-wows-rule bg-wows-surface/60 px-3 py-2.5 text-[15px] text-wows-ink placeholder:text-wows-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
              />
              <label htmlFor="kiosk-email" className="mt-2 text-sm font-medium">
                Email <span className="text-wows-muted">(optional)</span>
              </label>
              <input
                id="kiosk-email"
                type="email"
                placeholder="Only if you want to hear about applications"
                className="border border-wows-rule bg-wows-surface/60 px-3 py-2.5 text-[15px] text-wows-ink placeholder:text-wows-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
              />
            </div>
            <button
              type="button"
              onClick={() => setStage("playing")}
              className="inline-flex w-full items-center justify-center glow-accent bg-wows-accent px-4 py-3 text-[15px] font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft sm:max-w-sm"
            >
              Start
            </button>
          </div>
        ) : null}

        {stage === "playing" && question !== undefined ? (
          <div className="flex flex-col gap-5">
            <p className="numeric text-xs text-wows-muted">
              Question {index + 1} of {kiosk.questions.length}
            </p>
            <h1 className="max-w-prose text-[22px] leading-snug font-semibold sm:text-[26px]">
              {question.prompt}
            </h1>
            <ul className="flex flex-col gap-2">
              {question.options.map((o) => {
                const revealed = chose !== null;
                const isAnswer = o.key === question.answer;
                const isChosen = chose === o.key;
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      disabled={revealed}
                      onClick={() => {
                        setChose(o.key);
                        if (o.key === question.answer) setScore((s) => s + 1);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 border px-3 py-3 text-left text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft",
                        !revealed &&
                          "border-wows-rule hover:border-wows-accent hover:bg-wows-accent/10",
                        revealed &&
                          isAnswer &&
                          "glow-accent border-wows-accent bg-wows-accent/15 font-semibold text-wows-ink",
                        revealed &&
                          isChosen &&
                          !isAnswer &&
                          "border-wows-rule text-wows-muted line-through",
                        revealed &&
                          !isAnswer &&
                          !isChosen &&
                          "border-wows-rule/60 text-wows-muted",
                      )}
                    >
                      <span className="numeric shrink-0 text-wows-muted">
                        {o.key})
                      </span>
                      <span>{o.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {chose !== null ? (
              <div className="border-t border-wows-rule pt-4">
                <p className="max-w-prose text-[15px] leading-relaxed text-wows-muted">
                  {question.explanation}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (index + 1 >= kiosk.questions.length) {
                      setStage("score");
                      return;
                    }
                    setIndex(index + 1);
                    setChose(null);
                  }}
                  className="mt-4 inline-flex items-center justify-center glow-accent bg-wows-accent px-4 py-2.5 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
                >
                  {index + 1 >= kiosk.questions.length
                    ? "See your score"
                    : "Next"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {stage === "score" ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[15px] text-wows-muted">
                {name.trim() === "" ? "Nice work" : `Nice work, ${name.trim()}`}
              </p>
              <p className="numeric figure-lit mt-1 text-[56px] leading-none font-medium">
                {score}
                <span className="text-[0.45em] font-normal text-wows-muted">
                  {" "}
                  / {kiosk.questions.length}
                </span>
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Today at the stall
              </h2>
              <ol className="mt-2 flex flex-col">
                {kiosk.leaderboard.map((row, i) => (
                  <li
                    key={`${row.name}-${i}`}
                    className="flex items-baseline justify-between gap-4 border-b border-wows-rule py-2 text-[15px]"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="numeric text-wows-muted">{i + 1}</span>
                      {row.name}
                    </span>
                    <span className="numeric text-wows-muted">
                      {row.score}/{kiosk.questions.length} · {row.seconds}s
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="border-t border-wows-rule pt-4 text-[12.5px] leading-relaxed text-wows-muted">
              {kiosk.note}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setStage("entry");
                  setName("");
                  setIndex(0);
                  setChose(null);
                  setScore(0);
                }}
                className="inline-flex items-center justify-center glow-accent bg-wows-accent px-4 py-2.5 text-sm font-semibold text-wows-paper hover:bg-wows-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
              >
                Next person
              </button>
              <a
                href="/apply"
                className={cn(
                  buttonClass.secondary,
                  "border-wows-accent/60 text-wows-accent-soft hover:bg-wows-accent/10",
                )}
              >
                Apply to the club
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
