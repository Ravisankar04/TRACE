import Link from "next/link";

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-20 sm:px-10">
        <p className="trace-eyebrow text-white/30">Portfolio</p>
        <h1 className="mt-6 font-grotesk text-[clamp(3rem,8vw,5rem)] font-bold leading-[0.95] tracking-[-0.05em]">
          TRACE
        </h1>
        <p className="mt-4 font-grotesk text-xl text-white/70">Temporal Web Intelligence Engine</p>
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-white/50">
          Monitor. Remember. Investigate.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full orange-gradient px-7 py-3 text-sm font-semibold text-near-black"
          >
            Live Demo
          </Link>
          <a
            href="https://github.com/Ravisankar04/TRACE"
            className="rounded-full border border-white/15 px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-white/80"
          >
            GitHub
          </a>
        </div>

        <section className="mt-20 space-y-4">
          <h2 className="font-grotesk text-2xl font-semibold">Technical highlights</h2>
          <ul className="space-y-2 text-sm text-white/60">
            <li>• Playwright crawler with SSRF protection, robots.txt, concurrency limits</li>
            <li>• Normalization → content hashing → raw + semantic diffs</li>
            <li>• BullMQ workers, retries, dead-letter style failure states</li>
            <li>• SSE live scan progress bridged from Redis pub/sub</li>
            <li>• Evidence-first investigation pipeline with provider abstraction</li>
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="font-grotesk text-2xl font-semibold">Architecture</h2>
          <pre className="overflow-auto rounded-[14px] border border-white/15 bg-white/[0.03] p-5 font-mono text-[11px] text-white/70">{`User → Next.js → Fastify API → Postgres
                 ↘ Redis/BullMQ → Worker → Playwright
                 ↘ SSE ← Redis pub/sub ← Worker events
                 ↘ AI provider (optional) ← evidence retriever`}</pre>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-[14px] border border-white/15 p-5">
            <h3 className="font-grotesk font-semibold">Security</h3>
            <p className="mt-2 text-sm text-white/55">
              URL allowlisting, private IP blocks, session cookies, API key hashing, rate limits, audit logs.
            </p>
          </div>
          <div className="rounded-[14px] border border-white/15 p-5">
            <h3 className="font-grotesk font-semibold">Engineering challenges</h3>
            <p className="mt-2 text-sm text-white/55">
              Separating technical noise from semantic change without inventing AI evidence.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
