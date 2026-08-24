"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AppSettings, Recruiter } from "@/lib/types";

type Props = { userId: string; initialRecruiters: Recruiter[]; initialSettings: AppSettings };
const statuses = ["Research", "Ready to reach out", "Contacted", "Replied", "Meeting", "Closed"];

export function RecruiterDashboard({ initialRecruiters, initialSettings }: Props) {
  const [items, setItems] = useState(initialRecruiters);
  const [selected, setSelected] = useState(initialRecruiters[0]?.id || "");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [fit, setFit] = useState("");
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState<"linkedin" | "email">("linkedin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const current = items.find((x) => x.id === selected);

  const filtered = useMemo(() => items.filter((r) => {
    const hay = [r.name, r.firm, r.title, ...(r.tags || [])].join(" ").toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (priority && r.priority !== priority) return false;
    if (fit === "80" && r.fit_score < 80) return false;
    if (fit === "60" && r.fit_score < 60) return false;
    if (fit === "low" && r.fit_score >= 60) return false;
    return true;
  }).sort((a,b)=>b.fit_score-a.fit_score), [items, query, priority, fit]);

  async function patchRecruiter(id: string, patch: Partial<Recruiter>) {
    const { error } = await supabase.from("recruiters").update(patch).eq("id", id);
    if (error) { setMessage(error.message); return; }
    setItems((old) => old.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  async function saveSettings() {
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setMessage(res.ok ? "Positioning saved." : "Could not save positioning.");
  }
  async function generate() {
    if (!current) return;
    setBusy(true); setMessage("");
    const res = await fetch("/api/drafts/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recruiterId: current.id, channel }) });
    const json = await res.json();
    if (res.ok) setDraft(json.body); else setMessage(json.error || "Generation failed");
    setBusy(false);
  }
  async function signOut() { await supabase.auth.signOut(); router.push("/login"); router.refresh(); }
  async function copyDraft() { await navigator.clipboard.writeText(draft); setMessage("Copied to clipboard."); }

  const kpis = {
    total: items.length,
    high: items.filter((r)=>r.fit_score>=80).length,
    ready: items.filter((r)=>r.status==="Ready to reach out").length,
    active: items.filter((r)=>["Contacted","Replied","Meeting"].includes(r.status)).length,
    approved: items.filter((r)=>r.approved).length,
  };

  return <div className="app-shell">
    <header className="topbar">
      <div><div className="eyebrow light">EXECUTIVE SEARCH WORKSPACE</div><h1>Recruiter Command Center</h1><p>Research → prioritize → draft → approve → track.</p></div>
      <div className="top-actions"><Link href="/network" className="button inverse">LinkedIn network</Link><Link href="/import" className="button inverse">Import starter data</Link><button className="button inverse" onClick={signOut}>Sign out</button></div>
      <div className="kpi-grid">
        <Kpi n={kpis.total} label="Recruiters"/><Kpi n={kpis.high} label="High fit 80+"/><Kpi n={kpis.ready} label="Ready"/><Kpi n={kpis.active} label="Active"/><Kpi n={kpis.approved} label="Approved"/>
      </div>
    </header>

    <main className="main-shell">
      <section className="settings-card">
        <div className="section-title"><div><h2>Your positioning</h2><p>One source of truth for generated outreach.</p></div><button className="button primary" onClick={saveSettings}>Save</button></div>
        <div className="settings-grid">
          <label>Positioning<input value={settings.positioning} onChange={(e)=>setSettings({...settings, positioning:e.target.value})}/></label>
          <label>Target roles<input value={settings.target_roles} onChange={(e)=>setSettings({...settings, target_roles:e.target.value})}/></label>
          <label>Target companies<input value={settings.target_companies} onChange={(e)=>setSettings({...settings, target_companies:e.target.value})}/></label>
        </div>
      </section>
      {message ? <div className="flash inline">{message}</div> : null}
      {items.length === 0 ? <section className="empty-card"><h2>Your database is ready.</h2><p>Import the 39 researched recruiter profiles from the prototype to start.</p><Link className="button primary" href="/import">Import starter data</Link></section> : <>
      <section className="filters-card">
        <input placeholder="Search recruiters, firms, focus…" value={query} onChange={(e)=>setQuery(e.target.value)}/>
        <select value={priority} onChange={(e)=>setPriority(e.target.value)}><option value="">All priorities</option><option>A</option><option>B</option><option>C</option></select>
        <select value={fit} onChange={(e)=>setFit(e.target.value)}><option value="">All fit levels</option><option value="80">80+ high fit</option><option value="60">60+ medium+</option><option value="low">Under 60</option></select>
      </section>
      <section className="workspace">
        <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Recruiter</th><th>Firm / role</th><th>Focus</th><th>Fit</th><th>Status</th></tr></thead><tbody>{filtered.map((r)=><tr key={r.id} className={selected===r.id?"active":""} onClick={()=>{setSelected(r.id);setDraft("")}}><td><strong>{r.name}</strong><span>{r.location}</span></td><td><strong>{r.firm}</strong><span>{r.title}</span></td><td>{r.tags?.slice(0,3).map((t)=><em key={t}>{t}</em>)}</td><td><b>{r.fit_score}</b><div className="scorebar"><i style={{width:`${r.fit_score}%`}}/></div></td><td><span className={`badge p${r.priority}`}>{r.status}</span></td></tr>)}</tbody></table></div></div>
        {current ? <aside className="detail-card">
          <div className="detail-head"><div><h2>{current.name}</h2><p><strong>{current.firm}</strong> · {current.title}</p></div><span className="fit-chip">{current.fit_score}/100</span></div>
          <div className="detail-links">{current.linkedin_url?<a className="button primary" target="_blank" href={current.linkedin_url}>LinkedIn</a>:null}{current.email?<a className="button" href={`mailto:${current.email}`}>Email</a>:null}</div>
          <Detail label="Why this recruiter matters" text={current.why_fit}/><Detail label="Background" text={current.background}/><Detail label="Firm / practice" text={current.company_focus}/>
          <div className="detail-section"><h3>Focus</h3><div>{current.tags?.map((t)=><em key={t}>{t}</em>)}</div></div>
          <div className="detail-section"><h3>Sources</h3>{current.recruiter_sources?.map((s)=><a className="source-link" key={s.url} target="_blank" href={s.url}>↗ {s.label}</a>)}</div>
          <div className="detail-section"><h3>Workflow</h3><div className="form-grid"><label>Status<select value={current.status} onChange={(e)=>patchRecruiter(current.id,{status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Last contact<input type="date" value={current.last_contact||""} onChange={(e)=>patchRecruiter(current.id,{last_contact:e.target.value||null})}/></label><label className="wide">Next step<input defaultValue={current.next_step||""} onBlur={(e)=>patchRecruiter(current.id,{next_step:e.target.value})}/></label><label className="wide">Notes<textarea defaultValue={current.notes||""} onBlur={(e)=>patchRecruiter(current.id,{notes:e.target.value})}/></label></div></div>
          <div className="detail-section outreach"><h3>Outreach studio</h3><div className="tabs"><button className={channel==="linkedin"?"active":""} onClick={()=>{setChannel("linkedin");setDraft("")}}>LinkedIn</button><button className={channel==="email"?"active":""} onClick={()=>{setChannel("email");setDraft("")}}>Email</button></div><button className="button primary" onClick={generate} disabled={busy}>{busy?"Generating…":"Generate draft"}</button>{draft?<><textarea className="draft-box" value={draft} onChange={(e)=>setDraft(e.target.value)}/><div className="draft-actions"><button className="button" onClick={copyDraft}>Copy</button><button className={`button ${current.approved?"primary":""}`} onClick={()=>patchRecruiter(current.id,{approved:!current.approved,status:current.approved?current.status:"Ready to reach out"})}>{current.approved?"✓ Approved":"Approve"}</button></div></>:null}<p className="fineprint">Nothing is sent automatically. Gmail draft creation is the next integration layer.</p></div>
        </aside>:null}
      </section></>}
    </main>
  </div>;
}

function Kpi({n,label}:{n:number,label:string}){return <div className="kpi"><strong>{n}</strong><span>{label}</span></div>}
function Detail({label,text}:{label:string;text?:string|null}){return <div className="detail-section"><h3>{label}</h3><p>{text||"Not yet researched."}</p></div>}
