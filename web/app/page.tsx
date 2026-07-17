"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brief,
  CanonicalEvent,
  PriorityEntry,
  fetchBriefs,
  fetchEvents,
  refreshPipeline,
  seedDemoData,
} from "@/lib/api";
import {
  briefBreakdown,
  deriveAlerts,
  expiringSoonItems,
  formatQuantity,
  netQuantity,
  partnerLabel,
  partnerVisual,
  recentEvents,
  sourceBreakdown,
  sumByDirection,
} from "@/lib/dashboard";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { StatCard } from "@/components/StatCard";
import { InventorySnapshotPanel } from "@/components/InventorySnapshotPanel";
import { AlertsPanel } from "@/components/AlertsPanel";
import { PartnerBreakdownPanel } from "@/components/PartnerBreakdownPanel";
import { ExpiringSoonPanel } from "@/components/ExpiringSoonPanel";
import { RecentUpdatesPanel } from "@/components/RecentUpdatesPanel";
import { BriefCard } from "@/components/BriefCard";
import { EventsTable } from "@/components/EventsTable";
import { Icon } from "@/components/icons";

// Mirrors agents/connectors/__init__.py's CONNECTORS dict.
const KNOWN_PARTNER_IDS = ["spartan_garden", "community_donor", "spartan_pantry_intake"];
const TOTAL_CONFIGURED_PARTNERS = KNOWN_PARTNER_IDS.length;
const TICK_INTERVAL_MS = 1_000;
const AUTO_REFRESH_INTERVAL_MS = 30_000;
const BELL_PULSE_MS = 2_500;

