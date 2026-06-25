export const runtime = "nodejs";

const ALLOWED_BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";
const DEFAULT_IMAGE_CONTENT_TYPE = "image/jpeg";
const SVG_CONTENT_TYPE = "image/svg+xml";

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

function parseBlobUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url") ?? "";

  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(ALLOWED_BLOB_HOST_SUFFIX)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function contentTypeForBytes(bytes: ArrayBuffer, fallbackContentType: string) {
  const prefix = Buffer.from(bytes)
    .toString("utf8", 0, Math.min(bytes.byteLength, 256))
    .trimStart()
    .toLowerCase();

  if (prefix.startsWith("<svg") || prefix.startsWith("<?xml")) {
    return SVG_CONTENT_TYPE;
  }

  return fallbackContentType || DEFAULT_IMAGE_CONTENT_TYPE;
}

export async function GET(request: Request) {
  const url = parseBlobUrl(request);

  if (!url) {
    return jsonError("Choose a valid Blob image URL.", 400);
  }

  const response = await fetch(url, {
    cache: "force-cache",
  });

  if (!response.ok) {
    return jsonError(`Could not load Blob image (${response.status}).`, 502);
  }

  const bytes = await response.arrayBuffer();
  const contentType = contentTypeForBytes(
    bytes,
    response.headers.get("content-type") ?? DEFAULT_IMAGE_CONTENT_TYPE,
  );

  return new Response(bytes, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
  });
}
