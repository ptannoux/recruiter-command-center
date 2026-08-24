import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const payload = {
    user_id: userId,
    positioning: String(body.positioning || "").slice(0, 2000),
    target_roles: String(body.target_roles || "").slice(0, 2000),
    target_companies: String(body.target_companies || "").slice(0, 2000),
  };
  const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
