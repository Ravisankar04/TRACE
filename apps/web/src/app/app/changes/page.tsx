"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ChangesPage() {
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/projects"),
  });
  const first = projects.data?.items[0]?.id;
  const changes = useQuery({
    queryKey: ["changes", first],
    enabled: !!first,
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          type: string;
          summary: string;
          confidence: number;
          createdAt: string;
          page: { url: string };
        }>;
      }>(`/api/projects/${first}/changes`),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Changes</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Detected changes</h1>
      </div>
      {!first && <div className="surface-card p-8 text-sm text-muted-foreground">Create a project to see changes.</div>}
      <ul className="space-y-3">
        {changes.data?.items.map((c) => (
          <li key={c.id}>
            <Link href={`/app/changes/${c.id}`} className="surface-card block p-4 hover:border-orange/40">
              <p className="text-sm font-medium">{c.summary}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {c.type} · {Math.round(c.confidence * 100)}% · {c.page.url}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
