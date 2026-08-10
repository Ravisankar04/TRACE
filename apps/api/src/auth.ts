import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "@trace/database";
import { sha256, AppError } from "@trace/shared";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    requestId: string;
  }
}

const COOKIE = "trace_session";

export function sessionCookieName() {
  return COOKIE;
}

export async function resolveSession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const tokenHash = sha256(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export async function resolveApiKey(header: string | undefined): Promise<AuthUser | null> {
  if (!header?.startsWith("Bearer trc_live_")) return null;
  const raw = header.slice("Bearer ".length).trim();
  const keyHash = sha256(raw);
  const key = await db.apiKey.findUnique({ where: { keyHash } });
  if (!key || key.revokedAt) return null;
  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  const user = await db.user.findUnique({ where: { id: key.userId } });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function requireUser(req: FastifyRequest): Promise<AuthUser> {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required.", 401);
  return req.user;
}

export async function requireProjectOwned(userId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new AppError("NOT_FOUND", "Project not found.", 404);
  return project;
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean, maxAgeSec: number) {
  reply.setCookie(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: maxAgeSec,
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure });
}
