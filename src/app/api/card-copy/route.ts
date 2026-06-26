export const runtime = "nodejs";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

type CardCopyRequest = {
  pokemonName?: unknown;
  pokemonType?: unknown;
  hp?: unknown;
  rarity?: unknown;
  raritySymbol?: unknown;
  pose?: unknown;
  model?: unknown;
};

type OpenRouterChatResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  error?: {
    message?: string;
  };
};

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fallbackCardCopy(body: CardCopyRequest) {
  const pokemonName = textValue(body.pokemonName, "Pokemon");

  return {
    attackOneName: "Quick Spark",
    attackOneDamage: "90",
    attackTwoName: `${pokemonName} Burst`,
    attackTwoDamage: "180",
    weakness: "x2",
    resistance: "-30",
    retreatCost: "★★",
    cardStage: "Basic",
    evolvesFrom: pokemonName,
    isExCard: false,
    cardNumber: "001/132",
  };
}

function promptForCardCopy(body: CardCopyRequest) {
  const pokemonName = textValue(body.pokemonName, "Pokemon");
  const pokemonType = textValue(body.pokemonType, "Pokemon");
  const hp = numberValue(body.hp, 120);
  const rarity = textValue(body.rarity, "Common");
  const raritySymbol = textValue(body.raritySymbol, "●");
  const pose = textValue(body.pose, "standing");

  return `Create concise trading-card game text for a fan-made Pokemon-style card.

Inputs:
- Pokemon: ${pokemonName}
- Type: ${pokemonType}
- HP: ${hp}
- Rarity: ${rarity} (${raritySymbol})
- Pose: ${pose}

Return ONLY valid JSON with exactly these keys:
{
  "attackOneName": "2-4 words",
  "attackOneDamage": "number string between 30 and 160",
  "attackTwoName": "2-4 words",
  "attackTwoDamage": "number string between 80 and 300",
  "weakness": "x2 or none",
  "resistance": "-30 or none",
  "retreatCost": "one to four star symbols",
  "cardStage": "Basic, Stage 1, Stage 2, or Mega",
  "evolvesFrom": "short Pokemon-like predecessor name or the Pokemon name",
  "isExCard": boolean,
  "cardNumber": "collector number only, like 024/132"
}

Make the attacks match the Pokemon identity and type. Higher HP and rarer cards may have stronger attacks.`;
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("The model did not return JSON.");
    }

    return JSON.parse(match[0]);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CardCopyRequest | null;

    if (!body) {
      return jsonError("Provide card details.", 400);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return Response.json(fallbackCardCopy(body));
    }

    const model = textValue(
      body.model,
      process.env.OPENROUTER_TEXT_MODEL || DEFAULT_MODEL,
    );
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Canvas Camp Card Copy",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You write polished, concise fan-made trading card game text and return strict JSON only.",
          },
          { role: "user", content: promptForCardCopy(body) },
        ],
        temperature: 0.8,
      }),
    });
    const text = await response.text();

    if (!text.trim()) {
      return jsonError(`OpenRouter returned an empty response (${response.status}).`, 502);
    }

    const result = JSON.parse(text) as OpenRouterChatResponse;

    if (!response.ok) {
      return jsonError(
        result.error?.message || `OpenRouter returned ${response.status}.`,
        response.status,
      );
    }

    const content = result.choices?.[0]?.message?.content ?? "";
    const generated = parseJsonObject(content);

    return Response.json({
      ...fallbackCardCopy(body),
      ...generated,
      model,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate card copy.",
    );
  }
}