export default function DashboardPage() {
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [itemSearch, setItemSearch] = useState("");

  const load = useCallback(async (silent = false, recompute = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (recompute) await refreshPipeline();
      const [nextEvents, nextBriefs] = await Promise.all([fetchEvents(), fetchBriefs()]);
      setEvents(nextEvents);
      setBriefs(nextBriefs);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — is the backend running on ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}?`
          : "Failed to load data"
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => load(false, true), 0);
    return () => clearTimeout(initial);
  }, [load]);

  useEffect(() => {
    const refresh = setInterval(
      () => void load(true, true),
      AUTO_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(refresh);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDemoData();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed demo data");
      setLoading(false);
    }
  };

  const priorityByEventId = useMemo(() => {
    const internal = briefs.find((b) => b.partner_id === "marathon_kitchen_internal");
    const map = new Map<string, PriorityEntry>();
    internal?.items.forEach((entry) => map.set(entry.event_id, entry));
    return map;
  }, [briefs]);

  const filteredInventory = useMemo(() => {
    const query = itemSearch.trim().toLocaleLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      event.item.toLocaleLowerCase().includes(query)
    );
  }, [events, itemSearch]);

  const inbound = useMemo(() => sumByDirection(events, "inbound"), [events]);
  const outbound = useMemo(() => sumByDirection(events, "outbound"), [events]);
  const totalInventory = useMemo(() => netQuantity(events), [events]);
  const expiring = useMemo(
    () => expiringSoonItems(events, priorityByEventId, 7, Infinity),
    [events, priorityByEventId]
  );
  const partnersReporting = useMemo(
    () => new Set(events.map((e) => e.source_partner)).size,
    [events]
  );
  const alerts = useMemo(
    () => deriveAlerts(events, priorityByEventId, lastUpdated ?? new Date().toISOString()),
    [events, priorityByEventId, lastUpdated]
  );

  // Purely cosmetic: a brief pulse on the bell badge when a later refresh
  // (e.g. an upload) surfaces a new alert — suppressed on the very first
  // data load, since that's not "new," just initial. Doesn't touch alert
  // derivation itself.
  const [bellPulse, setBellPulse] = useState(false);
  const prevAlertCount = useRef(0);
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = lastUpdated !== null;
      prevAlertCount.current = alerts.length;
      return;
    }
    const grew = alerts.length > prevAlertCount.current;
    prevAlertCount.current = alerts.length;
    if (!grew) return;
    const start = setTimeout(() => setBellPulse(true), 0);
    const stop = setTimeout(() => setBellPulse(false), BELL_PULSE_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [alerts.length, lastUpdated]);

  const knownPartners = useMemo(() => {
    const ids = new Set([...KNOWN_PARTNER_IDS, ...events.map((e) => e.source_partner)]);
    return [...ids].map((id) => ({ id, label: partnerLabel(id) }));
  }, [events]);
  const sources = useMemo(
    () =>
      sourceBreakdown(events).map((s) => {
        const visual = partnerVisual(s.partnerId);
        return {
          id: s.partnerId,
          label: s.label,
          quantity: s.quantity,
          count: s.count,
          percentOfMax: s.percentOfMax,
          icon: visual.icon,
          iconColor: visual.color,
        };
      }),
    [events]
  );
  const recipients = useMemo(
    () =>
      briefBreakdown(briefs).map((b) => ({
        id: b.partnerId,
        label: b.label,
        quantity: b.quantity,
        count: b.count,
        percentOfMax: b.percentOfMax,
        icon: "package" as const,
        iconColor: "#7c3aed",
      })),
    [briefs]
  );
  const recent = useMemo(() => recentEvents(events, 6), [events]);

  return (
    <div className="flex bg-[var(--page-bg)] text-foreground min-h-screen">
      <Sidebar alertCount={alerts.length} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          alertCount={alerts.length}
          bellPulse={bellPulse}
          lastUpdated={lastUpdated}
          now={now}
          loading={loading}
          onRefresh={() => load(false, true)}
          onSeed={handleSeed}
          showSeed={events.length === 0}
          knownPartners={knownPartners}
          onUploaded={() => load()}
        />

        <main id="overview" className="flex flex-col gap-6 p-6 lg:p-8 w-full max-w-[1400px] mx-auto">
          {error && (
            <p className="rounded-md bg-red-100 text-red-800 border border-red-300 px-4 py-3 text-sm">
              {error}
            </p>
          )}

          {events.length === 0 && !loading && !error && (
            <p className="rounded-xl border border-dashed border-black/15 dark:border-white/20 px-6 py-10 text-center text-sm text-black/60 dark:text-white/60">
              No inventory yet — click &quot;Seed demo data&quot; above to load the three mock
              partner formats and run the pipeline.
            </p>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon="database"
              iconColor="#2563eb"
              label="Total Inventory (Net)"
              value={formatQuantity(totalInventory)}
              unit="units"
              subtext={`${events.length} SKUs across ${partnersReporting} partner${partnersReporting === 1 ? "" : "s"}`}
            />
            <StatCard
              icon="arrow-down-circle"
              iconColor="#16a34a"
              label="Incoming (All Time)"
              value={formatQuantity(inbound.quantity)}
              unit="units"
              subtext={`${inbound.count} inbound record${inbound.count === 1 ? "" : "s"}`}
            />
            <StatCard
              icon="arrow-up-circle"
              iconColor="#7c3aed"
              label="Distributed (All Time)"
              value={formatQuantity(outbound.quantity)}
              unit="units"
              subtext={outbound.count > 0 ? `${outbound.count} outbound records` : "No outbound activity tracked yet"}
            />
            <StatCard
              icon="clock"
              iconColor="#ea580c"
              label="Items Expiring Soon"
              value={String(expiring.length)}
              subtext={expiring.length > 0 ? `${expiring.length} item${expiring.length === 1 ? "" : "s"} need action` : "Nothing urgent"}
              subtextTone={expiring.length > 0 ? "warning" : "neutral"}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <InventorySnapshotPanel
              events={events}
              partnersReporting={partnersReporting}
              totalPartners={Math.max(TOTAL_CONFIGURED_PARTNERS, partnersReporting)}
              lastUpdated={lastUpdated}
              now={now}
            />
            <AlertsPanel alerts={alerts} now={now} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <PartnerBreakdownPanel
              id="sources"
              title="Top Upstream Sources"
              rows={sources}
              emptyLabel="No inbound sources reported yet."
              unitLabel="units"
            />
            <PartnerBreakdownPanel
              id="recipients"
              title="Downstream Recipients (by brief)"
              rows={recipients}
              emptyLabel="No briefs generated yet."
              unitLabel="units"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ExpiringSoonPanel items={expiring.slice(0, 6)} />
            <RecentUpdatesPanel events={recent} now={now} />
          </section>

          <section className="rounded-xl border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 px-5 py-4 flex items-center gap-3 flex-wrap">
            <Icon name="info" className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-200 flex-1 min-w-[240px]">
              All inventory data is unified into one shared schema to ensure accuracy,
              consistency, and real-time coordination across partners.
            </p>
          </section>

          {briefs.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Partner briefs</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {briefs.map((brief) => (
                  <BriefCard key={brief.partner_id} brief={brief} />
                ))}
              </div>
            </section>
          )}

          {events.length > 0 && (
            <section id="inventory-data" className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-semibold">
                  Full inventory ({filteredInventory.length}
                  {itemSearch.trim() ? ` of ${events.length}` : ""} item
                  {filteredInventory.length === 1 ? "" : "s"})
                </h2>
                <div className="relative w-full sm:w-80">
                  <input
                    type="search"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Search by item name…"
                    aria-label="Search inventory by item name"
                    className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-[var(--surface)] px-3 py-2 pr-9 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {itemSearch && (
                    <button
                      type="button"
                      onClick={() => setItemSearch("")}
                      aria-label="Clear item search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <EventsTable
                events={filteredInventory}
                priorityByEventId={priorityByEventId}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
