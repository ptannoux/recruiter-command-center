"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) redirect(`/login?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...credentials(formData),
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
    },
  });
  if (error) redirect(`/login?message=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Account created. If email confirmation is enabled, confirm your email and then sign in.");
}
