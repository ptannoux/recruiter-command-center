import { createClient } from "@/lib/supabase/server";
import { RecruiterDashboard } from "@/components/recruiter-dashboard";
import type { AppSettings, Recruiter } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  const [{ data: recruiters }, { data: settings }] = await Promise.all([
    supabase
      .from("recruiters")
      .select("*, recruiter_sources(label,url,checked_at)")
      .order("fit_score", { ascending: false }),
    supabase.from("app_settings").select("positioning,target_roles,target_companies").maybeSingle(),
  ]);

  return (
    <RecruiterDashboard
      userId={String(userId)}
      initialRecruiters={(recruiters ?? []) as Recruiter[]}
      initialSettings={(settings ?? {
        positioning: "Global B2B industrial/materials marketing, innovation & growth executive",
        target_roles: "CMO / CGO / CCO / VP Marketing & Growth",
        target_companies: "Industrial, specialty materials, manufacturing and PE-backed businesses",
      }) as AppSettings}
    />
  );
}
