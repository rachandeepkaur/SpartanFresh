import { categoryBreakdown, categoryColor, categoryLabel, formatQuantity, timeAgo } from "@/lib/dashboard";
import type { CanonicalEvent } from "@/lib/api";
import { Icon } from "./icons";

interface Props {
  events: CanonicalEvent[];
  partnersReporting: number;
  totalPartners: number;
  lastUpdated: string | null;
  now: Date;
}

const RADIUS = 62;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function InventorySnapshotPanel({ events, partnersReporting, totalPartners, lastUpdated, now }: Props) {
  const slices = categoryBreakdown(events);
  const total = slices.reduce((sum, s) => sum + s.quantity, 0);

  const arcs = slices.map((s, i) => {
    const priorPercent = slices.slice(0, i).reduce((sum, p) => sum + p.percent, 0);
    const len = (s.percent / 100) * CIRCUMFERENCE;
    const priorLen = (priorPercent / 100) * CIRCUMFERENCE;
    return { ...s, dash: `${len} ${CIRCUMFERENCE - len}`, dashOffset: -priorLen };
  });

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/12 bg-[var(--surface)] p-5 flex flex-col gap-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-1.5">
          Inventory Snapshot
          <Icon name="info" className="w-3.5 h-3.5 text-black/35 dark:text-white/35" />
        </h2>
      </div>

      {slices.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50 py-8 text-center">
          No inventory reported yet.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="relative shrink-0">
            <svg width={168} height={168} viewBox="0 0 168 168">
              <g transform="rotate(-90 84 84)">
                {arcs.map((arc) => (
                  <circle
                    key={arc.category}
                    cx={84}
                    cy={84}
                    r={RADIUS}
                    fill="none"
                    stroke={categoryColor(arc.category)}
                    strokeWidth={STROKE}
                    strokeDasharray={arc.dash}
                    strokeDashoffset={arc.dashOffset}
                  />
                ))}
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{formatQuantity(total)}</span>
              <span className="text-xs text-black/50 dark:text-white/50">units</span>
              <span className="text-xs text-black/50 dark:text-white/50">Total</span>
            </div>
          </div>

          <ul className="flex-1 w-full flex flex-col gap-2.5">
            {slices.map((s) => (
              <li key={s.category} className="flex items-center gap-3 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: categoryColor(s.category) }}
                />
                <span className="flex-1">{categoryLabel(s.category)}</span>
                <span className="tabular-nums font-medium">{formatQuantity(s.quantity)}</span>
                <span className="tabular-nums text-black/45 dark:text-white/45 w-10 text-right">
                  {s.percent.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 border-t border-black/10 dark:border-white/12 pt-4">
        <div className="flex items-center gap-2.5">
          <Icon name="database" className="w-4 h-4 text-black/40 dark:text-white/40" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tabular-nums">{events.length}</p>
            <p className="text-[11px] text-black/50 dark:text-white/50">SKUs Tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Icon name="users" className="w-4 h-4 text-black/40 dark:text-white/40" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tabular-nums">
              {partnersReporting} / {totalPartners}
            </p>
            <p className="text-[11px] text-black/50 dark:text-white/50">Partners Reporting</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Icon name="check-circle" className="w-4 h-4 text-emerald-500" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tabular-nums">
              {lastUpdated ? timeAgo(lastUpdated, now) : "—"}
            </p>
            <p className="text-[11px] text-black/50 dark:text-white/50">Data Freshness</p>
          </div>
        </div>
      </div>
    </div>
  );
}
