import { readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";

export const MINTED_CARDS_DIR = "generated-minted-cards";

export type MintedCard = {
  downloadUrl: string;
  pathname: string;
  pokemonName: string;
  renderUrl: string;
  source: "blob" | "local";
  uploadedAt: string;
  url: string;
};

type SaveMintedCardOptions = {
  base64: string;
  pokemonName: string;
};

type BlobAuthOptions = {
  oidcToken?: string;
  storeId?: string;
  token?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getBlobReadWriteToken() {
  return process.env.PUBLIC_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
}

function getBlobStoreId() {
  return process.env.PUBLIC_STORE_ID || process.env.BLOB_STORE_ID;
}

function getBlobOidcToken() {
  return process.env.VERCEL_OIDC_TOKEN;
}

function hasBlobConfig() {
  return Boolean(getBlobReadWriteToken() || (getBlobStoreId() && getBlobOidcToken()));
}

function getBlobAuthOptions(): BlobAuthOptions {
  const token = getBlobReadWriteToken();

  if (token) {
    return { token };
  }

  const storeId = getBlobStoreId();
  const oidcToken = getBlobOidcToken();

  if (storeId && oidcToken) {
    return { oidcToken, storeId };
  }

  return {};
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function shouldUseBlobStore() {
  return isVercelRuntime() || hasBlobConfig();
}

export function getMintedCardStorageError() {
  if (isVercelRuntime() && !hasBlobConfig()) {
    return "Vercel Blob is not configured. Add PUBLIC_READ_WRITE_TOKEN, or set PUBLIC_STORE_ID with VERCEL_OIDC_TOKEN.";
  }

  return "";
}

function mintedCardPrefix() {
  return `${MINTED_CARDS_DIR}/`;
}

function publicPath(pathname: string) {
  return `/${pathname}`;
}

function renderPath(url: string) {
  if (!url.startsWith("http")) {
    return url;
  }

  return `/api/coloring-page/image?url=${encodeURIComponent(url)}`;
}

function pokemonNameFromPathname(pathname: string) {
  const filename = pathname.split("/").pop() ?? "minted-card";
  const slug = filename.replace(/-\d+\.png$/i, "").replace(/\.png$/i, "");
  const words = slug.replace(/-/g, " ").trim();

  if (!words || words === "minted card") {
    return "Custom Pokemon";
  }

  return words.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortNewestFirst(cards: MintedCard[]) {
  return cards.sort(
    (left, right) =>
      new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  );
}

async function listLocalMintedCards(): Promise<MintedCard[]> {
  const prefix = mintedCardPrefix();
  const directory = join(process.cwd(), "public", prefix);

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const cards = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
        .map(async (entry) => {
          const pathname = `${prefix}${entry.name}`;
          const stats = await stat(join(directory, entry.name));

          return {
            downloadUrl: publicPath(pathname),
            pathname,
            pokemonName: pokemonNameFromPathname(pathname),
            renderUrl: publicPath(pathname),
            source: "local" as const,
            uploadedAt: stats.mtime.toISOString(),
            url: publicPath(pathname),
          };
        }),
    );

    return sortNewestFirst(cards);
  } catch {
    return [];
  }
}

export async function listMintedCards(): Promise<MintedCard[]> {
  if (!shouldUseBlobStore()) {
    return listLocalMintedCards();
  }

  if (getMintedCardStorageError()) {
    return [];
  }

  const result = await list({
    ...getBlobAuthOptions(),
    limit: 100,
    prefix: mintedCardPrefix(),
  } as Parameters<typeof list>[0]);

  return sortNewestFirst(
    result.blobs.map((blob) => ({
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      pokemonName: pokemonNameFromPathname(blob.pathname),
      renderUrl: renderPath(blob.url),
      source: "blob" as const,
      uploadedAt: blob.uploadedAt.toISOString(),
      url: blob.url,
    })),
  );
}

export async function saveMintedCard({
  base64,
  pokemonName,
}: SaveMintedCardOptions): Promise<MintedCard> {
  const storageError = getMintedCardStorageError();

  if (storageError) {
    throw new Error(storageError);
  }

  const filename = `${slugify(pokemonName) || "minted-card"}-${Date.now()}.png`;
  const pathname = `${mintedCardPrefix()}${filename}`;
  const bytes = Buffer.from(base64, "base64");

  if (!shouldUseBlobStore()) {
    const directory = join(process.cwd(), "public", mintedCardPrefix());

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), bytes);

    return {
      downloadUrl: publicPath(pathname),
      pathname,
      pokemonName: pokemonNameFromPathname(pathname),
      renderUrl: publicPath(pathname),
      source: "local",
      uploadedAt: new Date().toISOString(),
      url: publicPath(pathname),
    };
  }

  const blob = await put(pathname, bytes, {
    ...getBlobAuthOptions(),
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
    contentType: "image/png",
  } as Parameters<typeof put>[2]);

  return {
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    pokemonName: pokemonNameFromPathname(blob.pathname),
    renderUrl: renderPath(blob.url),
    source: "blob",
    uploadedAt: new Date().toISOString(),
    url: blob.url,
  };
}
