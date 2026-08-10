"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { api } from "@/lib/api";

type GraphResponse = {
  entities: Array<{ id: string; type: string; name: string }>;
  edges: Array<{ id: string; fromEntityId: string; toEntityId: string; type: string }>;
};

function GraphInner() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/projects"),
  });

  const activeId = projectId || projects.data?.items[0]?.id;

  const graph = useQuery({
    queryKey: ["graph", activeId],
    enabled: !!activeId,
    queryFn: () => api<GraphResponse>(`/api/projects/${activeId}/graph`),
  });

  const layout = useMemo(() => {
    const entities = (graph.data?.entities || []).filter((e) => filter === "ALL" || e.type === filter);
    const n = Math.max(entities.length, 1);
    return entities.map((e, i) => {
      const angle = (i / n) * Math.PI * 2;
      const r = 140 + (i % 3) * 28;
      return {
        ...e,
        x: 220 + Math.cos(angle) * r,
        y: 200 + Math.sin(angle) * r,
      };
    });
  }, [graph.data, filter]);

  const selectedEntity = layout.find((e) => e.id === selected) || graph.data?.entities.find((e) => e.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="trace-eyebrow text-muted-foreground">Knowledge Graph</p>
          <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Graph explorer</h1>
        </div>
        <select
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["ALL", "Company", "Page", "Change", "PricingPlan", "Feature", "Product"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {!activeId && (
        <div className="surface-card p-8 text-sm text-muted-foreground">
          Create a project and run a scan to populate the knowledge graph.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="surface-card overflow-hidden p-2">
          <svg viewBox="0 0 440 400" className="h-[420px] w-full" role="img" aria-label="Knowledge graph">
            {(graph.data?.edges || []).map((edge) => {
              const from = layout.find((n) => n.id === edge.fromEntityId);
              const to = layout.find((n) => n.id === edge.toEntityId);
              if (!from || !to) return null;
              const highlight = selected && (selected === from.id || selected === to.id);
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={highlight ? "#f2a98c" : "rgba(0,0,0,0.12)"}
                  strokeWidth={highlight ? 2 : 1}
                />
              );
            })}
            {layout.map((node) => (
              <g key={node.id} onClick={() => setSelected(node.id)} className="cursor-pointer">
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={selected === node.id ? 18 : 14}
                  fill={selected === node.id ? "#f2a98c" : "#fff"}
                  stroke="#f2a98c"
                  strokeWidth={1.5}
                />
                <text x={node.x} y={node.y + 28} textAnchor="middle" className="fill-current text-[9px]">
                  {node.type}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <aside className="surface-card p-5">
          <h2 className="font-grotesk font-semibold">Selection</h2>
          {!selectedEntity ? (
            <p className="mt-3 text-sm text-muted-foreground">Click a node to inspect it.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Type:</span> {selectedEntity.type}
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">Name:</span> {selectedEntity.name}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading graph…</p>}>
      <GraphInner />
    </Suspense>
  );
}
