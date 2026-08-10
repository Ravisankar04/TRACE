"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{
    pages: unknown[];
    snapshots: unknown[];
    changes: unknown[];
    events: unknown[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await api<typeof result>(`/api/search?q=${encodeURIComponent(q)}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Search</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Full-text search</h1>
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="pricing, API, enterprise…"
          className="flex-1 rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-orange"
        />
        <button type="submit" className="rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          {(["pages", "snapshots", "changes", "events"] as const).map((key) => (
            <section key={key} className="surface-card p-4">
              <h2 className="text-sm font-semibold capitalize">{key}</h2>
              <pre className="mt-3 max-h-64 overflow-auto font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(result[key], null, 2)}
              </pre>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
