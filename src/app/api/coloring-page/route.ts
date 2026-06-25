import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { POKEMON_TYPE_GROUPS } from "@/lib/pokemon";

export const runtime = "nodejs";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const DEFAULT_MODEL = "google/gemini-2.5-flash-image";
const GENERATED_DIR = "generated-coloring-pages";
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getBase64Image(image: OpenRouterImage) {
  if (image.b64_json) {
    return image.b64_json;
  }

  if (image.url?.startsWith("data:image/")) {
    return image.url.split(",", 2)[1] ?? "";
  }

  return "";
}

async function saveGeneratedImageLocally(
  pokemonName: string,
  pose: keyof typeof POSE_PROMPTS,
  base64: string,
) {
  if (process.env.VERCEL === "1") {
    return "";
  }

  const filename = `${slugify(pokemonName)}-${pose}-${Date.now()}.png`;
  const directory = join(process.cwd(), "public", GENERATED_DIR);
  const path = join(directory, filename);
  const bytes = Buffer.from(base64, "base64");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, bytes);

    return `/${GENERATED_DIR}/${filename}`;
  } catch {
    return "";
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
      model?: unknown;
    } | null;
    const pokemonName =
      typeof body?.pokemonName === "string" ? body.pokemonName.trim() : "";
    const pose =
      typeof body?.pose === "string" && body.pose in POSE_PROMPTS
        ? (body.pose as keyof typeof POSE_PROMPTS)
        : "standing";
    const model =
      typeof body?.model === "string" && body.model.trim()
        ? body.model.trim()
        : process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL;

    if (!pokemonName || !POKEMON_NAMES.has(pokemonName.toLowerCase())) {
      return jsonError("Choose a supported Pokemon.", 400);
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Canvas Camp Coloring Pages",
    };
    const payload: OpenRouterImageRequest = {
      model,
      prompt: promptForPokemon(pokemonName, POSE_PROMPTS[pose]),
      modalities: ["image", "text"],
      output_format: "png",
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

    const base64 = result?.data?.[0] ? getBase64Image(result.data[0]) : "";

    if (!base64) {
      return jsonError("OpenRouter did not return PNG image data.", 502);
    }

    const savedImageUrl = await saveGeneratedImageLocally(
      pokemonName,
      pose,
      base64,
    );

    return Response.json(
      {
        imageUrl: savedImageUrl || `data:image/png;base64,${base64}`,
        model,
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
