import { readdir } from "node:fs/promises";
import { join, parse } from "node:path";

export type CanvasBackground = {
  name: string;
  src: string;
};

const BACKGROUND_DIR = "backgrounds";

function formatBackgroundName(filename: string) {
  const name = parse(filename).name.replaceAll(/[-_]+/g, " ").trim();

  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function getCanvasBackgrounds(): Promise<CanvasBackground[]> {
  const directory = join(process.cwd(), "public", BACKGROUND_DIR);

  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
      .map((entry) => ({
        name: formatBackgroundName(entry.name),
        src: `/${BACKGROUND_DIR}/${encodeURIComponent(entry.name)}`,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}
