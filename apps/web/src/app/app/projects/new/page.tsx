"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/errors";

export default function NewProjectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: String(fd.get("name")),
          rootUrl: String(fd.get("rootUrl")),
          crawlDepth: Number(fd.get("crawlDepth") || 2),
          pageLimit: Number(fd.get("pageLimit") || 25),
        }),
      });
      router.push(`/app/projects/${res.project.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Projects</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Create project</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          TRACE will crawl the root URL (same-domain only), store normalized snapshots, and detect changes.
        </p>
      </div>
      <form onSubmit={onSubmit} className="surface-card space-y-4 p-6">
        <label className="block text-xs font-medium text-muted-foreground">
          Project name
          <input
            name="name"
            required
            placeholder="Acme Pricing"
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-orange"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Root URL
          <input
            name="rootUrl"
            required
            type="url"
            placeholder="https://example.com"
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-orange"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Crawl depth
            <input
              name="crawlDepth"
              type="number"
              min={0}
              max={4}
              defaultValue={2}
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-orange"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Page limit
            <input
              name="pageLimit"
              type="number"
              min={1}
              max={100}
              defaultValue={25}
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-orange"
            />
          </label>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={(e) => {
            const form = (e.currentTarget as HTMLButtonElement).form;
            if (!form) return;
            (form.elements.namedItem("name") as HTMLInputElement).value = "Demo Acme";
            (form.elements.namedItem("rootUrl") as HTMLInputElement).value =
              "http://localhost:3000/demo-site";
          }}
        >
          Use local demo site
        </button>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create project"}
        </button>
      </form>
    </div>
  );
}
