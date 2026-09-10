"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  Callout,
  Chip,
  Panel,
  Section,
  StepStrip,
  When,
  buttonClass,
} from "@/components/preview/ui";
import { quiz } from "@/preview-data";

type Answered = { questionId: string; chose: string; correct: boolean };

export function QuizRunner() {
  const [index, setIndex] = useState(0);
  const [chose, setChose] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [done, setDone] = useState(false);

  const question = quiz.questions[index];
  if (question === undefined) return null;

  const revealed = chose !== null;
  const correct = chose === question.answer;

  function submit(key: string) {
    if (revealed || question === undefined) return;
    setChose(key);
    setAnswers((prev) => [
      ...prev,
      { questionId: question.id, chose: key, correct: key === question.answer },
    ]);
  }

  function next() {
    if (index + 1 >= quiz.questions.length) {
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setChose(null);
  }

  if (done)
    return (
      <Summary
        answers={answers}
        onRestart={() => {
          setIndex(0);
          setChose(null);
          setAnswers([]);
          setDone(false);
        }}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold text-wows-ink">
            {quiz.title}
          </p>
          <p className="text-xs text-wows-muted">{quiz.bank}</p>
        </div>
        <div className="flex items-center gap-4">
          <StepStrip steps={quiz.questions.length} current={index + 1} />
          <span className="numeric text-xs text-wows-muted">
            {index + 1} / {quiz.questions.length}
          </span>
        </div>
      </div>

      <Panel>
        <p className="text-xs text-wows-muted">{question.topic}</p>
        <h2 className="mt-1 max-w-prose text-xl leading-snug font-semibold text-wows-ink">
          {question.prompt}
        </h2>

        <ul
          className="mt-5 flex flex-col gap-2"
          role="radiogroup"
          aria-label="Answer"
        >
          {question.options.map((o) => {
            const isChosen = chose === o.key;
            const isAnswer = o.key === question.answer;
            const showRight = revealed && isAnswer;
            const showWrong = revealed && isChosen && !isAnswer;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isChosen}
                  disabled={revealed}
                  onClick={() => submit(o.key)}
                  className={cn(
                    "flex w-full items-start gap-3 border px-3 py-2.5 text-left text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft",
                    !revealed &&
                      "border-wows-rule bg-wows-surface text-wows-ink hover:border-wows-ink",
                    showRight &&
                      "border-wows-positive bg-wows-surface text-wows-ink",
                    showWrong &&
                      "border-wows-accent bg-wows-surface text-wows-ink",
                    revealed &&
                      !showRight &&
                      !showWrong &&
                      "border-wows-rule bg-wows-paper text-wows-muted",
                  )}
                >
                  <span className="numeric shrink-0 text-wows-muted">
                    {o.key})
                  </span>
                  <span className="flex-1">{o.text}</span>
                  {showRight ? (
                    <span className="shrink-0 text-sm font-semibold text-wows-positive">
                      ✓ correct
                    </span>
                  ) : null}
                  {showWrong ? (
                    <span className="shrink-0 text-sm font-semibold text-wows-accent">
                      ✕ your answer
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {revealed ? (
          <div className="mt-5 border-t border-wows-rule pt-4">
            <p className="text-[15px] font-semibold text-wows-ink">
              {correct ? "Right." : "Not this time."}
            </p>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
              {question.explanation}
            </p>
            <button
              type="button"
              className={cn(buttonClass.primary, "mt-4")}
              onClick={next}
            >
              {index + 1 >= quiz.questions.length
                ? "See summary"
                : "Next question"}
            </button>
          </div>
        ) : null}
      </Panel>

      <Callout>
        <p className="text-[12.5px] leading-relaxed text-wows-muted">
          {quiz.attempt.note}
        </p>
      </Callout>
    </div>
  );
}

function Summary({
  answers,
  onRestart,
}: {
  answers: Answered[];
  onRestart: () => void;
}) {
  const score = answers.filter((a) => a.correct).length;
  const of = quiz.questions.length;
  return (
    <div className="flex flex-col gap-8">
      <Panel tone="accent">
        <p className="text-[12.5px] text-wows-muted">
          {quiz.title} · {quiz.bank}
        </p>
        <p className="numeric mt-2 text-[40px] leading-none font-medium text-wows-ink sm:text-[48px]">
          {score}
          <span className="text-[0.5em] font-normal text-wows-muted">
            {" "}
            / {of}
          </span>
        </p>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-wows-muted">
          The club median on this bank is{" "}
          <span className="numeric">{quiz.attempt.medianScore}</span> out of{" "}
          <span className="numeric">{of}</span>. The point of the median is
          context, not competition — this result is not ranked and not visible
          to anyone else.
        </p>
      </Panel>

      <Section title="Every question, with the reasoning">
        <ul className="flex flex-col border-t border-wows-rule">
          {quiz.questions.map((q) => {
            const a = answers.find((x) => x.questionId === q.id);
            return (
              <li key={q.id} className="border-b border-wows-rule py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="max-w-prose text-[15px] font-medium text-wows-ink">
                    {q.prompt}
                  </p>
                  <Chip tone={a?.correct ? "positive" : "warn"}>
                    {a?.correct ? "Correct" : "Missed"}
                  </Chip>
                </div>
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-wows-muted">
                  {q.explanation}
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={buttonClass.secondary}
          onClick={onRestart}
        >
          Take it again
        </button>
        <Link href="/learn" className={buttonClass.quiet}>
          Back to the curriculum
        </Link>
        <span className="text-xs text-wows-muted">
          Last attempt <When iso={quiz.attempt.takenAt} />
        </span>
      </div>
    </div>
  );
}
