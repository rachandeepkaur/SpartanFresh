import type { CanonicalEvent } from "@/lib/api";
import { partnerLabel, partnerVisual, timeAgo } from "@/lib/dashboard";
import { Icon } from "./icons";

export function RecentUpdatesPanel({ events, now }: { events: CanonicalEvent[]; now: Date }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/12 bg-[var(--surface)] p-5 flex flex-col gap-4">
      <h2 className="font-semibold">Recent Partner Updates</h2>

      {events.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50 py-6 text-center">
          No activity yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {events.map((event) => {
            const visual = partnerVisual(event.source_partner);
            return (
              <li key={event.id} className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${visual.color}1f`, color: visual.color }}
                >
                  <Icon name={visual.icon} className="w-4 h-4" />
                </span>
                <p className="flex-1 min-w-0 text-sm truncate">
                  <span className="font-medium">{partnerLabel(event.source_partner)}</span>{" "}
                  <span className="text-black/55 dark:text-white/55">
                    reported {event.quantity} {event.unit} of {event.item}
                  </span>
                </p>
                <span className="text-xs text-black/40 dark:text-white/40 shrink-0">
                  {timeAgo(event.timestamp, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
