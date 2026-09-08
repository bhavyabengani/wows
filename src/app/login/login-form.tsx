"use client";

import { useActionState } from "react";
import { type MagicLinkState, requestMagicLink } from "./actions";

const initial: MagicLinkState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="mt-8 rounded-md border border-wows-rule bg-wows-surface p-6"
      >
        <h2 className="font-medium text-wows-ink">Check your email</h2>
        <p className="mt-2 text-sm text-wows-muted">
          We sent a sign-in link to{" "}
          <span className="text-wows-ink">{state.email}</span>. It expires in
          one hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-wows-ink"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@ashoka.edu.in"
          className="mt-1 block w-full rounded-md border border-wows-rule bg-wows-surface px-3 py-2 text-wows-ink outline-none focus-visible:ring-2 focus-visible:ring-wows-accent-soft"
        />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-wows-accent">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-wows-accent px-4 py-2 text-sm font-medium text-wows-surface hover:bg-wows-accent-soft disabled:opacity-60"
      >
        {pending ? "Sending" : "Send sign-in link"}
      </button>
    </form>
  );
}
