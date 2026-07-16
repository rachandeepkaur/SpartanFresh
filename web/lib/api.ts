export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Category =
  | "produce"
  | "canned"
  | "dairy"
  | "frozen"
  | "bakery"
  | "dry_goods"
  | "other";

export type Urgency = "critical" | "use_soon" | "normal" | "low";

export interface CanonicalEvent {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category: Category;
  source_partner: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  expiry_date: string | null;
  translated_by: "deterministic" | "claude" | "heuristic";
}

export interface PriorityEntry {
  rank: number;
  event_id: string;
  item: string;
  quantity: number;
  unit: string;
  source_partner: string;
  urgency: Urgency;
  estimated_days_remaining: number | null;
}

export interface Brief {
  partner_id: string;
  partner_label: string;
  generated_at: string;
  headline: string;
  items: PriorityEntry[];
  narrative: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return res.json();
}

export const fetchEvents = () => request<CanonicalEvent[]>("/events");
export const fetchBriefs = () => request<Brief[]>("/briefs");
export const seedDemoData = () =>
  request<{ events_ingested: number }>("/demo/seed", { method: "POST" });
export const refreshPipeline = () =>
  request<{ event_count: number; brief_count: number }>("/pipeline/refresh", {
    method: "POST",
  });
