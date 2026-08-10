import * as Diff from "diff";

export interface RawDiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

export interface RawDiffResult {
  lines: RawDiffLine[];
  added: number;
  removed: number;
  identical: boolean;
}

export function computeRawDiff(previous: string, current: string, context = 2): RawDiffResult {
  if (previous === current) {
    return { lines: [], added: 0, removed: 0, identical: true };
  }

  const parts = Diff.diffLines(previous, current);
  const lines: RawDiffLine[] = [];
  let added = 0;
  let removed = 0;

  for (const part of parts) {
    const split = part.value.replace(/\n$/, "").split("\n");
    for (const text of split) {
      if (part.added) {
        lines.push({ type: "add", text });
        added += 1;
      } else if (part.removed) {
        lines.push({ type: "remove", text });
        removed += 1;
      } else {
        lines.push({ type: "context", text });
      }
    }
  }

  // Compact long context runs
  const compacted: RawDiffLine[] = [];
  let ctxBuf: RawDiffLine[] = [];
  const flushCtx = () => {
    if (ctxBuf.length <= context * 2) compacted.push(...ctxBuf);
    else compacted.push(...ctxBuf.slice(0, context), { type: "context", text: "…" }, ...ctxBuf.slice(-context));
    ctxBuf = [];
  };
  for (const line of lines) {
    if (line.type === "context") ctxBuf.push(line);
    else {
      flushCtx();
      compacted.push(line);
    }
  }
  flushCtx();

  return { lines: compacted, added, removed, identical: false };
}

export function toUnifiedDiff(previous: string, current: string, label = "content"): string {
  return Diff.createTwoFilesPatch(`a/${label}`, `b/${label}`, previous, current, "", "");
}
