import { Icon } from "./icons";
import { timeAgo } from "@/lib/dashboard";
import { UploadPanel } from "./UploadPanel";

interface Props {
  alertCount: number;
  bellPulse: boolean;
  lastUpdated: string | null;
  now: Date;
  loading: boolean;
  onRefresh: () => void;
  onSeed: () => void;
  showSeed: boolean;
  knownPartners: { id: string; label: string }[];
  onUploaded: () => void;
}

export function Topbar({
  alertCount,
  bellPulse,
  lastUpdated,
  now,
  loading,
  onRefresh,
  onSeed,
  showSeed,
  knownPartners,
  onUploaded,
}: Props) {
  const today = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 flex-wrap bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur border-b border-black/10 dark:border-white/10 px-6 lg:px-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-black/55 dark:text-white/55">
          One hub. Multiple partners. One accurate picture.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {showSeed && (
          <button
            onClick={onSeed}
            disabled={loading}
            className="rounded-md bg-foreground text-background px-3.5 py-2 text-sm font-medium disabled:opacity-50"
          >
            Seed demo data
          </button>
        )}

        <button
          onClick={onRefresh}
          disabled={loading}
          title={lastUpdated ? `Last updated ${timeAgo(lastUpdated, now)}` : "Refresh"}
          className="flex items-center gap-2 rounded-md border border-black/15 dark:border-white/20 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          <Icon name="refresh-cw" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">
            {lastUpdated ? timeAgo(lastUpdated, now) : "Refresh"}
          </span>
        </button>

        <UploadPanel knownPartners={knownPartners} onUploaded={onUploaded} />

        <div className="hidden md:flex items-center gap-2 rounded-md border border-black/15 dark:border-white/20 px-3 py-2 text-sm text-black/70 dark:text-white/70">
          <Icon name="calendar" className="w-4 h-4" />
          {today}
        </div>

        <button
          className="relative rounded-full border border-black/15 dark:border-white/20 p-2"
          title={`${alertCount} active alert${alertCount === 1 ? "" : "s"}`}
        >
          <Icon name="bell" className="w-4.5 h-4.5" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 flex">
              {bellPulse && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              )}
              <span className="relative rounded-full bg-red-500 text-white text-[10px] font-semibold min-w-[16px] h-4 px-1 flex items-center justify-center">
                {alertCount}
              </span>
            </span>
          )}
        </button>

        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-semibold">
            PM
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-medium">Program Manager</p>
            <p className="text-xs text-black/50 dark:text-white/50">Marathon Kitchen</p>
          </div>
        </div>
      </div>
    </header>
  );
}
