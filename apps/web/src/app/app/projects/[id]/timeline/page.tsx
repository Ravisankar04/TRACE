"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Timeline = {
  items: Array<{
    id: string;
    title: string;
    type: string;
    occurredAt: string;
    changeId: string | null;
  }>;
};

export default function ProjectTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api<Timeline>(`/api/projects/${id}/timeline`),
  });

  const byMonth = new Map<string, Timeline["items"]>();
  for (const item of data?.items || []) {
    const key = new Date(item.occurredAt).toLocaleString("en-US", { month: "short", year: "numeric" });
    const list = byMonth.get(key) || [];
    list.push(item);
    byMonth.set(key, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Timeline</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Project history</h1>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading timeline…</p>}
      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <div className="surface-card p-8 text-sm text-muted-foreground">
          No timeline events yet. Run scans to populate history.
        </div>
      )}
      <div className="relative pl-6">
        <div className="absolute bottom-0 left-[11px] top-0 w-px bg-border" />
        {[...byMonth.entries()].map(([month, items]) => (
          <section key={month} className="mb-10">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">{month}</h2>
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-6 top-2 h-2.5 w-2.5 rounded-full border border-orange bg-[#FFFAF6]" />
                  {item.changeId ? (
                    <Link href={`/app/changes/${item.changeId}`} className="surface-card block p-4 hover:border-orange/40">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {item.type} · {new Date(item.occurredAt).toLocaleString()}
                      </p>
                    </Link>
                  ) : (
                    <div className="surface-card p-4">
                      <p className="text-sm font-medium">{item.title}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
