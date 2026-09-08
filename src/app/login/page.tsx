import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — WOWS Portal" };

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-md border border-wows-accent bg-wows-surface px-3 py-2 text-sm text-wows-accent"
    >
      {children}
    </p>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-wows-ink">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-wows-muted">
        Enter your Ashoka email and we will send you a one-time sign-in link.
      </p>
      {error === "domain" ? (
        <Alert>Only @ashoka.edu.in addresses can use the portal.</Alert>
      ) : null}
      {error === "link" ? (
        <Alert>
          That sign-in link is invalid or has expired. Request a new one.
        </Alert>
      ) : null}
      <LoginForm />
    </main>
  );
}
