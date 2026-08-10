"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export default function InvestigationsPage() {
  const [question, setQuestion] = useState("Why did the pricing change?");
  const [projectId, setProjectId] = useState("");

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/projects"),
  });

  const list = useQuery({
    queryKey: ["investigations"],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          question: string;
          status: string;
          confidence: number | null;
          createdAt: string;
          project: { id: string; name: string } | null;
        }>;
      }>("/api/investigations"),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ investigation: { id: string } }>("/api/investigations", {
      method: "POST",
      body: JSON.stringify({ question, projectId: projectId || undefined }),
    });
    window.location.href = `/app/investigations/${res.investigation.id}`;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Investigations</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Evidence-first AI</h1>
      </div>

      <form onSubmit={onSubmit} className="surface-card space-y-3 p-5">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-h-24 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-orange"
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">All projects</option>
          {projects.data?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white">
          Investigate
        </button>
      </form>

      <ul className="space-y-3">
        {list.data?.items.map((item) => (
          <li key={item.id}>
            <Link href={`/app/investigations/${item.id}`} className="surface-card block p-4 hover:border-orange/40">
              <p className="text-sm font-medium">{item.question}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {item.status}
                {item.confidence != null ? ` · ${Math.round(item.confidence * 100)}%` : ""}
                {item.project ? ` · ${item.project.name}` : ""}
              </p>
            </Link>
          </li>
        ))}
        {(list.data?.items.length ?? 0) === 0 && (
          <li className="surface-card p-8 text-sm text-muted-foreground">No investigations yet.</li>
        )}
      </ul>
    </div>
  );
}
