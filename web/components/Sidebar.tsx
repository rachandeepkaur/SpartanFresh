import { Icon, type IconName } from "./icons";

interface NavItem {
  label: string;
  icon: IconName;
  href?: string;
  badge?: number;
  active?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildGroups(alertCount: number): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { label: "Inventory Overview", icon: "box", href: "#overview" },
        { label: "Expiring Soon", icon: "clock", href: "#expiring" },
        { label: "Forecast & Planning", icon: "trending-up" },
      ],
    },
    {
      label: "Data",
      items: [
        { label: "Sources (Upstream)", icon: "arrow-down-circle", href: "#sources" },
        { label: "Recipients (Downstream)", icon: "arrow-up-circle", href: "#recipients" },
        { label: "Inventory Data", icon: "database", href: "#inventory-data" },
        { label: "Data Mappings", icon: "shuffle" },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Alerts & Notifications", icon: "bell", href: "#alerts", badge: alertCount || undefined },
        { label: "Tasks", icon: "check-square" },
        { label: "Reports", icon: "file-text" },
      ],
    },
    {
      label: "Admin",
      items: [
        { label: "Partners", icon: "users" },
        { label: "Users & Roles", icon: "user" },
        { label: "Settings", icon: "settings" },
      ],
    },
  ];
}

export function Sidebar({ alertCount = 0 }: { alertCount?: number }) {
  const groups = buildGroups(alertCount);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#0b1530] text-white h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
          <Icon name="leaf" className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-sm tracking-wide">MARATHON</p>
          <p className="font-semibold text-sm tracking-wide -mt-0.5">KITCHEN</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-5">
        <a
          href="#overview"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-white/10 text-white"
        >
          <Icon name="grid" className="w-4.5 h-4.5" />
          Dashboard
        </a>

        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const disabled = !item.href;
              const content = (
                <>
                  <Icon name={item.icon} className="w-4.5 h-4.5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              );
              return disabled ? (
                <span
                  key={item.label}
                  title="Not available in this demo yet"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/30 cursor-not-allowed"
                >
                  {content}
                </span>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {content}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-lg bg-white/5 px-4 py-3.5 flex items-center gap-3">
        <Icon name="help-circle" className="w-5 h-5 text-white/60 shrink-0" />
        <div className="text-xs leading-tight">
          <p className="font-medium text-white/85">Need help?</p>
          <p className="text-white/50">View help center</p>
        </div>
      </div>
    </aside>
  );
}
