export type NetworkConnection = {
  id: string;
  user_id: string;
  external_key: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  linkedin_url: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
  connected_on: string | null;
  source: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};
