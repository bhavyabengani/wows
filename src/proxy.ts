import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

/**
 * Runs before every matched request:
 *   1. assigns a request ID (structured logging, CLAUDE.md > Conventions)
 *   2. refreshes the Supabase session cookie
 *   3. sends signed-out visitors of member routes to /login
 *
 * This is an optimistic check only. Authorization is enforced server-side
 * by `requireRole` and by row-level security (H1, H2).
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/play",
  "/leaderboard",
  "/research/submit",
  "/research/mine",
  "/learn",
  "/events",
  "/members",
  "/me",
  "/admin",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const requestId =
    request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const { pathname, search } = request.nextUrl;
  const toLogin = () => {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set(REQUEST_ID_HEADER, requestId);
    return redirect;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // Unconfigured deployment: public pages keep working, everyone is a
    // guest, and /login explains that sign-in is not set up.
    if (isProtectedPath(pathname)) return toLogin();
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token with the Auth server; getSession() would
  // trust the cookie. Never trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) return toLogin();

  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
