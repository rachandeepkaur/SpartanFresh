"use client";

import { useState } from "react";
import type { CanonicalEvent } from "@/lib/api";
import { partnerLabel, partnerVisual, timeAgo } from "@/lib/dashboard";
import { Icon } from "./icons";

export function RecentUpdatesPanel({ events, now }: { events: CanonicalEvent[]; now: Date }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            const expanded = expandedId === event.id;
            const sentence = `${partnerLabel(event.source_partner)} reported ${event.quantity} ${event.unit} of ${event.item}`;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : event.id)}
                  aria-expanded={expanded}
                  title={sentence}
                  className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-white/5"
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${visual.color}1f`, color: visual.color }}
                  >
                    <Icon name={visual.icon} className="w-4 h-4" />
                  </span>
                  <p
                    className={`flex-1 min-w-0 text-sm ${
                      expanded ? "whitespace-normal break-words" : "truncate"
                    }`}
                  >
                    <span className="font-medium">{partnerLabel(event.source_partner)}</span>{" "}
                    <span className="text-black/55 dark:text-white/55">
                      reported {event.quantity} {event.unit} of {event.item}
                    </span>
                  </p>
                  <span className="text-xs text-black/40 dark:text-white/40 shrink-0">
                    {timeAgo(event.timestamp, now)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
