import type { RealtimeEvent } from "@trace/shared";

type Client = {
  userId: string;
  projectId?: string;
  write: (chunk: string) => void;
  close: () => void;
};

const clients = new Set<Client>();

export function subscribeSse(client: Client) {
  clients.add(client);
  return () => clients.delete(client);
}

export function publishRealtime(payload: {
  event: RealtimeEvent | string;
  userId: string;
  projectId?: string;
  data: Record<string, unknown>;
}) {
  const frame = `event: ${payload.event}\ndata: ${JSON.stringify({
    ...payload.data,
    projectId: payload.projectId,
    at: new Date().toISOString(),
  })}\n\n`;

  for (const client of clients) {
    if (client.userId !== payload.userId) continue;
    if (client.projectId && payload.projectId && client.projectId !== payload.projectId) continue;
    try {
      client.write(frame);
    } catch {
      clients.delete(client);
    }
  }
}
