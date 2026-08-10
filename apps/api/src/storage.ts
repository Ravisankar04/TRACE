import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { contentHash } from "@trace/shared";

export interface SnapshotStorage {
  putRaw(contentHashValue: string, html: string): Promise<string>;
  getRaw(storageKey: string): Promise<string | null>;
}

export class LocalSnapshotStorage implements SnapshotStorage {
  constructor(private readonly root: string) {}

  private keyFor(hash: string) {
    return path.join("raw", hash.slice(0, 2), `${hash}.html`);
  }

  async putRaw(hash: string, html: string): Promise<string> {
    const key = this.keyFor(hash);
    const full = path.join(this.root, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, html, "utf8");
    return key.replace(/\\/g, "/");
  }

  async getRaw(storageKey: string): Promise<string | null> {
    try {
      return await readFile(path.join(this.root, storageKey), "utf8");
    } catch {
      return null;
    }
  }
}

/** S3-compatible adapter stub — interface ready, not wired without credentials. */
export class S3SnapshotStorage implements SnapshotStorage {
  constructor(
    private readonly _cfg: {
      bucket: string;
      endpoint: string;
      accessKey: string;
      secretKey: string;
      region: string;
    },
  ) {}

  async putRaw(hash: string, _html: string): Promise<string> {
    void this._cfg;
    throw new Error("S3 storage is configured but not enabled in this environment. Use STORAGE_DRIVER=local.");
  }

  async getRaw(_storageKey: string): Promise<string | null> {
    throw new Error("S3 storage is configured but not enabled in this environment. Use STORAGE_DRIVER=local.");
  }
}

export function createStorage(driver: "local" | "s3", opts: {
  localPath: string;
  bucket?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  region?: string;
}): SnapshotStorage {
  if (driver === "s3") {
    return new S3SnapshotStorage({
      bucket: opts.bucket || "",
      endpoint: opts.endpoint || "",
      accessKey: opts.accessKey || "",
      secretKey: opts.secretKey || "",
      region: opts.region || "us-east-1",
    });
  }
  return new LocalSnapshotStorage(opts.localPath);
}

export function hashHtml(html: string) {
  return contentHash(html);
}
