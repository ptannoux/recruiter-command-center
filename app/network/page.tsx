import { NetworkDashboard } from "@/components/network-dashboard";
import { createClient } from "@/lib/supabase/server";
import type { NetworkConnection } from "@/lib/network-types";

export default async function NetworkPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return null;

  const connections: NetworkConnection[] = [];
  const pageSize = 1000;

  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await supabase
      .from("network_connections")
      .select("*")
      .order("full_name")
      .range(from, from + pageSize - 1);

    if (error || !data?.length) break;
    connections.push(...(data as NetworkConnection[]));
    if (data.length < pageSize) break;
  }

  return <NetworkDashboard userId={userId} initialConnections={connections} />;
}
