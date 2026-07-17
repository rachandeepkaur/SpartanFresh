import { Icon, type IconName } from "./icons";

interface Props {
  icon: IconName;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  subtext: string;
  subtextTone?: "neutral" | "warning";
}

export function StatCard({ icon, iconColor, label, value, unit, subtext, subtextTone = "neutral" }: Props) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/12 bg-[var(--surface)] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-black/55 dark:text-white/55">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${iconColor}1f`, color: iconColor }}
        >
          <Icon name={icon} className="w-4.5 h-4.5" />
        </span>
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums">
        {value}
        {unit && <span className="text-base font-medium text-black/50 dark:text-white/50"> {unit}</span>}
      </p>
      <p
        className={`text-xs font-medium ${
          subtextTone === "warning"
            ? "text-orange-600 dark:text-orange-400"
            : "text-black/50 dark:text-white/50"
        }`}
      >
        {subtext}
      </p>
    </div>
  );
}
