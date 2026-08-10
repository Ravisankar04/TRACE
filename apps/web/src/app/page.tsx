"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const timeline = [
  { month: "Feb", label: "Pricing changed" },
  { month: "Mar", label: "New API launched" },
  { month: "Apr", label: "Docs rewritten" },
  { month: "May", label: "Free tier removed" },
  { month: "Jun", label: "Website redesign" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(242,169,140,0.18),transparent_55%)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
        <Link href="/" className="font-grotesk text-lg font-bold tracking-[-0.04em] lowercase">
          TRACE
        </Link>
        <nav className="flex items-center gap-7 text-[11px] uppercase tracking-[0.25em] text-white/45">
          <Link href="/login" className="hover:text-white transition-colors">
            Login
          </Link>
          <Link
            href="/signup"
            className="min-h-[44px] rounded-full border border-white/15 px-5 py-2 text-white/80 transition-colors hover:border-orange hover:text-white"
          >
            Start
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-10 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:pt-16">
        <section>
          <p className="trace-eyebrow text-white/30">temporal web intelligence</p>
          <h1 className="mt-6 font-grotesk text-[clamp(3rem,9vw,6.5rem)] font-bold leading-[0.9] tracking-[-0.05em]">
            SEE
            <br />
            HOW THE
            <br />
            INTERNET
            <br />
            CHANGES.
          </h1>
          <p className="mt-8 max-w-md text-sm leading-relaxed text-white/55 sm:text-base">
            TRACE continuously monitors websites, reconstructs their history, detects meaningful changes, and explains
            them with evidence.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full orange-gradient px-7 text-sm font-semibold text-near-black"
            >
              Start monitoring
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo-site"
              className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 px-7 text-[11px] uppercase tracking-[0.28em] text-white/80 transition-colors hover:border-orange hover:text-white"
            >
              Explore demo
            </Link>
          </div>
        </section>

        <section aria-label="Interactive timeline preview" className="relative">
          <div className="rounded-[14px] border border-white/15 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/40">
              <span className="trace-hue-cycle inline-block h-1.5 w-1.5 rounded-full bg-orange" />
              Live timeline
            </div>
            <div className="relative pl-6">
              <div className="absolute bottom-2 left-[11px] top-2 w-px bg-white/15" />
              {timeline.map((item, i) => (
                <motion.div
                  key={item.month}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 * i, duration: 0.45 }}
                  className="relative mb-6 last:mb-0"
                >
                  <span className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full border border-orange bg-black" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{item.month}</p>
                  <p className="mt-1 font-grotesk text-sm text-white/90">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-7 sm:flex-row sm:px-10">
          <p className="font-grotesk text-sm font-bold lowercase tracking-[-0.04em]">trace</p>
          <p className="max-w-xl text-center text-[9px] leading-relaxed tracking-[0.12em] text-white/50">
            Monitor. Remember. Investigate. Evidence-first web change intelligence.
          </p>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-white/45">
            <span className="trace-hue-cycle inline-block h-1.5 w-1.5 rounded-full bg-orange" />
            systems online
          </div>
        </div>
      </footer>
    </div>
  );
}
