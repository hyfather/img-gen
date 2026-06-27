import { readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { list, put, type ListCommandOptions, type PutCommandOptions } from "@vercel/blob";

export const GENERATED_DIR = "generated-coloring-pages";

export type GeneratedImage = {
  downloadUrl: string;
  pathname: string;
  renderUrl: string;
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

type BlobCommandAuthOptions = Pick<
  ListCommandOptions,
  "oidcToken" | "storeId" | "token"
>;

export function slugify(value: string) {
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

function getBlobAuthOptions(): BlobCommandAuthOptions {
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

export function getGeneratedImageStorageError() {
  if (isVercelRuntime() && !hasBlobConfig()) {
    return "Vercel Blob is not configured. Add PUBLIC_READ_WRITE_TOKEN, or set PUBLIC_STORE_ID with VERCEL_OIDC_TOKEN.";
  }

  return "";
}

function generatedPrefix(pokemonName: string, pose: string) {
  return `${GENERATED_DIR}/${slugify(pokemonName)}/${pose}/`;
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
            renderUrl: publicPath(pathname),
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
            renderUrl: publicPath(pathname),
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
    renderUrl: publicPath(pathname),
    source: "local",
    uploadedAt: new Date().toISOString(),
    url: publicPath(pathname),
  };
}

async function listAllLocalGeneratedImages(): Promise<GeneratedImage[]> {
  const root = join(process.cwd(), "public", GENERATED_DIR);
  const images: GeneratedImage[] = [];
  const isImage = (name: string) => /\.(jpe?g|png|webp)$/i.test(name);

  const collectFile = async (pathname: string, absolutePath: string) => {
    const stats = await stat(absolutePath);

    images.push({
      downloadUrl: publicPath(pathname),
      pathname,
      renderUrl: publicPath(pathname),
      source: "local",
      uploadedAt: stats.mtime.toISOString(),
      url: publicPath(pathname),
    });
  };

  try {
    const slugEntries = await readdir(root, { withFileTypes: true });

    for (const slugEntry of slugEntries) {
      if (slugEntry.isFile() && isImage(slugEntry.name)) {
        // Legacy flat files: generated-coloring-pages/<slug>-<pose>-<ts>.ext
        await collectFile(
          `${GENERATED_DIR}/${slugEntry.name}`,
          join(root, slugEntry.name),
        );
        continue;
      }

      if (!slugEntry.isDirectory()) {
        continue;
      }

      const poseRoot = join(root, slugEntry.name);
      const poseEntries = await readdir(poseRoot, { withFileTypes: true });

      for (const poseEntry of poseEntries) {
        if (!poseEntry.isDirectory()) {
          continue;
        }

        const poseDir = join(poseRoot, poseEntry.name);
        const fileEntries = await readdir(poseDir, { withFileTypes: true });

        for (const fileEntry of fileEntries) {
          if (fileEntry.isFile() && isImage(fileEntry.name)) {
            await collectFile(
              `${GENERATED_DIR}/${slugEntry.name}/${poseEntry.name}/${fileEntry.name}`,
              join(poseDir, fileEntry.name),
            );
          }
        }
      }
    }
  } catch {
    return [];
  }

  return sortNewestFirst(images);
}

export async function listAllGeneratedImages(
  limit = 60,
): Promise<GeneratedImage[]> {
  if (!shouldUseBlobStore()) {
    return (await listAllLocalGeneratedImages()).slice(0, limit);
  }

  if (getGeneratedImageStorageError()) {
    return [];
  }

  const result = await list({
    ...getBlobAuthOptions(),
    limit,
    prefix: `${GENERATED_DIR}/`,
  });

  return sortNewestFirst(
    result.blobs
      .filter((blob) => /\.(jpe?g|png|webp)$/i.test(blob.pathname))
      .map((blob) => ({
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        renderUrl: renderPath(blob.url),
        source: "blob" as const,
        uploadedAt: blob.uploadedAt.toISOString(),
        url: blob.url,
      })),
  ).slice(0, limit);
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
    ...getBlobAuthOptions(),
    limit: 24,
    prefix: generatedPrefix(pokemonName, pose),
  });

  return sortNewestFirst(
    result.blobs.map((blob) => ({
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      renderUrl: renderPath(blob.url),
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
  const blobOptions: PutCommandOptions = {
    ...getBlobAuthOptions(),
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
    contentType: options.contentType,
  };
  const blob = await put(pathname, bytes, blobOptions);

  return {
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    renderUrl: renderPath(blob.url),
    source: "blob",
    uploadedAt: new Date().toISOString(),
    url: blob.url,
  };
}
