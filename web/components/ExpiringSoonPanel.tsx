import type { ExpiringItem } from "@/lib/dashboard";
import { categoryColor } from "@/lib/dashboard";
import { Icon } from "./icons";

export function ExpiringSoonPanel({ items }: { items: ExpiringItem[] }) {
  return (
    <div id="expiring" className="rounded-xl border border-black/10 dark:border-white/12 bg-[var(--surface)] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Expiring Soon</h2>
        <span className="text-xs text-black/45 dark:text-white/45">
          Auto-updated · Next 7 days
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50 py-6 text-center">
          Nothing expiring in the next 7 days.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(({ event, priority }) => (
            <li key={event.id} className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${categoryColor(event.category)}1f`, color: categoryColor(event.category) }}
              >
                <Icon name="clock" className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.item}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {priority.quantity} {event.unit}
                </p>
              </div>
              <span
                className={`text-xs font-medium shrink-0 ${
                  priority.urgency === "critical"
                    ? "text-red-600 dark:text-red-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {priority.estimated_days_remaining != null
                  ? `${Math.max(priority.estimated_days_remaining, 0).toFixed(1)}d left`
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
