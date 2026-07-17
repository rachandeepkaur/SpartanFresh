import type { CanonicalEvent, PriorityEntry } from "@/lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

interface Props {
  events: CanonicalEvent[];
  priorityByEventId: Map<string, PriorityEntry>;
}

export function EventsTable({ events, priorityByEventId }: Props) {
  const rows = [...events].sort((a, b) => {
    const rankA = priorityByEventId.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = priorityByEventId.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/10 text-left">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Source partner</th>
            <th className="px-3 py-2">Direction</th>
            <th className="px-3 py-2">Urgency</th>
            <th className="px-3 py-2">Days left</th>
            <th className="px-3 py-2">Translated by</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="border-t border-black/10 dark:border-white/15">
              <td
                colSpan={8}
                className="px-3 py-8 text-center text-black/50 dark:text-white/50"
              >
                No inventory items match that search.
              </td>
            </tr>
          )}
          {rows.map((event) => {
            const priority = priorityByEventId.get(event.id);
            return (
              <tr key={event.id} className="border-t border-black/10 dark:border-white/15">
                <td className="px-3 py-2 font-medium">{event.item}</td>
                <td className="px-3 py-2">
                  {event.quantity} {event.unit}
                </td>
                <td className="px-3 py-2">{event.category}</td>
                <td className="px-3 py-2">{event.source_partner}</td>
                <td className="px-3 py-2">{event.direction}</td>
                <td className="px-3 py-2">
                  {priority ? <UrgencyBadge urgency={priority.urgency} /> : "—"}
                </td>
                <td className="px-3 py-2">
                  {priority?.estimated_days_remaining?.toFixed(1) ?? "—"}
                </td>
                <td className="px-3 py-2 text-black/50 dark:text-white/50">
                  {event.translated_by}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
