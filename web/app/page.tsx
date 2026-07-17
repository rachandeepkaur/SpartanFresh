"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brief,
  CanonicalEvent,
  PriorityEntry,
  fetchBriefs,
  fetchEvents,
  seedDemoData,
} from "@/lib/api";
import {
  briefBreakdown,
  deriveAlerts,
  expiringSoonItems,
  formatQuantity,
  netQuantity,
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

const TOTAL_CONFIGURED_PARTNERS = 3; // spartan_garden, community_donor, spartan_pantry_intake
const POLL_INTERVAL_MS = 20_000;
const TICK_INTERVAL_MS = 1_000;

export default function DashboardPage() {
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
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
    const initial = setTimeout(() => load(), 0);
    const poll = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(poll);
    };
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
          lastUpdated={lastUpdated}
          now={now}
          loading={loading}
          onRefresh={() => load()}
          onSeed={handleSeed}
          showSeed={events.length === 0}
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
              totalPartners={TOTAL_CONFIGURED_PARTNERS}
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
              <h2 className="font-semibold">
                Full inventory ({events.length} item{events.length === 1 ? "" : "s"})
              </h2>
              <EventsTable events={events} priorityByEventId={priorityByEventId} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
