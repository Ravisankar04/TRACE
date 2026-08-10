"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const VERSIONS = {
  1: {
    title: "Acme Cloud — Pricing",
    starter: "$19/month",
    features: ["Free API", "Email support", "1 project"],
    note: "Version 1 — baseline demo content for TRACE.",
  },
  2: {
    title: "Acme Cloud — Pricing",
    starter: "$29/month",
    features: ["Enterprise plan", "SSO", "Audit logs", "Priority support"],
    note: "Version 2 — intentional pricing + feature changes for TRACE to detect.",
  },
} as const;

function DemoInner() {
  const sp = useSearchParams();
  const v = sp.get("v") === "2" ? 2 : 1;
  const content = VERSIONS[v];

  return (
    <div className="min-h-screen bg-[#FFFAF6] text-foreground">
      <header className="border-b border-border/60 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <p className="font-grotesk text-xl font-bold tracking-[-0.04em]">acme</p>
          <nav className="flex gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Link href="/demo-site?v=1" className={v === 1 ? "text-foreground" : ""}>
              v1
            </Link>
            <Link href="/demo-site?v=2" className={v === 2 ? "text-foreground" : ""}>
              v2
            </Link>
            <Link href="/demo-site/about">About</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="trace-eyebrow text-muted-foreground">Pricing</p>
        <h1 className="mt-4 font-grotesk text-4xl font-bold tracking-[-0.04em]">{content.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{content.note}</p>

        <section className="mt-12 surface-card p-8">
          <h2 className="font-grotesk text-2xl font-semibold">Starter</h2>
          <p className="mt-3 font-grotesk text-4xl font-bold text-orange">{content.starter}</p>
          <ul className="mt-6 space-y-2 text-sm">
            {content.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-orange" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-xl border border-orange/15 bg-[#FFFAF6] p-4 text-xs text-muted-foreground">
          TRACE demo tip: create a project pointed at{" "}
          <code className="font-mono">http://localhost:3000/demo-site?v=1</code>, scan, then change the project URL (or
          re-point/crawl <code className="font-mono">?v=2</code>) and scan again to observe a real PRICE_CHANGE.
          Prefer creating two sequential scans by toggling the demo page content via the seed script for deterministic
          demos.
        </section>
      </main>
    </div>
  );
}

export default function DemoSitePage() {
  return (
    <Suspense>
      <DemoInner />
    </Suspense>
  );
}
