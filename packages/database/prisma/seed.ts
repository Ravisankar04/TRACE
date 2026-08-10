import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function hash(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

const v1 = `TITLE: Acme Cloud — Pricing
DESCRIPTION:
HEADINGS:
- Acme Cloud — Pricing
- Starter
TEXT:
Acme Cloud — Pricing
Starter — $19/month
Free API
Email support
1 project`;

const v2 = `TITLE: Acme Cloud — Pricing
DESCRIPTION:
HEADINGS:
- Acme Cloud — Pricing
- Starter
TEXT:
Acme Cloud — Pricing
Starter — $29/month
Enterprise plan
SSO
Audit logs
Priority support`;

async function main() {
  const email = "demo@trace.dev";
  const passwordHash = await bcrypt.hash("demo-password-change-me", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo Investigator",
      passwordHash,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project-trace001" },
    update: {
      name: "Demo Acme",
      rootUrl: "http://localhost:3000/demo-site",
      status: "active",
      lastScanAt: new Date(),
    },
    create: {
      id: "demo-project-trace001",
      userId: user.id,
      name: "Demo Acme",
      rootUrl: "http://localhost:3000/demo-site",
      status: "active",
      crawlDepth: 1,
      pageLimit: 5,
      lastScanAt: new Date(),
    },
  });

  const page = await prisma.page.upsert({
    where: {
      projectId_url: {
        projectId: project.id,
        url: "http://localhost:3000/demo-site",
      },
    },
    update: { title: "Acme Cloud — Pricing" },
    create: {
      projectId: project.id,
      url: "http://localhost:3000/demo-site",
      title: "Acme Cloud — Pricing",
      depth: 0,
      lastSeenAt: new Date(),
    },
  });

  await prisma.change.deleteMany({ where: { projectId: project.id } });
  await prisma.event.deleteMany({ where: { projectId: project.id } });
  await prisma.snapshot.deleteMany({ where: { projectId: project.id } });

  const snap1 = await prisma.snapshot.create({
    data: {
      projectId: project.id,
      pageId: page.id,
      url: page.url,
      fetchedAt: new Date("2026-02-10T12:00:00Z"),
      statusCode: 200,
      contentType: "text/html",
      title: "Acme Cloud — Pricing",
      normalizedContent: v1,
      contentHash: hash(v1),
      metadata: { version: 1 },
    },
  });

  const snap2 = await prisma.snapshot.create({
    data: {
      projectId: project.id,
      pageId: page.id,
      url: page.url,
      fetchedAt: new Date("2026-05-10T12:00:00Z"),
      statusCode: 200,
      contentType: "text/html",
      title: "Acme Cloud — Pricing",
      normalizedContent: v2,
      contentHash: hash(v2),
      metadata: { version: 2 },
    },
  });

  const change = await prisma.change.create({
    data: {
      projectId: project.id,
      pageId: page.id,
      previousSnapshotId: snap1.id,
      currentSnapshotId: snap2.id,
      type: "PRICE_CHANGE",
      severity: "high",
      summary: "Pricing information changed on this page.",
      confidence: 0.92,
      rawDiff: {
        lines: [
          { type: "remove", text: "Starter — $19/month" },
          { type: "add", text: "Starter — $29/month" },
          { type: "remove", text: "Free API" },
          { type: "add", text: "Enterprise plan" },
        ],
        added: 2,
        removed: 2,
      },
      semanticDiff: {
        type: "PRICE_CHANGE",
        severity: "high",
        summary: "Pricing information changed on this page.",
        confidence: 0.92,
        previousExcerpt: "Starter — $19/month\nFree API",
        currentExcerpt: "Starter — $29/month\nEnterprise plan",
        sections: [{ label: "Pricing", previous: "$19/month", current: "$29/month" }],
      },
    },
  });

  await prisma.event.create({
    data: {
      projectId: project.id,
      changeId: change.id,
      title: "Pricing changed — Starter $19 → $29",
      type: "PRICE_CHANGE",
      occurredAt: snap2.fetchedAt,
    },
  });

  await prisma.event.create({
    data: {
      projectId: project.id,
      title: "Enterprise plan messaging introduced",
      type: "FEATURE_ADDED",
      occurredAt: snap2.fetchedAt,
    },
  });

  const company = await prisma.graphEntity.upsert({
    where: { projectId_type_name: { projectId: project.id, type: "Company", name: "Acme Cloud" } },
    create: { projectId: project.id, type: "Company", name: "Acme Cloud" },
    update: {},
  });
  const pageEntity = await prisma.graphEntity.upsert({
    where: { projectId_type_name: { projectId: project.id, type: "Page", name: page.url } },
    create: { projectId: project.id, type: "Page", name: page.url },
    update: {},
  });
  const plan = await prisma.graphEntity.upsert({
    where: { projectId_type_name: { projectId: project.id, type: "PricingPlan", name: "Starter" } },
    create: { projectId: project.id, type: "PricingPlan", name: "Starter" },
    update: {},
  });
  const changeEntity = await prisma.graphEntity.upsert({
    where: {
      projectId_type_name: { projectId: project.id, type: "Change", name: `PRICE_CHANGE:${change.id}` },
    },
    create: {
      projectId: project.id,
      type: "Change",
      name: `PRICE_CHANGE:${change.id}`,
      metadata: { changeId: change.id },
    },
    update: {},
  });

  for (const [from, to, type] of [
    [company.id, pageEntity.id, "OWNS"],
    [company.id, plan.id, "HAS_FEATURE"],
    [pageEntity.id, changeEntity.id, "CHANGED"],
    [plan.id, changeEntity.id, "CHANGED"],
  ] as const) {
    await prisma.graphEdge.upsert({
      where: {
        projectId_fromEntityId_toEntityId_type: {
          projectId: project.id,
          fromEntityId: from,
          toEntityId: to,
          type,
        },
      },
      create: { projectId: project.id, fromEntityId: from, toEntityId: to, type },
      update: {},
    });
  }

  console.log(
    JSON.stringify(
      {
        user: user.email,
        password: "demo-password-change-me",
        projectId: project.id,
        changeId: change.id,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
