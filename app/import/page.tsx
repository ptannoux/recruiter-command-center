"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import seed from "@/data/recruiters.seed.json";

export default function ImportPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function importSeed() {
    setBusy(true);
    setStatus("Preparing import…");
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setStatus("You must be signed in."); setBusy(false); return; }

    let imported = 0;
    for (const item of seed) {
      const payload = {
        user_id: user.id,
        external_key: item.id,
        name: item.name,
        firm: item.firm,
        title: item.title || null,
        location: item.location || null,
        email: item.email || null,
        linkedin_url: item.linkedin || null,
        priority: item.priority || "C",
        fit_score: item.fit || 0,
        relationship: item.relationship || null,
        research_status: item.research || "Needs refresh",
        company_focus: item.company_focus || null,
        background: item.background || null,
        why_fit: item.why || null,
        status: item.status || "Research",
        approved: Boolean(item.approved),
        last_contact: item.last_contact || null,
        next_step: item.next_step || null,
        notes: item.notes || null,
        tags: item.focus || [],
      };
      const { data: recruiter, error } = await supabase
        .from("recruiters")
        .upsert(payload, { onConflict: "user_id,external_key" })
        .select("id")
        .single();
      if (error) { setStatus(`Stopped at ${item.name}: ${error.message}`); setBusy(false); return; }
      await supabase.from("recruiter_sources").delete().eq("recruiter_id", recruiter.id);
      if (item.sources?.length) {
        const sources = item.sources.map((s: string[]) => ({ user_id: user.id, recruiter_id: recruiter.id, label: s[0], url: s[1] }));
        const { error: sourceError } = await supabase.from("recruiter_sources").insert(sources);
        if (sourceError) { setStatus(`Recruiter imported, but sources failed for ${item.name}: ${sourceError.message}`); setBusy(false); return; }
      }
      imported += 1;
      setStatus(`Imported ${imported} of ${seed.length}…`);
    }
    setStatus(`Done. ${imported} recruiter profiles imported. Return to the dashboard.`);
    setBusy(false);
  }

  return <main className="import-shell"><section className="import-card"><div className="eyebrow">ONE-TIME SETUP</div><h1>Import the 39-recruiter starter dataset</h1><p>This upserts the researched profiles from the HTML prototype into your private Supabase database. It is safe to run again.</p><button className="button primary" disabled={busy} onClick={importSeed}>{busy ? "Importing…" : "Import starter data"}</button><p className="import-status">{status}</p><Link href="/">← Dashboard</Link></section></main>;
}
