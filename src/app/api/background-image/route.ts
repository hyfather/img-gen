import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const DEFAULT_MODEL = "google/gemini-2.5-flash-image";
const GENERATED_DIR = "generated-backgrounds";

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

function promptForBackground(prompt: string) {
  return `Create a colorful, kid-friendly Pokemon trading card art background inspired by this scene: ${prompt}. Make it a clean landscape or studio backdrop with depth, bright lighting, and no characters, no creatures, no logos, no words, no watermark, and no border. Leave open space in the lower center where a colored Pokemon sticker can be placed. High-resolution PNG.`;
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

async function saveGeneratedImageLocally(prompt: string, base64: string) {
  if (process.env.VERCEL === "1") {
    return "";
  }

  const filename = `${slugify(prompt).slice(0, 48) || "background"}-${Date.now()}.png`;
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
      prompt?: unknown;
      model?: unknown;
    } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const model =
      typeof body?.model === "string" && body.model.trim()
        ? body.model.trim()
        : process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL;

    if (!prompt) {
      return jsonError("Describe the background to generate.", 400);
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Canvas Camp Card Backgrounds",
    };
    const payload: OpenRouterImageRequest = {
      model,
      prompt: promptForBackground(prompt),
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

    const savedImageUrl = await saveGeneratedImageLocally(prompt, base64);

    return Response.json({
      imageUrl: savedImageUrl || `data:image/png;base64,${base64}`,
      model,
      prompt,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate background.",
    );
  }
}
