import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  return value && value.startsWith("/") ? value : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/?auth=expired-link`);
    }

    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/?auth=invalid-link`);
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/?auth=expired-link`);
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
