import type { Brief } from "@/lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

export function BriefCard({ brief }: { brief: Brief }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold">{brief.partner_label}</h3>
        <p className="text-sm text-black/60 dark:text-white/60">{brief.headline}</p>
      </div>
      <p className="text-sm whitespace-pre-line">{brief.narrative}</p>
      {brief.items.length > 0 && (
        <ul className="text-sm flex flex-col gap-1 border-t border-black/10 dark:border-white/15 pt-2">
          {brief.items.slice(0, 8).map((entry) => (
            <li key={entry.event_id} className="flex items-center justify-between gap-2">
              <span>
                {entry.item} — {entry.quantity}
                {entry.unit ? ` ${entry.unit}` : ""}
              </span>
              <UrgencyBadge urgency={entry.urgency} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-black/40 dark:text-white/40">
        Generated {new Date(brief.generated_at).toLocaleString()}
      </p>
    </div>
  );
}
