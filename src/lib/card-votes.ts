import { createHash } from "node:crypto";

export type VoteChoice = "up" | "down";

export type CardVoteSummary = {
  downvotes: number;
  score: number;
  userVote: VoteChoice | null;
  upvotes: number;
};

type StoredCardVotes = {
  down: number;
  up: number;
  voters: Record<string, VoteChoice>;
};

type VotesStore = Record<string, StoredCardVotes>;

const EDGE_CONFIG_NAME = "img-gen-edge-config";
const VOTES_KEY = "cardVotes";

let localVotes: VotesStore = {};

function getEdgeConfigId() {
  const explicit = process.env.IMG_GEN_EDGE_CONFIG_ID || process.env.VERCEL_EDGE_CONFIG_ID || process.env.EDGE_CONFIG_ID;

  if (explicit) return explicit;

  const connection = process.env.EDGE_CONFIG;
  const match = connection?.match(/edge-config\.vercel\.com\/([^/?]+)/);

  return match?.[1] || "";
}

function getReadToken() {
  const explicit = process.env.IMG_GEN_EDGE_CONFIG_TOKEN || process.env.VERCEL_EDGE_CONFIG_TOKEN || process.env.EDGE_CONFIG_TOKEN;

  if (explicit) return explicit;

  try {
    const connection = process.env.EDGE_CONFIG;
    return connection ? new URL(connection).searchParams.get("token") || "" : "";
  } catch {
    return "";
  }
}

function getWriteToken() {
  return process.env.IMG_GEN_EDGE_CONFIG_WRITE_TOKEN || process.env.VERCEL_API_TOKEN || "";
}

function edgeConfigItemUrl(key = VOTES_KEY) {
  const id = getEdgeConfigId();
  const token = getReadToken();

  if (!id || !token) return "";

  const url = new URL(`https://edge-config.vercel.com/${id}/item/${key}`);
  url.searchParams.set("token", token);
  return url.toString();
}

function normalizeStore(value: unknown): VotesStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const store: VotesStore = {};

  for (const [cardId, votes] of Object.entries(value)) {
    if (!votes || typeof votes !== "object" || Array.isArray(votes)) continue;
    const record = votes as Partial<StoredCardVotes>;
    const voters =
      record.voters && typeof record.voters === "object" && !Array.isArray(record.voters)
        ? Object.fromEntries(
            Object.entries(record.voters).filter(
              (entry): entry is [string, VoteChoice] => entry[1] === "up" || entry[1] === "down",
            ),
          )
        : {};

    store[cardId] = {
      down: Math.max(0, Number(record.down) || 0),
      up: Math.max(0, Number(record.up) || 0),
      voters,
    };
  }

  return store;
}

export function voteSummaryFor(store: VotesStore, cardId: string, voterId = ""): CardVoteSummary {
  const votes = store[cardId];
  const userVote = voterId ? votes?.voters[voterId] ?? null : null;
  const upvotes = votes?.up ?? 0;
  const downvotes = votes?.down ?? 0;

  return {
    downvotes,
    score: upvotes - downvotes,
    upvotes,
    userVote,
  };
}

export async function readVotesStore(): Promise<VotesStore> {
  const url = edgeConfigItemUrl();

  if (!url) return localVotes;

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) return localVotes;

    return normalizeStore(await response.json());
  } catch {
    return localVotes;
  }
}

async function writeVotesStore(store: VotesStore) {
  const id = getEdgeConfigId();
  const token = getWriteToken();

  localVotes = store;

  if (!id || !token) return;

  const response = await fetch(`https://api.vercel.com/v1/edge-config/${id}/items`, {
    body: JSON.stringify({
      items: [
        {
          operation: "upsert",
          key: VOTES_KEY,
          value: store,
        },
      ],
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`Could not update ${EDGE_CONFIG_NAME} (${response.status}).`);
  }
}

export function voterIdFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    headers.get("x-real-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    headers.get("cf-connecting-ip") ||
    forwarded ||
    "unknown-ip";
  const userAgent = headers.get("user-agent") || "unknown-agent";
  const language = headers.get("accept-language") || "unknown-language";

  return createHash("sha256").update(`${ip}|${userAgent}|${language}`).digest("hex").slice(0, 32);
}

export function voterIdFromRequest(request: Request) {
  return voterIdFromHeaders(request.headers);
}

export async function castCardVote(cardId: string, voterId: string, choice: VoteChoice) {
  const store = await readVotesStore();
  const current = store[cardId] ?? { down: 0, up: 0, voters: {} };
  const previous = current.voters[voterId];

  if (previous === choice) {
    delete current.voters[voterId];
    current[choice] = Math.max(0, current[choice] - 1);
  } else {
    if (previous) current[previous] = Math.max(0, current[previous] - 1);
    current[choice] += 1;
    current.voters[voterId] = choice;
  }

  store[cardId] = current;
  await writeVotesStore(store);

  return voteSummaryFor(store, cardId, voterId);
}

export async function getCardVoteSummaries(cardIds: string[], voterId = "") {
  const store = await readVotesStore();

  return Object.fromEntries(cardIds.map((cardId) => [cardId, voteSummaryFor(store, cardId, voterId)]));
}
