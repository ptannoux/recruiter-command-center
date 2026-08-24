export type Source = {
  id?: string;
  label: string;
  url: string;
  checked_at?: string | null;
};

export type Recruiter = {
  id: string;
  external_key: string;
  name: string;
  firm: string;
  title: string | null;
  location: string | null;
  email: string | null;
  linkedin_url: string | null;
  priority: "A" | "B" | "C";
  fit_score: number;
  relationship: string | null;
  research_status: string | null;
  company_focus: string | null;
  background: string | null;
  why_fit: string | null;
  status: string;
  approved: boolean;
  last_contact: string | null;
  next_step: string | null;
  notes: string | null;
  tags: string[];
  recruiter_sources?: Source[];
};

export type AppSettings = {
  positioning: string;
  target_roles: string;
  target_companies: string;
};
