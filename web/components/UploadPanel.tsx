"use client";

import { useId, useState } from "react";
import { uploadInventorySheet, type UploadResult } from "@/lib/api";
import { Icon } from "./icons";

const NEW_ORG_VALUE = "__new_org__";

interface KnownPartner {
  id: string;
  label: string;
}

interface Props {
  knownPartners: KnownPartner[];
  onUploaded: () => void;
}

export function UploadPanel({ knownPartners, onUploaded }: Props) {
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [sourcePartner, setSourcePartner] = useState(knownPartners[0]?.id ?? NEW_ORG_VALUE);
  const [newOrgName, setNewOrgName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedPartner =
    sourcePartner === NEW_ORG_VALUE
      ? newOrgName.trim().toLowerCase().replace(/\s+/g, "_")
      : sourcePartner;

  const canSubmit = Boolean(file) && Boolean(resolvedPartner) && !submitting;

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !resolvedPartner) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadInventorySheet(file, resolvedPartner);
      setResult(res);
      setFile(null);
      if (res.events_ingested > 0) onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-black/15 dark:border-white/20 px-3 py-2 text-sm font-medium"
      >
        <Icon name="upload" className="w-4 h-4" />
        <span className="hidden sm:inline">Upload update</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-black/10 dark:border-white/15 bg-[var(--surface)] shadow-lg p-4 flex flex-col gap-3 z-20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Upload inventory update</h3>
            <button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
              aria-label="Close"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50">
            Attach a partner&apos;s own spreadsheet (.csv or .xlsx). Columns are matched
            loosely — item/name, quantity/qty, unit, category, and expiry date are all
            recognized.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor={selectId} className="text-xs font-medium text-black/60 dark:text-white/60">
              Organization
            </label>
            <select
              id={selectId}
              value={sourcePartner}
              onChange={(e) => setSourcePartner(e.target.value)}
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2.5 py-1.5 text-sm"
            >
              {knownPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value={NEW_ORG_VALUE}>+ New organization…</option>
            </select>

            {sourcePartner === NEW_ORG_VALUE && (
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2.5 py-1.5 text-sm"
              />
            )}

            <input
              type="file"
              accept=".csv,.xlsx,.xlsm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
              className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:text-background file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
            />

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Uploading…" : "Upload"}
            </button>
          </form>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 rounded-md bg-red-100 dark:bg-red-500/10 px-2.5 py-2">
              {error}
            </p>
          )}

          {result && (
            <div className="text-xs rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 px-2.5 py-2 flex flex-col gap-1">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                {result.events_ingested} of {result.rows_read} row
                {result.rows_read === 1 ? "" : "s"} added from {result.filename}
              </p>
              {result.errors.length > 0 && (
                <ul className="text-black/55 dark:text-white/55 list-disc list-inside">
                  {result.errors.slice(0, 4).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                  {result.errors.length > 4 && <li>...and {result.errors.length - 4} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
