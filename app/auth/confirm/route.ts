import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = url.searchParams.get("next") || "/";
  const next = requestedNext.startsWith("/") ? requestedNext : "/";
  const supabase = await createClient();

  const result = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("The confirmation link is incomplete.") };

  if (!result.error) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const message = encodeURIComponent(result.error.message);
  return NextResponse.redirect(new URL(`/error?message=${message}`, url.origin));
}
