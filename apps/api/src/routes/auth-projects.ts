import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@trace/database";
import { AppError, generateToken, sha256, validatePublicHttpUrl } from "@trace/shared";
import {
  clearSessionCookie,
  requireUser,
  setSessionCookie,
  sessionCookieName,
} from "../auth.js";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

export async function authRoutes(app: FastifyInstance, opts: { cookieSecure: boolean }) {
  app.post("/api/auth/signup", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const body = credsSchema.parse(req.body);
    const existing = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists.", 409);

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await db.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name ?? null,
      },
    });

    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt,
        userAgent: req.headers["user-agent"]?.slice(0, 300),
        ip: req.ip,
      },
    });
    await db.auditLog.create({
      data: { userId: user.id, action: "auth.signup", ip: req.ip },
    });

    setSessionCookie(reply, token, opts.cookieSecure, 60 * 60 * 24 * 14);
    return { user: { id: user.id, email: user.email, name: user.name } };
  });

  app.post("/api/auth/login", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const body = credsSchema.omit({ name: true }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt,
        userAgent: req.headers["user-agent"]?.slice(0, 300),
        ip: req.ip,
      },
    });
    await db.auditLog.create({
      data: { userId: user.id, action: "auth.login", ip: req.ip },
    });
    setSessionCookie(reply, token, opts.cookieSecure, 60 * 60 * 24 * 14);
    return { user: { id: user.id, email: user.email, name: user.name } };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[sessionCookieName()];
    if (token) {
      await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
    }
    clearSessionCookie(reply, opts.cookieSecure);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    const user = await requireUser(req);
    return { user };
  });
}

export async function projectRoutes(app: FastifyInstance) {
  const createSchema = z.object({
    name: z.string().min(1).max(120),
    rootUrl: z.string().url(),
    crawlDepth: z.number().int().min(0).max(4).optional(),
    pageLimit: z.number().int().min(1).max(100).optional(),
  });

  app.get("/api/projects", async (req) => {
    const user = await requireUser(req);
    const projects = await db.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { pages: true, snapshots: true, changes: true } },
      },
    });
    return {
      items: projects.map((p) => ({
        id: p.id,
        name: p.name,
        rootUrl: p.rootUrl,
        status: p.status,
        lastScanAt: p.lastScanAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        pagesMonitored: p._count.pages,
        totalSnapshots: p._count.snapshots,
        changesDetected: p._count.changes,
      })),
    };
  });

  app.post("/api/projects", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req) => {
    const user = await requireUser(req);
    const body = createSchema.parse(req.body);
    const isDemo =
      body.rootUrl.includes("/demo-site") &&
      (body.rootUrl.includes("localhost") || body.rootUrl.includes("127.0.0.1"));
    if (!isDemo) {
      const v = validatePublicHttpUrl(body.rootUrl);
      if (!v.ok || !v.normalized) throw new AppError("INVALID_URL", v.reason || "Invalid URL", 400);
      body.rootUrl = v.normalized;
    }

    const project = await db.project.create({
      data: {
        userId: user.id,
        name: body.name,
        rootUrl: body.rootUrl,
        crawlDepth: body.crawlDepth ?? 2,
        pageLimit: body.pageLimit ?? 25,
      },
    });
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "project.create",
        resource: "project",
        resourceId: project.id,
        ip: req.ip,
      },
    });
    return { project };
  });

  app.get("/api/projects/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const project = await db.project.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: { select: { pages: true, snapshots: true, changes: true } },
        changes: { orderBy: { createdAt: "desc" }, take: 8, include: { page: true } },
        pages: {
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: { _count: { select: { changes: true, snapshots: true } } },
        },
      },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found.", 404);

    const categories = await db.change.groupBy({
      by: ["type"],
      where: { projectId: id },
      _count: { _all: true },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        rootUrl: project.rootUrl,
        status: project.status,
        crawlDepth: project.crawlDepth,
        pageLimit: project.pageLimit,
        lastScanAt: project.lastScanAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        pagesMonitored: project._count.pages,
        totalSnapshots: project._count.snapshots,
        changesDetected: project._count.changes,
        recentChanges: project.changes,
        mostChangedPages: project.pages
          .map((p) => ({
            id: p.id,
            url: p.url,
            title: p.title,
            changes: p._count.changes,
            snapshots: p._count.snapshots,
          }))
          .sort((a, b) => b.changes - a.changes),
        changeCategories: categories.map((c) => ({ type: c.type, count: c._count._all })),
      },
    };
  });

  app.patch("/api/projects/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        status: z.enum(["active", "paused"]).optional(),
      })
      .parse(req.body);
    const existing = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new AppError("NOT_FOUND", "Project not found.", 404);
    const project = await db.project.update({ where: { id }, data: body });
    return { project };
  });

  app.delete("/api/projects/:id", async (req) => {
    const user = await requireUser(req);
    const { id } = req.params as { id: string };
    const existing = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new AppError("NOT_FOUND", "Project not found.", 404);
    await db.project.delete({ where: { id } });
    return { ok: true };
  });
}
