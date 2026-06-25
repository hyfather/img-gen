import { isPokemonType, POKEMON_TYPES, type PokemonType } from "@/lib/pokemon";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_DESCRIPTION_LENGTH = 600;

const FALLBACK_MOVES: Record<PokemonType, string> = {
  fire: "Ember Wink",
  water: "Bubble Rush",
  grass: "Leaf Leap",
  electric: "Spark Sprint",
  psychic: "Mind Glow",
  ice: "Frost Twirl",
  fairy: "Charm Shine",
};

type GenerateRequest = {
  description?: unknown;
  pokemonType?: unknown;
};

type OpenRouterChoice = {
  message?: {
    content?: unknown;
  };
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
};

type GeneratedPayload = {
  name?: unknown;
  hp?: unknown;
  move?: unknown;
  fill?: unknown;
  pokemonSvg?: unknown;
  backgroundSvg?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function readJsonObject(value: string): GeneratedPayload {
  const stripped = stripCodeFence(value);
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("The model did not return a JSON object.");
  }

  return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as GeneratedPayload;
}

function sanitizeSvg(svg: unknown, viewBox: string) {
  if (typeof svg !== "string") {
    return "";
  }

  const trimmed = svg.trim();

  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>")) {
    return "";
  }

  if (/<(?:script|iframe|foreignObject|image|use|animate|set)\b/i.test(trimmed)) {
    return "";
  }

  if (/\son\w+\s*=|javascript:|data:/i.test(trimmed)) {
    return "";
  }

  return trimmed
    .replace(/<\/?(?:html|body)[^>]*>/gi, "")
    .replace(/<svg\b([^>]*)>/i, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`);
}

function fallbackPokemonSvg(type: PokemonType) {
  const style = POKEMON_TYPES[type];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><ellipse cx="256" cy="404" rx="154" ry="38" fill="${style.color}" opacity=".2"/><circle cx="256" cy="238" r="122" fill="${style.color}" stroke="#111827" stroke-width="18"/><circle cx="210" cy="226" r="14" fill="#111827"/><circle cx="302" cy="226" r="14" fill="#111827"/><path d="M210 292q46 42 92 0" fill="none" stroke="#111827" stroke-width="18" stroke-linecap="round"/><path d="M156 146l-58-76 94 35M356 146l58-76-94 35" fill="${style.soft}" stroke="#111827" stroke-width="18" stroke-linejoin="round"/></svg>`;
}

function fallbackBackgroundSvg(type: PokemonType) {
  const style = POKEMON_TYPES[type];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${style.soft}"/><circle cx="230" cy="220" r="170" fill="${style.color}" opacity=".24"/><circle cx="1590" cy="820" r="260" fill="${style.color}" opacity=".18"/><path d="M0 790 C 380 660 700 900 1060 760 S 1640 640 1920 780 V1080 H0Z" fill="#fff" opacity=".72"/></svg>`;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return jsonError("OPENROUTER_API_KEY is not configured.", 500);
  }

  const body = (await request.json()) as GenerateRequest;
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!description) {
    return jsonError("Describe the Pokemon and background you want.", 400);
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return jsonError(`Descriptions must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`, 400);
  }

  if (!isPokemonType(body.pokemonType)) {
    return jsonError("Choose a valid Pokemon type.", 400);
  }

  const pokemonType = body.pokemonType;
  const style = POKEMON_TYPES[pokemonType];
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Canvas Camp Pokemon Generator",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Return only compact JSON. Create original, family-friendly, Pokemon-inspired but not copyrighted creature art. SVG must use only paths, circles, ellipses, rects, polygons, lines, groups, gradients, and text-free vector shapes. No scripts, images, links, animation, or foreignObject.",
        },
        {
          role: "user",
          content: `Pokemon type: ${style.name}. Theme colors: ${style.color}, ${style.soft}. User description: ${description}. Return JSON with keys name, hp, move, fill, pokemonSvg, backgroundSvg. pokemonSvg viewBox 0 0 512 512 transparent background. backgroundSvg viewBox 0 0 1920 1080 full scene background.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return jsonError("OpenRouter could not generate artwork right now.", response.status);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return jsonError("OpenRouter returned an empty response.", 502);
  }

  const generated = readJsonObject(content);
  const hp = clamp(
    typeof generated.hp === "number" ? Math.round(generated.hp) : 70,
    10,
    999,
  );
  const pokemonSvg = sanitizeSvg(generated.pokemonSvg, "0 0 512 512") || fallbackPokemonSvg(pokemonType);
  const backgroundSvg = sanitizeSvg(generated.backgroundSvg, "0 0 1920 1080") || fallbackBackgroundSvg(pokemonType);

  return Response.json({
    name: typeof generated.name === "string" ? generated.name.slice(0, 28) : `${style.name} Pal`,
    hp,
    move: typeof generated.move === "string" ? generated.move.slice(0, 24) : FALLBACK_MOVES[pokemonType],
    fill: typeof generated.fill === "string" && /^#[0-9a-f]{6}$/i.test(generated.fill) ? generated.fill : style.soft,
    pokemonType,
    pokemonSvg,
    backgroundSvg,
  });
}
