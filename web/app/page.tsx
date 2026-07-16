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
import { EventsTable } from "@/components/EventsTable";
import { BriefCard } from "@/components/BriefCard";

export default function DashboardPage() {
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextEvents, nextBriefs] = await Promise.all([fetchEvents(), fetchBriefs()]);
      setEvents(nextEvents);
      setBriefs(nextBriefs);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — is the backend running on ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}?`
          : "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <main className="flex flex-col gap-8 max-w-5xl mx-auto p-8 w-full">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Marathon Kitchen Dashboard</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Unified inventory across every partner format, ranked by urgency.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={loading}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Seed demo data
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-md border border-black/15 dark:border-white/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-md bg-red-100 text-red-800 border border-red-300 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {events.length === 0 && !loading && !error && (
        <p className="text-sm text-black/60 dark:text-white/60">
          No inventory yet — click &quot;Seed demo data&quot; to load the three mock
          partner formats and run the pipeline.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {briefs.map((brief) => (
          <BriefCard key={brief.partner_id} brief={brief} />
        ))}
      </section>

      {events.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">
            Unified inventory ({events.length} item{events.length === 1 ? "" : "s"})
          </h2>
          <EventsTable events={events} priorityByEventId={priorityByEventId} />
        </section>
      )}
    </main>
  );
}
