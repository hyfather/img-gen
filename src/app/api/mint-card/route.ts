import {
  CARD_ASPECT_RATIO,
  CARD_RENDER_HEIGHT,
  CARD_RENDER_SIZE,
  CARD_RENDER_WIDTH,
} from "@/lib/card";
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
  cardBorderColor?: unknown;
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
  const cardType = textValue(body.cardType, "Normal");
  const cardStage = textValue(body.cardStage, "Basic");
  const cardHp = typeof body.cardHp === "number" ? body.cardHp : textValue(body.cardHp, "60");
  const isExCard = Boolean(body.isExCard);
  const cardRarity = textValue(body.cardRarity, "Common");
  const cardRaritySymbol = textValue(body.cardRaritySymbol, "●");
  const cardNumber = textValue(body.cardNumber, "as shown");
  const illustratorName = textValue(body.illustratorName, "Unknown");
  const cardBorderColor = textValue(body.cardBorderColor);
  const weakness = textValue(body.weakness, "as shown");
  const resistance = textValue(body.resistance);
  const retreatCost = textValue(body.retreatCost, "as shown");

  // A Basic Pokemon has no "evolves from" line; neither does a card whose
  // evolves-from just echoes its own name. Only surface it when it adds info.
  const isBasic = /basic/i.test(cardStage);
  const evolvesFromRaw = textValue(body.evolvesFrom);
  const evolvesFrom =
    !isBasic && evolvesFromRaw && evolvesFromRaw.toLowerCase() !== pokemonName.toLowerCase()
      ? evolvesFromRaw
      : "";

  const attacks = Array.isArray(body.attacks) ? (body.attacks as CardAttack[]) : [];
  const attackLines = attacks
    .map((attack) => {
      const name = textValue(attack.name);
      if (!name) return "";
      const damage = textValue(attack.damage);
      return damage ? `"${name}" (damage ${damage})` : `"${name}"`;
    })
    .filter(Boolean);
  const attackText = attackLines.length ? attackLines.join(", and ") : "the attack(s) shown";

  // The three strings that must survive verbatim onto the printed card.
  const fullName = `${pokemonName}${isExCard ? " ex" : ""}`;
  const exactHp = `${cardHp} HP`;
  const illustratorCredit = `Illus. ${illustratorName}`;

  return `Role: You are a master Pokemon Trading Card Game illustrator and print designer. Turn the provided image into a single, authentic, modern Pokemon TCG card — one that looks like a real card freshly pulled from a booster pack, convincing enough to be mistaken for an official print, never a cartoonish or obviously fake mock-up.

THE ARTWORK
The provided image is a child's hand-colored Pokemon line drawing on a white background. Merge the colors that the child has chosen with the real pokemon, almost like a gradient. So if you're provided a blue picachu sketch, the minted card should feature an ultra realistic pikachu with a blue hue. The artwork that you display on the card that you generate should resemble a real life pokemon card. The generated card should not look like a child's artwork.

CARD LAYOUT — place every element where a real Pokemon card puts it, and render all text as crisp, sharp, correctly-spelled professional print:
- Top row: the stage label "${cardStage}" small in the upper-left${evolvesFrom ? `, with a tiny "Evolves from ${evolvesFrom}" line beneath it` : ""}; the name "${fullName}" in the large bold name typeface across the top; and in the upper-right the HP printed as "${exactHp}" immediately followed by the ${cardType}-type energy symbol.
- Center: a framed illustration window holding the child's colored Pokemon as the main art.
- Just below the art: a thin flavor strip (Pokemon category plus a height/weight style line).
- Attacks: ${attackText}. Lay each attack out like a real card — ${cardType}-type energy-cost symbols on the left, the attack name in the middle, the damage number right-aligned, and a short rules sentence beneath the name.
- Bottom stats row: "Weakness" with a type symbol and "${weakness}"; "Resistance" ${resistance ? `with a type symbol and "${resistance}"` : "(leave the value blank)"}; and "Retreat Cost" shown as a row of colorless energy symbols matching "${retreatCost}".
- Very bottom edge: the illustrator credit "${illustratorCredit}" in the lower-left corner, and the collector number ${cardNumber} with the rarity symbol ${cardRaritySymbol} in the lower-right corner.
Rarity is ${cardRarity}; reflect it in the finish — commons stay matte/plain while rarer cards earn a stronger holo/foil treatment on the frame and art window.
${isExCard ? `This is an "ex" card: use the modern ex card frame with its silver/two-tone styling, and set the "ex" in its signature lowercase italic lettering right after the name.\n` : ""}${cardBorderColor ? `Outer card border/frame color: ${cardBorderColor}.\n` : ""}
EXACT TEXT — copy these strings character-for-character; never translate, round, cap, abbreviate, restyle, or invent values:
- HP must read exactly "${exactHp}". If the number is unusually large, keep every digit and shrink the text to fit the HP area rather than rounding or truncating it.
- Illustrator credit must read exactly "${illustratorCredit}", clearly legible as normal small print (not hidden microtext).
- Name must read exactly "${fullName}".
Add no other text: no extra attacks, invented stats, stray numbers, flavor or copyright lines, set logos, or watermarks beyond what is listed above. If you are unsure what belongs somewhere, leave it blank rather than guessing.

REALISM: match a genuine printed card — official-style typography with proper kerning and alignment, glossy laminated cardstock with fine print texture, clean sharp ink, and a tasteful foil/holo sheen on the frame and rarity area. Keep the lighting flat and even, as on a scanned card.

OUTPUT FORMAT:
- Exactly ONE card. Never two cards, a side-by-side pair, a grid, a sheet, a before/after, a normal-versus-holo comparison, mirrored or duplicate copies, or any partial second card anywhere in the frame.
- The single card fills the whole frame edge-to-edge: a flat, perfectly head-on scan of the card FRONT in portrait orientation, exactly ${CARD_RENDER_WIDTH}x${CARD_RENDER_HEIGHT} pixels (${CARD_ASPECT_RATIO}). The card's own printed edge is the edge of the image.
- No surrounding scene, table, desk, hand, sleeve, holder, mat, drop shadow, photo border, margins, or whitespace around the card, and no visible card thickness or 3D perspective.`;
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
      size: CARD_RENDER_SIZE,
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
      illustratorName: textValue(body.illustratorName),
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
