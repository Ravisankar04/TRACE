import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHash(normalized: string): string {
  return sha256(normalized);
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** API keys: trc_live_<secret> — store only hash */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const raw = `trc_live_${secret}`;
  const prefix = `trc_live_${secret.slice(0, 4)}`;
  return { raw, prefix, hash: sha256(raw) };
}

export function maskApiKey(prefix: string): string {
  return `${prefix}${"*".repeat(20)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function signWebhookPayload(secret: string, body: string, timestamp: string): string {
  return createHash("sha256").update(`${timestamp}.${body}.${secret}`).digest("hex");
}
