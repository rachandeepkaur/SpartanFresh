import { formatQuantity } from "@/lib/dashboard";
import { Icon, type IconName } from "./icons";

export interface BreakdownRow {
  id: string;
  label: string;
  quantity: number;
  count: number;
  percentOfMax: number;
  icon: IconName;
  iconColor: string;
}

export function PartnerBreakdownPanel({
  id,
  title,
  rows,
  emptyLabel,
  unitLabel,
}: {
  id?: string;
  title: string;
  rows: BreakdownRow[];
  emptyLabel: string;
  unitLabel: string;
}) {
  return (
    <div id={id} className="rounded-xl border border-black/10 dark:border-white/12 bg-[var(--surface)] p-5 flex flex-col gap-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50 py-6 text-center">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${row.iconColor}1f`, color: row.iconColor }}
              >
                <Icon name={row.icon} className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">{row.label}</span>
                  <span className="text-sm tabular-nums text-black/60 dark:text-white/60 shrink-0">
                    {formatQuantity(row.quantity)} {unitLabel}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(row.percentOfMax, 4)}%`, backgroundColor: row.iconColor }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
