import type { Brief, CanonicalEvent, PriorityEntry } from "./api";

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  canned: "Canned Goods",
  dairy: "Dairy & Eggs",
  frozen: "Frozen",
  bakery: "Bakery",
  dry_goods: "Dry Goods",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  produce: "#22c55e",
  canned: "#f97316",
  dairy: "#3b82f6",
  frozen: "#06b6d4",
  bakery: "#eab308",
  dry_goods: "#8b5cf6",
  other: "#94a3b8",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#94a3b8";
}

export interface CategorySlice {
  category: string;
  quantity: number;
  percent: number;
}

/** Current on-hand quantity per category, inbound minus outbound. */
export function categoryBreakdown(events: CanonicalEvent[]): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const e of events) {
    const delta = e.direction === "inbound" ? e.quantity : -e.quantity;
    totals.set(e.category, (totals.get(e.category) ?? 0) + delta);
  }
  const total = [...totals.values()].reduce((a, b) => a + Math.max(b, 0), 0);
  return [...totals.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([category, quantity]) => ({
      category,
      quantity,
      percent: total > 0 ? (quantity / total) * 100 : 0,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

/** Net on-hand quantity across every category (inbound minus outbound). */
export function netQuantity(events: CanonicalEvent[]): number {
  return events.reduce(
    (sum, e) => sum + (e.direction === "inbound" ? e.quantity : -e.quantity),
    0
  );
}

export function sumByDirection(
  events: CanonicalEvent[],
  direction: "inbound" | "outbound"
): { quantity: number; count: number } {
  const matching = events.filter((e) => e.direction === direction);
  return {
    quantity: matching.reduce((sum, e) => sum + e.quantity, 0),
    count: matching.length,
  };
}

export interface PartnerVisual {
  icon: "leaf" | "users" | "truck" | "box";
  color: string;
}

/** Best-effort icon/color assignment from the partner id — cosmetic only. */
export function partnerVisual(partnerId: string): PartnerVisual {
  const id = partnerId.toLowerCase();
  if (id.includes("garden") || id.includes("farm")) {
    return { icon: "leaf", color: "#16a34a" };
  }
  if (id.includes("donor") || id.includes("individual") || id.includes("community")) {
    return { icon: "users", color: "#7c3aed" };
  }
  if (id.includes("drive") || id.includes("delivery")) {
    return { icon: "truck", color: "#2563eb" };
  }
  return { icon: "box", color: "#0f766e" };
}

export function partnerLabel(partnerId: string): string {
  return partnerId
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface PartnerTotal {
  partnerId: string;
  label: string;
  quantity: number;
  count: number;
  percentOfMax: number;
}

export function sourceBreakdown(events: CanonicalEvent[], limit = 5): PartnerTotal[] {
  const totals = new Map<string, { quantity: number; count: number }>();
  for (const e of events) {
    if (e.direction !== "inbound") continue;
    const cur = totals.get(e.source_partner) ?? { quantity: 0, count: 0 };
    cur.quantity += e.quantity;
    cur.count += 1;
    totals.set(e.source_partner, cur);
  }
  const rows = [...totals.entries()]
    .map(([partnerId, v]) => ({ partnerId, label: partnerLabel(partnerId), ...v }))
    .sort((a, b) => b.quantity - a.quantity);
  const max = rows[0]?.quantity ?? 0;
  return rows
    .slice(0, limit)
    .map((r) => ({ ...r, percentOfMax: max > 0 ? (r.quantity / max) * 100 : 0 }));
}

export interface BriefTotal {
  partnerId: string;
  label: string;
  quantity: number;
  count: number;
  percentOfMax: number;
}

/** Briefs stand in for "downstream recipients" — who the prioritized items are being routed to. */
export function briefBreakdown(briefs: Brief[], limit = 5): BriefTotal[] {
  const rows = briefs
    .map((b) => ({
      partnerId: b.partner_id,
      label: b.partner_label,
      quantity: b.items.reduce((sum, i) => sum + i.quantity, 0),
      count: b.items.length,
    }))
    .sort((a, b) => b.quantity - a.quantity);
  const max = rows[0]?.quantity ?? 0;
  return rows
    .slice(0, limit)
    .map((r) => ({ ...r, percentOfMax: max > 0 ? (r.quantity / max) * 100 : 0 }));
}

export interface ExpiringItem {
  event: CanonicalEvent;
  priority: PriorityEntry;
}

export function expiringSoonItems(
  events: CanonicalEvent[],
  priorityByEventId: Map<string, PriorityEntry>,
  days = 7,
  limit = 6
): ExpiringItem[] {
  const eventById = new Map(events.map((e) => [e.id, e]));
  const candidates = [...priorityByEventId.values()]
    .filter((p) => p.estimated_days_remaining != null && p.estimated_days_remaining <= days)
    .sort((a, b) => (a.estimated_days_remaining ?? 0) - (b.estimated_days_remaining ?? 0))
    .map((priority) => ({ priority, event: eventById.get(priority.event_id) }))
    .filter((x): x is ExpiringItem => Boolean(x.event));

  // A single item can appear in several partner snapshots. The summary panel
  // should show one actionable line for matching lots, not repeated rows. Lots
  // with different remaining time stay separate so an older batch is never
  // hidden behind a fresher one.
  const grouped = new Map<string, ExpiringItem>();
  for (const candidate of candidates) {
    const remaining = candidate.priority.estimated_days_remaining;
    const key = [
      candidate.event.item.trim().toLocaleLowerCase(),
      candidate.event.unit.trim().toLocaleLowerCase(),
      remaining?.toFixed(1) ?? "unknown",
      candidate.priority.urgency,
    ].join("|");
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        event: candidate.event,
        priority: { ...candidate.priority },
      });
      continue;
    }
    existing.priority.quantity += candidate.priority.quantity;
  }

  return [...grouped.values()]
    .sort(
      (a, b) =>
        (a.priority.estimated_days_remaining ?? 0) -
        (b.priority.estimated_days_remaining ?? 0)
    )
    .slice(0, limit);
}

export function recentEvents(events: CanonicalEvent[], limit = 6): CanonicalEvent[] {
  return [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export type AlertTone = "critical" | "warning" | "info";

export interface AlertItem {
  id: string;
  tone: AlertTone;
  title: string;
  description: string;
  source: string;
  timestamp: string;
}

const LOW_STOCK_THRESHOLD = 10;

export function deriveAlerts(
  events: CanonicalEvent[],
  priorityByEventId: Map<string, PriorityEntry>,
  lastUpdated: string
): AlertItem[] {
  const alerts: AlertItem[] = [];

  const expiring = expiringSoonItems(events, priorityByEventId, 7, Infinity);
  if (expiring.length > 0) {
    const totalQty = expiring.reduce((sum, x) => sum + x.priority.quantity, 0);
    const partners = new Set(expiring.map((x) => x.event.source_partner)).size;
    alerts.push({
      id: "expiring-soon",
      tone: "critical",
      title: `${expiring.length} item${expiring.length === 1 ? "" : "s"} expiring within 7 days`,
      description: `Total ${Math.round(totalQty)} units across ${partners} partner${partners === 1 ? "" : "s"}`,
      source: "Multiple",
      timestamp: lastUpdated,
    });
  }

  for (const partner of sourceBreakdown(events, Infinity)) {
    if (partner.quantity > 0 && partner.quantity < LOW_STOCK_THRESHOLD) {
      alerts.push({
        id: `low-stock-${partner.partnerId}`,
        tone: "warning",
        title: `${partner.label} inventory running low`,
        description: `Only ${Math.round(partner.quantity)} units reported across ${partner.count} item${partner.count === 1 ? "" : "s"}`,
        source: partner.label,
        timestamp: lastUpdated,
      });
    }
  }

  const fallbackCount = events.filter((e) => e.translated_by === "heuristic").length;
  if (fallbackCount > 0) {
    alerts.push({
      id: "fallback-translation",
      tone: "info",
      title: `${fallbackCount} item${fallbackCount === 1 ? "" : "s"} used fallback translation`,
      description: "No Gemini API key configured — deterministic/heuristic mapping was used instead",
      source: "Pipeline",
      timestamp: lastUpdated,
    });
  }

  const [latest] = recentEvents(events, 1);
  if (latest) {
    alerts.push({
      id: `latest-${latest.id}`,
      tone: "info",
      title: "New inventory received",
      description: `${Math.round(latest.quantity)} ${latest.unit} of ${latest.item}`,
      source: partnerLabel(latest.source_partner),
      timestamp: latest.timestamp,
    });
  }

  const toneRank: Record<AlertTone, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "—";
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatQuantity(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
