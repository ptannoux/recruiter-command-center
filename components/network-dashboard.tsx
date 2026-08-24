"use client";

import Link from "next/link";
import { type ChangeEvent, useMemo, useState } from "react";
import styles from "./network-dashboard.module.css";
import { createClient } from "@/lib/supabase/client";
import type { NetworkConnection } from "@/lib/network-types";

type Props = { userId: string; initialConnections: NetworkConnection[] };
type ImportRow = Omit<NetworkConnection, "id" | "created_at" | "updated_at">;

const normalized = (value: string) => value.replace(/^\uFEFF/, "").trim();
const headerKey = (value: string) => normalized(value).toLowerCase().replace(/[^a-z0-9]/g, "");

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function findHeaderIndex(rows: string[][]) {
  return rows.findIndex((row) => {
    const keys = row.map(headerKey);
    return keys.includes("firstname") && keys.includes("lastname") &&
      keys.some((key) => ["url", "linkedinurl", "profileurl"].includes(key));
  });
}

function getColumn(row: string[], headers: Map<string, number>, ...names: string[]) {
  for (const name of names) {
    const index = headers.get(headerKey(name));
    if (index !== undefined) return normalized(row[index] || "");
  }
  return "";
}

function dateValue(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function rowsForImport(text: string, userId: string) {
  const rows = parseCsv(text);
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) throw new Error("Could not find LinkedIn's First Name, Last Name and URL columns.");

  const headers = new Map(rows[headerIndex].map((name, index) => [headerKey(name), index]));
  const unique = new Map<string, ImportRow>();

  for (const row of rows.slice(headerIndex + 1)) {
    const firstName = getColumn(row, headers, "First Name");
    const lastName = getColumn(row, headers, "Last Name");
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const linkedinUrl = getColumn(row, headers, "URL", "LinkedIn URL", "Profile URL");
    const email = getColumn(row, headers, "Email Address", "Email");
    const company = getColumn(row, headers, "Company");
    const position = getColumn(row, headers, "Position", "Title");
    if (!fullName) continue;

    const externalKey = (linkedinUrl || email || `${fullName}|${company}|${position}`).toLowerCase();
    unique.set(externalKey, {
      user_id: userId,
      external_key: externalKey,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName,
      linkedin_url: linkedinUrl || null,
      email: email || null,
      company: company || null,
      position: position || null,
      connected_on: dateValue(getColumn(row, headers, "Connected On")),
      source: "linkedin_csv",
      notes: null,
    });
  }

  return [...unique.values()];
}

export function NetworkDashboard({ userId, initialConnections }: Props) {
  const [items, setItems] = useState(initialConnections);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const companies = useMemo(() => [...new Set(items.map((item) => item.company).filter(Boolean) as string[])].sort(), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = [item.full_name, item.company, item.position, item.email].filter(Boolean).join(" ").toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!company || item.company === company);
  }), [items, query, company]);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setProgress(0);
    setMessage("Reading LinkedIn CSV…");

    try {
      const rows = rowsForImport(await file.text(), userId);
      if (!rows.length) throw new Error("No LinkedIn connections were found in this CSV.");

      const imported: NetworkConnection[] = [];
      const batchSize = 250;
      for (let from = 0; from < rows.length; from += batchSize) {
        const batch = rows.slice(from, from + batchSize);
        const { data, error } = await supabase
          .from("network_connections")
          .upsert(batch, { onConflict: "user_id,external_key" })
          .select("*");
        if (error) throw error;
        imported.push(...((data || []) as NetworkConnection[]));
        setProgress(Math.min(from + batch.length, rows.length));
        setMessage(`Importing ${Math.min(from + batch.length, rows.length).toLocaleString()} of ${rows.length.toLocaleString()}…`);
      }

      setItems((current) => {
        const merged = new Map(current.map((item) => [item.external_key, item]));
        imported.forEach((item) => merged.set(item.external_key, item));
        return [...merged.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
      });
      setMessage(`Imported ${rows.length.toLocaleString()} LinkedIn connections. Re-uploading the export updates existing records instead of duplicating them.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The CSV could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  const withEmail = items.filter((item) => item.email).length;
  const withCompany = items.filter((item) => item.company).length;

  return <div className="app-shell">
    <header className="topbar">
      <div><div className="eyebrow light">RELATIONSHIP INTELLIGENCE</div><h1>LinkedIn Network</h1><p>Import, search and organize your complete connection export.</p></div>
      <div className="top-actions"><Link href="/" className="button inverse">Recruiter dashboard</Link></div>
      <div className="kpi-grid">
        <Kpi n={items.length} label="Connections" />
        <Kpi n={companies.length} label="Companies" />
        <Kpi n={withEmail} label="With email" />
        <Kpi n={withCompany} label="With company" />
      </div>
    </header>

    <main className="main-shell">
      <section className={styles.uploadCard}>
        <div><h2>Import your LinkedIn Connections.csv</h2><p>The file stays in your browser until it is securely saved to your Supabase account. Repeat uploads update matches and do not create duplicates.</p></div>
        <label className={`${styles.filePicker} button primary`}>
          {busy ? "Importing…" : "Choose LinkedIn CSV"}
          <input type="file" accept=".csv,text/csv" onChange={importFile} disabled={busy} />
        </label>
      </section>
      {message ? <div className="flash inline">{message}{busy ? <progress className={styles.progress} value={progress} /> : null}</div> : null}
      <section className={`filters-card ${styles.filters}`}>
        <input placeholder="Search name, company, title or email…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={company} onChange={(event) => setCompany(event.target.value)}><option value="">All companies</option>{companies.map((name) => <option key={name}>{name}</option>)}</select>
        <span>{filtered.length.toLocaleString()} matches</span>
      </section>

      <section className={`table-card ${styles.tableCard}`}>
        <div className="table-scroll"><table><thead><tr><th>Connection</th><th>Company / role</th><th>Connected</th><th>Contact</th></tr></thead>
          <tbody>{filtered.slice(0, 500).map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong></td><td><strong>{item.company || "—"}</strong><span>{item.position || ""}</span></td><td>{item.connected_on || "—"}</td><td><div className={styles.contactLinks}>{item.linkedin_url ? <a href={item.linkedin_url} target="_blank" rel="noreferrer">LinkedIn ↗</a> : null}{item.email ? <a href={`mailto:${item.email}`}>Email</a> : null}</div></td></tr>)}</tbody>
        </table></div>
        {filtered.length > 500 ? <p className={styles.note}>Showing the first 500 matches. Narrow the search to see a specific connection.</p> : null}
        {!items.length ? <div className={styles.empty}><h2>No connections imported yet</h2><p>Download your Connections CSV from LinkedIn, then choose it above.</p></div> : null}
      </section>
    </main>
  </div>;
}

function Kpi({ n, label }: { n: number; label: string }) {
  return <div className="kpi"><strong>{n.toLocaleString()}</strong><span>{label}</span></div>;
}
