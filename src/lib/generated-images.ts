import { readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";

export const GENERATED_DIR = "generated-coloring-pages";

export type GeneratedImage = {
  downloadUrl: string;
  pathname: string;
  source: "blob" | "local";
  uploadedAt: string;
  url: string;
};

type SaveGeneratedImageOptions = {
  base64: string;
  contentType: string;
  extension: string;
  pokemonName: string;
  pose: string;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hasBlobConfig() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
  );
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function shouldUseBlobStore() {
  return isVercelRuntime() || hasBlobConfig();
}

export function getGeneratedImageStorageError() {
  if (isVercelRuntime() && !hasBlobConfig()) {
    return "Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN, or enable Blob OIDC with BLOB_STORE_ID and VERCEL_OIDC_TOKEN.";
  }

  return "";
}

function generatedPrefix(pokemonName: string, pose: string) {
  return `${GENERATED_DIR}/${slugify(pokemonName)}/${pose}/`;
}

function publicPath(pathname: string) {
  return `/${pathname}`;
}

function sortNewestFirst(images: GeneratedImage[]) {
  return images.sort(
    (left, right) =>
      new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  );
}

async function listLocalDirectoryImages(
  pokemonName: string,
  pose: string,
): Promise<GeneratedImage[]> {
  const prefix = generatedPrefix(pokemonName, pose);
  const directory = join(process.cwd(), "public", prefix);

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const images = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /\.(jpe?g|png|webp)$/i.test(entry.name))
        .map(async (entry) => {
          const pathname = `${prefix}${entry.name}`;
          const stats = await stat(join(directory, entry.name));

          return {
            downloadUrl: publicPath(pathname),
            pathname,
            source: "local" as const,
            uploadedAt: stats.mtime.toISOString(),
            url: publicPath(pathname),
          };
        }),
    );

    return images;
  } catch {
    return [];
  }
}

async function listLegacyLocalImages(
  pokemonName: string,
  pose: string,
): Promise<GeneratedImage[]> {
  const directory = join(process.cwd(), "public", GENERATED_DIR);
  const filenamePrefix = `${slugify(pokemonName)}-${pose}-`;

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const images = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.startsWith(filenamePrefix) &&
            /\.(jpe?g|png|webp)$/i.test(entry.name),
        )
        .map(async (entry) => {
          const pathname = `${GENERATED_DIR}/${entry.name}`;
          const stats = await stat(join(directory, entry.name));

          return {
            downloadUrl: publicPath(pathname),
            pathname,
            source: "local" as const,
            uploadedAt: stats.mtime.toISOString(),
            url: publicPath(pathname),
          };
        }),
    );

    return images;
  } catch {
    return [];
  }
}

async function listLocalGeneratedImages(
  pokemonName: string,
  pose: string,
): Promise<GeneratedImage[]> {
  const images = [
    ...(await listLocalDirectoryImages(pokemonName, pose)),
    ...(await listLegacyLocalImages(pokemonName, pose)),
  ];

  return sortNewestFirst(images);
}

async function saveGeneratedImageLocally({
  base64,
  extension,
  pokemonName,
  pose,
}: SaveGeneratedImageOptions): Promise<GeneratedImage> {
  const prefix = generatedPrefix(pokemonName, pose);
  const filename = `${Date.now()}.${extension}`;
  const pathname = `${prefix}${filename}`;
  const directory = join(process.cwd(), "public", prefix);
  const bytes = Buffer.from(base64, "base64");

  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), bytes);

  return {
    downloadUrl: publicPath(pathname),
    pathname,
    source: "local",
    uploadedAt: new Date().toISOString(),
    url: publicPath(pathname),
  };
}

export async function listGeneratedImages(
  pokemonName: string,
  pose: string,
): Promise<GeneratedImage[]> {
  if (!shouldUseBlobStore()) {
    return listLocalGeneratedImages(pokemonName, pose);
  }

  if (getGeneratedImageStorageError()) {
    return [];
  }

  const result = await list({
    limit: 24,
    prefix: generatedPrefix(pokemonName, pose),
  });

  return sortNewestFirst(
    result.blobs.map((blob) => ({
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      source: "blob",
      uploadedAt: blob.uploadedAt.toISOString(),
      url: blob.url,
    })),
  );
}

export async function saveGeneratedImage(
  options: SaveGeneratedImageOptions,
): Promise<GeneratedImage> {
  const storageError = getGeneratedImageStorageError();

  if (storageError) {
    throw new Error(storageError);
  }

  if (!shouldUseBlobStore()) {
    return saveGeneratedImageLocally(options);
  }

  const prefix = generatedPrefix(options.pokemonName, options.pose);
  const pathname = `${prefix}${Date.now()}.${options.extension}`;
  const bytes = Buffer.from(options.base64, "base64");
  const blob = await put(pathname, bytes, {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
    contentType: options.contentType,
  });

  return {
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    source: "blob",
    uploadedAt: new Date().toISOString(),
    url: blob.url,
  };
}
