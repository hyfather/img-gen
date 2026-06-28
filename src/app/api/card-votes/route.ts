import {
  castCardVote,
  getCardVoteSummaries,
  type VoteChoice,
  voterIdFromRequest,
} from "@/lib/card-votes";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

function validChoice(value: unknown): value is VoteChoice {
  return value === "up" || value === "down";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cardIds = url.searchParams.getAll("cardId").filter(Boolean);
  const voterId = voterIdFromRequest(request);

  return Response.json({ votes: await getCardVoteSummaries(cardIds, voterId) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      cardId?: unknown;
      vote?: unknown;
    } | null;
    const cardId = typeof body?.cardId === "string" ? body.cardId.trim() : "";

    if (!cardId) return jsonError("Choose a card to vote on.", 400);
    if (!validChoice(body?.vote)) return jsonError("Choose an upvote or downvote.", 400);

    const summary = await castCardVote(cardId, voterIdFromRequest(request), body.vote);

    return Response.json({ cardId, summary });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save vote.");
  }
}
