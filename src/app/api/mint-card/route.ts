import { listMintedCards, saveMintedCard } from "@/lib/minted-cards";

export const runtime = "nodejs";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const DEFAULT_MINT_MODEL = "google/gemini-3-pro-image-preview";

type CardAttack = { name?: unknown; damage?: unknown };
type MintCardRequest = {
  finalCardImage?: unknown;
  pokemonName?: unknown;
  cardType?: unknown;
  cardStage?: unknown;
  cardHp?: unknown;
  evolvesFrom?: unknown;
  isExCard?: unknown;
  attacks?: unknown;
  weakness?: unknown;
  resistance?: unknown;
  retreatCost?: unknown;
  cardNumber?: unknown;
  cardRarity?: unknown;
  cardRaritySymbol?: unknown;
  illustratorName?: unknown;
  backgroundPrompt?: unknown;
  model?: unknown;
};
type OpenRouterImage = { b64_json?: string; url?: string };
type OpenRouterImageResponse = { data?: OpenRouterImage[]; error?: { message?: string } };
type OpenRouterImageRequest = {
  model: string;
  prompt: string;
  image?: string;
  images?: string[];
  modalities?: string[];
  output_format: string;
  size: string;
  n: number;
};

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function promptForRealisticCard(body: MintCardRequest) {
  const pokemonName = textValue(body.pokemonName, "the colored Pokemon");
  const cardType = textValue(body.cardType, "Pokemon");
  const cardStage = textValue(body.cardStage, "custom");
  const cardHp = typeof body.cardHp === "number" ? body.cardHp : textValue(body.cardHp, "custom");
  const evolvesFrom = textValue(body.evolvesFrom, pokemonName);
  const cardRarity = textValue(body.cardRarity, "Common");
  const cardRaritySymbol = textValue(body.cardRaritySymbol, "●");
  const illustratorName = textValue(body.illustratorName, "Unknown");
  const attacks = Array.isArray(body.attacks) ? (body.attacks as CardAttack[]) : [];
  const attackText = attacks
    .map((attack) => `${textValue(attack.name, "Attack")} ${textValue(attack.damage)}`.trim())
    .filter(Boolean)
    .join("; ");

  const exactHpText = `${cardHp} HP`;

  return `Use the provided image as the exact source of truth for a custom fan-made Pokemon-style trading card, then transform it into a realistic photographed premium collectible card.

Preserve all real card text exactly as supplied, with no invented or hallucinated text: Pokemon name ${pokemonName}${body.isExCard ? " ex" : ""}, ${cardStage}, exact HP text "${exactHpText}", ${cardType} type, evolves from ${evolvesFrom}, attacks ${attackText || "as shown"}, weakness ${textValue(body.weakness, "as shown")}, resistance ${textValue(body.resistance, "as shown")}, retreat ${textValue(body.retreatCost, "as shown")}, card number ${textValue(body.cardNumber, "as shown")}, rarity ${cardRarity} with symbol ${cardRaritySymbol}, illustrator line "Illus. ${illustratorName}".

Critical HP requirement: the final rendered card MUST show exactly "${exactHpText}" in the HP area. Copy those digits character-for-character. Do not round, cap, abbreviate, omit, restyle into a different number, or substitute any other HP value. If the HP is visually awkward because it is long, preserve the exact text anyway and fit it into the HP area.

Art direction: make the card look like a real physical premium monster-battle trading card photographed in a studio. Add believable glossy laminated cardstock, subtle rounded corners, tiny edge thickness, fine print texture, sharp ink, a slightly embossed border, and realistic shadows. Keep the card front centered and fully visible in portrait orientation.

Color constraints: preserve the color scheme from the user's colored-in line art and flat card preview. The Pokemon body colors, accent colors, fill colors, border color, type color, and background palette must remain recognizably the same as the provided image. You may add realistic lighting, gloss, foil shimmer, and shadows, but do not recolor the Pokemon, swap the palette, or introduce unrelated dominant colors.

The illustrator credit must be clearly readable on the lower portion of the card as "Illus. ${illustratorName}", not hidden in microtext. The rarity symbol ${cardRaritySymbol} must appear near the collector number.

Text constraints: do not add any extra labels, fake rules, fake copyright lines, random numbers, decorative glyph words, logos, or watermark text. If any text is unclear, keep the supplied card text above rather than inventing replacements. The exact HP text "${exactHpText}" is the highest-priority text requirement. The result should be a high-resolution realistic final card render, not a blank template.`;
}

async function readOpenRouterJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    return { data: null, errorMessage: `OpenRouter returned an empty response (${response.status}).` };
  }
  try {
    return { data: JSON.parse(text) as OpenRouterImageResponse, errorMessage: "" };
  } catch {
    return {
      data: null,
      errorMessage: text.slice(0, 240) || `OpenRouter returned a non-JSON response (${response.status}).`,
    };
  }
}

function getBase64Image(image: OpenRouterImage) {
  if (image.b64_json) return image.b64_json;
  if (image.url?.startsWith("data:image/")) return image.url.split(",", 2)[1] ?? "";
  return "";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return jsonError("OPENROUTER_API_KEY is not configured.");

    const body = (await request.json().catch(() => null)) as MintCardRequest | null;
    const finalCardImage = textValue(body?.finalCardImage);
    if (!body || !finalCardImage.startsWith("data:image/")) {
      return jsonError("Provide the final card image to mint.", 400);
    }

    const model = textValue(body.model, process.env.OPENROUTER_MINT_IMAGE_MODEL || DEFAULT_MINT_MODEL);
    const payload: OpenRouterImageRequest = {
      model,
      prompt: promptForRealisticCard(body),
      image: finalCardImage,
      images: [finalCardImage],
      modalities: ["image", "text"],
      output_format: "png",
      size: "1024x1536",
      n: 1,
    };
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Canvas Camp Card Minting",
    };

    let response = await fetch(OPENROUTER_IMAGES_URL, { method: "POST", headers, body: JSON.stringify(payload) });
    let parsed = await readOpenRouterJson(response);
    let result = parsed.data;
    let upstreamError = parsed.errorMessage;

    if (!response.ok && result?.error?.message?.toLowerCase().includes("modalit")) {
      const fallbackPayload: OpenRouterImageRequest = { ...payload };
      delete fallbackPayload.modalities;
      response = await fetch(OPENROUTER_IMAGES_URL, { method: "POST", headers, body: JSON.stringify(fallbackPayload) });
      parsed = await readOpenRouterJson(response);
      result = parsed.data;
      upstreamError = parsed.errorMessage;
    }

    if (!response.ok) {
      return jsonError(
        result?.error?.message || upstreamError || `OpenRouter returned ${response.status} ${response.statusText}.`,
        response.status,
      );
    }
    if (upstreamError) return jsonError(upstreamError, 502);

    const base64 = result?.data?.[0] ? getBase64Image(result.data[0]) : "";
    if (!base64) return jsonError("OpenRouter did not return PNG image data.", 502);

    const card = await saveMintedCard({
      base64,
      pokemonName: textValue(body.pokemonName, "minted-card"),
    });

    return Response.json({ imageUrl: card.renderUrl, card, model });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to mint the realistic card.");
  }
}

export async function GET() {
  try {
    return Response.json({ cards: await listMintedCards() });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load minted cards.",
    );
  }
}
