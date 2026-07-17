import type { AlertItem, AlertTone } from "@/lib/dashboard";
import { timeAgo } from "@/lib/dashboard";
import { Icon, type IconName } from "./icons";

const TONE_STYLES: Record<AlertTone, { icon: IconName; bg: string; fg: string }> = {
  critical: { icon: "alert-circle", bg: "bg-red-100 dark:bg-red-500/15", fg: "text-red-600 dark:text-red-400" },
  warning: { icon: "alert-triangle", bg: "bg-orange-100 dark:bg-orange-500/15", fg: "text-orange-600 dark:text-orange-400" },
  info: { icon: "info", bg: "bg-blue-100 dark:bg-blue-500/15", fg: "text-blue-600 dark:text-blue-400" },
};

export function AlertsPanel({ alerts, now }: { alerts: AlertItem[]; now: Date }) {
  return (
    <div id="alerts" className="rounded-xl border border-black/10 dark:border-white/12 bg-[var(--surface)] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Critical Alerts</h2>
        {alerts.length > 0 && (
          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            {alerts.length} active
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50 py-6 text-center">
          No active alerts — everything looks on track.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => {
            const tone = TONE_STYLES[alert.tone];
            return (
              <li key={alert.id} className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone.bg} ${tone.fg}`}>
                  <Icon name={tone.icon} className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{alert.title}</p>
                  <p className="text-xs text-black/50 dark:text-white/50 leading-snug">{alert.description}</p>
                  <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5">
                    {alert.source} · {timeAgo(alert.timestamp, now)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
