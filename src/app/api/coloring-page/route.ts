import {
  listGeneratedImages,
  saveGeneratedImage,
} from "@/lib/generated-images";
import { POKEMON_TYPE_GROUPS } from "@/lib/pokemon";

export const runtime = "nodejs";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const IMAGE_MODEL = "recraft/recraft-v4.1-vector";
const OUTPUT_FORMAT = "jpeg";
const OUTPUT_CONTENT_TYPE = "image/jpeg";
const POSE_PROMPTS = {
  standing: "standing in a clear natural pose",
  sitting: "sitting in a cute relaxed pose",
  fighting: "in a dynamic fighting stance",
  attacking: "attacking with a signature move pose, without effects or scenery",
  evolving: "in an evolving transformation pose, without glow, gradients, or effects",
  running: "running forward in an energetic pose",
  jumping: "jumping in a playful action pose",
  sleeping: "sleeping peacefully in a simple curled pose",
} as const;

const POKEMON_NAMES = new Set(
  POKEMON_TYPE_GROUPS.flatMap((group) =>
    group.pokemon.map((pokemon) => pokemon.name.toLowerCase()),
  ),
);

type OpenRouterImage = {
  b64_json?: string;
  url?: string;
};

type OpenRouterImageResponse = {
  data?: OpenRouterImage[];
  error?: {
    message?: string;
  };
};

type OpenRouterImageRequest = {
  model: string;
  prompt: string;
  modalities?: string[];
  output_format: string;
  size: string;
  n: number;
};

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

async function readOpenRouterJson(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return {
      data: null,
      errorMessage: `OpenRouter returned an empty response (${response.status}).`,
    };
  }

  try {
    return {
      data: JSON.parse(text) as OpenRouterImageResponse,
      errorMessage: "",
    };
  } catch {
    return {
      data: null,
      errorMessage:
        text.slice(0, 240) ||
        `OpenRouter returned a non-JSON response (${response.status}).`,
    };
  }
}

function promptForPokemon(pokemonName: string, posePrompt: string) {
  return `Create a clean black-and-white outline drawing of ${pokemonName}, closely matching the real character design and proportions so it is immediately recognizable. Show the Pokemon ${posePrompt} that preserves its signature features, anatomy, expression, and major markings. Use bold, smooth black outlines with closed enclosed shapes so the image is suitable for coloring and easy to flood fill. Keep the inside plain white only, with no color, no shading, no gradients, no texture, and no sketch lines. Simplify only tiny surface details as needed, but retain the authentic silhouette and major visual details. Use a plain white background, no text, no scenery, no border, and output as a high-resolution PNG centered in frame.`;
}

function getImagePayload(image: OpenRouterImage) {
  if (image.b64_json) {
    return {
      base64: image.b64_json,
      contentType: OUTPUT_CONTENT_TYPE,
      extension: "jpg",
    };
  }

  if (image.url?.startsWith("data:image/")) {
    const [header, base64 = ""] = image.url.split(",", 2);
    const contentType = header.match(/^data:(image\/[^;]+)/)?.[1] ?? OUTPUT_CONTENT_TYPE;
    const extension = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";

    return {
      base64,
      contentType,
      extension,
    };
  }

  return {
    base64: "",
    contentType: OUTPUT_CONTENT_TYPE,
    extension: "jpg",
  };
}

function parsePokemonPose(request: Request, body?: { pokemonName?: unknown; pose?: unknown } | null) {
  const url = new URL(request.url);
  const pokemonName =
    typeof body?.pokemonName === "string"
      ? body.pokemonName.trim()
      : (url.searchParams.get("pokemonName") ?? "").trim();
  const poseValue =
    typeof body?.pose === "string" ? body.pose : url.searchParams.get("pose");
  const pose =
    typeof poseValue === "string" && poseValue in POSE_PROMPTS
      ? (poseValue as keyof typeof POSE_PROMPTS)
      : "standing";

  return { pokemonName, pose };
}

function validatePokemon(pokemonName: string) {
  return Boolean(pokemonName && POKEMON_NAMES.has(pokemonName.toLowerCase()));
}

export async function GET(request: Request) {
  try {
    const { pokemonName, pose } = parsePokemonPose(request);

    if (!validatePokemon(pokemonName)) {
      return jsonError("Choose a supported Pokemon.", 400);
    }

    return Response.json({
      images: await listGeneratedImages(pokemonName, pose),
      pokemonName,
      pose,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load images.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return jsonError("OPENROUTER_API_KEY is not configured.");
    }

    const body = (await request.json().catch(() => null)) as {
      pokemonName?: unknown;
      pose?: unknown;
    } | null;
    const { pokemonName, pose } = parsePokemonPose(request, body);

    if (!validatePokemon(pokemonName)) {
      return jsonError("Choose a supported Pokemon.", 400);
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Canvas Camp Coloring Pages",
    };
    const payload: OpenRouterImageRequest = {
      model: IMAGE_MODEL,
      prompt: promptForPokemon(pokemonName, POSE_PROMPTS[pose]),
      modalities: ["image", "text"],
      output_format: OUTPUT_FORMAT,
      size: "1024x1024",
      n: 1,
    };

    let response = await fetch(OPENROUTER_IMAGES_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    let parsed = await readOpenRouterJson(response);
    let result = parsed.data;
    let upstreamError = parsed.errorMessage;

    if (
      !response.ok &&
      result?.error?.message?.toLowerCase().includes("modalit")
    ) {
      const fallbackPayload: OpenRouterImageRequest = { ...payload };
      delete fallbackPayload.modalities;

      response = await fetch(OPENROUTER_IMAGES_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(fallbackPayload),
      });
      parsed = await readOpenRouterJson(response);
      result = parsed.data;
      upstreamError = parsed.errorMessage;
    }

    if (!response.ok) {
      return jsonError(
        result?.error?.message ||
          upstreamError ||
          `OpenRouter returned ${response.status} ${response.statusText}.`,
        response.status,
      );
    }

    if (upstreamError) {
      return jsonError(upstreamError, 502);
    }

    const imagePayload = result?.data?.[0]
      ? getImagePayload(result.data[0])
      : {
          base64: "",
          contentType: OUTPUT_CONTENT_TYPE,
          extension: "jpg",
        };

    if (!imagePayload.base64) {
      return jsonError("OpenRouter did not return image data.", 502);
    }

    const image = await saveGeneratedImage({
      base64: imagePayload.base64,
      contentType: imagePayload.contentType,
      extension: imagePayload.extension,
      pokemonName,
      pose,
    });

    return Response.json(
      {
        image,
        imageUrl: image.url,
        model: IMAGE_MODEL,
        pokemonName,
        pose,
      },
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate image.",
    );
  }
}
