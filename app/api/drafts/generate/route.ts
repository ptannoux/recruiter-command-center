import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Channel = "linkedin" | "email";

type RecruiterDraftInput = {
  name: string;
  title: string | null;
  firm: string;
  tags: string[] | null;
  relationship: string | null;
  background: string | null;
  why_fit: string | null;
};

type DraftSettings = {
  positioning: string;
  target_roles: string;
  target_companies: string;
};

type ResponsesPayload = {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ text?: unknown }> }>;
};

function template(channel: Channel, recruiter: RecruiterDraftInput, settings: DraftSettings) {
  const first = recruiter.name.split(" ")[0];
  const focus = (recruiter.tags || []).slice(0, 4).join(", ");
  if (channel === "linkedin") {
    return `Hi ${first} — I’m conducting a focused search for my next ${settings.target_roles} opportunity. I’m a ${settings.positioning}, targeting ${settings.target_companies}. Given your work around ${focus || "executive search"}, I thought it would be valuable to connect. I’d welcome 15–20 minutes to share the brief and get your perspective on where my profile may be most relevant. Best, Pierre`;
  }
  return `Subject: Executive marketing & growth search — quick introduction\n\nHi ${first},\n\nI’m reaching out as I begin a focused search for my next ${settings.target_roles} opportunity. My background is as a ${settings.positioning}, and I’m concentrating on ${settings.target_companies}.\n\nYour work across ${focus || "executive search"} looks particularly relevant. I’d value 15–20 minutes to briefly share my search profile, hear what you are seeing in the market, and understand whether there are clients or situations where my background could be useful.\n\nI’m happy to send a concise search brief and résumé in advance.\n\nBest,\nPierre`;
}

function extractOutputText(json: unknown) {
  if (!json || typeof json !== "object") return "";
  const payload = json as ResponsesPayload;
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => typeof content.text === "string" ? content.text : "")
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestBody = (await request.json()) as { recruiterId?: unknown; channel?: unknown };
  const recruiterId = typeof requestBody.recruiterId === "string" ? requestBody.recruiterId : "";
  const channel = requestBody.channel;
  if (!recruiterId || (channel !== "linkedin" && channel !== "email")) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const [{ data: recruiter }, { data: settings }] = await Promise.all([
    supabase.from("recruiters").select("*").eq("id", recruiterId).single(),
    supabase.from("app_settings").select("*").maybeSingle(),
  ]);
  if (!recruiter) return NextResponse.json({ error: "Recruiter not found" }, { status: 404 });
  const recruiterData = recruiter as RecruiterDraftInput;
  const s = (settings || {
    positioning: "Global B2B industrial/materials marketing, innovation & growth executive",
    target_roles: "CMO / CGO / CCO / VP Marketing & Growth",
    target_companies: "Industrial, specialty materials, manufacturing and PE-backed businesses",
  }) as DraftSettings;

  let bodyText = template(channel, recruiterData, s);
  let generatedBy = "template";
  if (process.env.OPENAI_API_KEY) {
    const prompt = `Draft a concise, warm, executive-level ${channel === "linkedin" ? "LinkedIn message" : "email"} from Pierre to an executive recruiter. Do not invent facts. Use only the facts below. Avoid generic flattery. The goal is a 15–20 minute conversation. Pierre positioning: ${s.positioning}. Target roles: ${s.target_roles}. Target companies: ${s.target_companies}. Recruiter: ${recruiterData.name}, ${recruiterData.title || ""} at ${recruiterData.firm}. Focus tags: ${(recruiterData.tags || []).join(", ")}. Relationship: ${recruiterData.relationship || "unknown"}. Background: ${recruiterData.background || ""}. Why relevant: ${recruiterData.why_fit || ""}. Keep LinkedIn under 700 characters; email under 180 words. ${channel === "email" ? "Start with a useful Subject: line." : "Do not include a subject line."}`;
    const api = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6-terra", input: prompt }),
    });
    if (api.ok) {
      const json: unknown = await api.json();
      const output = extractOutputText(json);
      if (output) { bodyText = output; generatedBy = process.env.OPENAI_MODEL || "gpt-5.6-terra"; }
    }
  }

  const { data: draft, error } = await supabase.from("outreach_drafts").insert({ user_id: userId, recruiter_id: recruiterId, channel, body: bodyText, generated_by: generatedBy, status: "draft" }).select("id,body,generated_by").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(draft);
}
