import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    /*
     * Keep sign-out safe even when Supabase env values are not configured yet.
     * The user is redirected to sign-in either way.
     */
  }

  return NextResponse.redirect(new URL("/auth/sign-in", requestUrl.origin), {
    status: 303
  });
}
