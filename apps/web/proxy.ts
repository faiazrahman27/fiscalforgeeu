import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function readSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  return {
    supabaseUrl,
    supabasePublicKey
  };
}

function isProtectedWorkspacePath(pathname: string) {
  return pathname === "/workspace" || pathname.startsWith("/workspace/");
}

function buildSignInRedirect(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  redirectUrl.pathname = "/auth/sign-in";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(redirectUrl);
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

export async function proxy(request: NextRequest) {
  const { supabaseUrl, supabasePublicKey } = readSupabasePublicConfig();

  /*
   * Keep the existing local platform usable before a Supabase project is connected.
   * Once NEXT_PUBLIC_SUPABASE_URL and a public key are configured, this proxy
   * synchronizes Supabase auth cookies and protects workspace pages.
   */
  if (!supabaseUrl || !supabasePublicKey) {
    return NextResponse.next({
      request
    });
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  /*
   * Required by Supabase SSR session handling.
   * Do not remove this call or auth sessions may become stale.
   */
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (isProtectedWorkspacePath(request.nextUrl.pathname) && !user) {
    const redirectResponse = buildSignInRedirect(request);

    /*
     * Preserve any Supabase cookie updates generated during getUser(),
     * including stale-session cleanup.
     */
    copyResponseCookies(response, redirectResponse);

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on app routes, but skip static assets, Next internals, and common image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
