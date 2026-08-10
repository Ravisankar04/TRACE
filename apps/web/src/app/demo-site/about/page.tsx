export default function DemoAboutPage() {
  return (
    <div className="min-h-screen bg-[#FFFAF6] px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="trace-eyebrow text-muted-foreground">About</p>
        <h1 className="mt-4 font-grotesk text-4xl font-bold tracking-[-0.04em]">Acme Cloud</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Acme Cloud helps teams ship faster. Contact: support@acme.example. This page exists so TRACE can crawl multiple
          same-domain pages during demo scans.
        </p>
        <a href="/demo-site" className="mt-8 inline-block text-sm underline">
          Back to pricing
        </a>
      </div>
    </div>
  );
}
