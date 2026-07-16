import type { Urgency } from "@/lib/api";

const STYLES: Record<Urgency, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  use_soon: "bg-orange-100 text-orange-800 border-orange-300",
  normal: "bg-blue-100 text-blue-800 border-blue-300",
  low: "bg-gray-100 text-gray-700 border-gray-300",
};

const LABELS: Record<Urgency, string> = {
  critical: "Critical",
  use_soon: "Use soon",
  normal: "Normal",
  low: "Low",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[urgency]}`}
    >
      {LABELS[urgency]}
    </span>
  );
}
