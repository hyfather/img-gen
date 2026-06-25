"use client";

import {
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  PaintBucket,
  Sparkles,
  Undo2,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import {
  POKEMON_COUNT,
  POKEMON_TYPE_GROUPS,
  type PokemonOption,
  type PokemonType,
} from "@/lib/pokemon";

type GenerateResponse = {
  imageUrl?: string;
  error?: string;
  model?: string;
};

type PoseOption = {
  id: string;
  label: string;
};

const CANVAS_SIZE = 1024;
const OUTLINE_DILATION_RADIUS = 2;
const TAP_SEARCH_RADIUS = 12;
const DEFAULT_MODEL = "google/gemini-2.5-flash-image";
const MODEL_OPTIONS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];
const SWATCHES = [
  "#fef08a",
  "#fb923c",
  "#38bdf8",
  "#22c55e",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#94a3b8",
  "#ffffff",
];
const POSE_OPTIONS: PoseOption[] = [
  { id: "standing", label: "Standing" },
  { id: "sitting", label: "Sitting" },
  { id: "fighting", label: "Fighting" },
  { id: "attacking", label: "Attacking" },
  { id: "evolving", label: "Evolving" },
  { id: "running", label: "Running" },
  { id: "jumping", label: "Jumping" },
  { id: "sleeping", label: "Sleeping" },
];

function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";

  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}.`));
    image.src = src;
  });
}

function hexToRgba(fillColor: string) {
  const clean = fillColor.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((character) => character + character)
          .join("")
      : clean;
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
    a: 255,
  };
}

async function readGenerateResponse(response: Response): Promise<GenerateResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      error: `Server returned an empty response (${response.status}).`,
    };
  }

  try {
    return JSON.parse(text) as GenerateResponse;
  } catch {
    return {
      error: text.slice(0, 240) || "Server returned a non-JSON response.",
    };
  }
}

export function CanvasEditor() {
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const boundaryMaskRef = useRef<Uint8Array | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const [activeType, setActiveType] = useState<PokemonType>("electric");
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonOption>(
    POKEMON_TYPE_GROUPS[0].pokemon[0],
  );
  const [fillColor, setFillColor] = useState(SWATCHES[0]);
  const [selectedPose, setSelectedPose] = useState(POSE_OPTIONS[0].id);
  const [imageUrl, setImageUrl] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState("Choose a Pokemon");
  const [isGenerating, setIsGenerating] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  function clearAllCanvases() {
    for (const canvas of [
      maskCanvasRef.current,
      colorCanvasRef.current,
      lineCanvasRef.current,
    ]) {
      const context = canvas?.getContext("2d");

      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    undoStackRef.current = [];
    boundaryMaskRef.current = null;
    setCanUndo(false);
    setImageUrl("");
  }

  async function generateColoringPagePng(pokemonName: string) {
    const poseLabel =
      POSE_OPTIONS.find((pose) => pose.id === selectedPose)?.label ??
      POSE_OPTIONS[0].label;

    setIsGenerating(true);
    setStatus(`Generating ${pokemonName} ${poseLabel.toLowerCase()}`);

    try {
      const response = await fetch("/api/coloring-page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pokemonName,
          pose: selectedPose,
          model,
        }),
      });
      const result = await readGenerateResponse(response);

      if (!response.ok || !result.imageUrl) {
        throw new Error(result.error || "Could not generate the PNG.");
      }

      await loadImageToCanvases(result.imageUrl);
      setImageUrl(result.imageUrl);
      setStatus(`${pokemonName} ${poseLabel.toLowerCase()} ready`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function loadImageToCanvases(nextImageUrl: string) {
    const maskCanvas = maskCanvasRef.current;
    const colorCanvas = colorCanvasRef.current;
    const lineCanvas = lineCanvasRef.current;

    if (!maskCanvas || !colorCanvas || !lineCanvas) {
      return;
    }

    const image = await loadImage(nextImageUrl);
    const maskContext = maskCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    const colorContext = colorCanvas.getContext("2d");
    const lineContext = lineCanvas.getContext("2d");

    if (!maskContext || !colorContext || !lineContext) {
      return;
    }

    for (const canvas of [maskCanvas, colorCanvas, lineCanvas]) {
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
    }

    maskContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    colorContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    lineContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const scale = Math.min(
      CANVAS_SIZE / image.naturalWidth,
      CANVAS_SIZE / image.naturalHeight,
    );
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (CANVAS_SIZE - width) / 2;
    const y = (CANVAS_SIZE - height) / 2;

    maskContext.fillStyle = "#ffffff";
    maskContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    maskContext.drawImage(image, x, y, width, height);

    const originalImage = maskContext.getImageData(
      0,
      0,
      CANVAS_SIZE,
      CANVAS_SIZE,
    );
    const outlineImage = lineContext.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    const rawBoundaryMask = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);

    for (let index = 0; index < originalImage.data.length; index += 4) {
      const pixelIndex = index / 4;

      if (isOutlinePixel(originalImage.data, index)) {
        rawBoundaryMask[pixelIndex] = 1;
        outlineImage.data[index] = 17;
        outlineImage.data[index + 1] = 24;
        outlineImage.data[index + 2] = 39;
        outlineImage.data[index + 3] = originalImage.data[index + 3];
      }
    }

    boundaryMaskRef.current = dilateBoundaryMask(
      rawBoundaryMask,
      CANVAS_SIZE,
      CANVAS_SIZE,
      OUTLINE_DILATION_RADIUS,
    );
    lineContext.putImageData(outlineImage, 0, 0);
    undoStackRef.current = [];
    setCanUndo(false);
  }

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = lineCanvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height),
    };
  }

  function isOutlinePixel(data: Uint8ClampedArray, index: number) {
    const alpha = data[index + 3];
    const luminance =
      data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;

    return (
      alpha > 20 &&
      ((data[index] < 145 && data[index + 1] < 145 && data[index + 2] < 145) ||
        luminance < 165)
    );
  }

  function dilateBoundaryMask(
    sourceMask: Uint8Array,
    width: number,
    height: number,
    radius: number,
  ) {
    const nextMask = new Uint8Array(sourceMask);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;

        if (!sourceMask[index]) {
          continue;
        }

        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            const nextX = x + offsetX;
            const nextY = y + offsetY;

            if (
              nextX >= 0 &&
              nextY >= 0 &&
              nextX < width &&
              nextY < height
            ) {
              nextMask[nextY * width + nextX] = 1;
            }
          }
        }
      }
    }

    return nextMask;
  }

  function findFillStartPoint(startX: number, startY: number, boundaryMask: Uint8Array) {
    const clampedX = Math.round(Math.min(Math.max(startX, 0), CANVAS_SIZE - 1));
    const clampedY = Math.round(Math.min(Math.max(startY, 0), CANVAS_SIZE - 1));
    const startIndex = clampedY * CANVAS_SIZE + clampedX;

    if (!boundaryMask[startIndex]) {
      return startIndex;
    }

    for (let radius = 1; radius <= TAP_SEARCH_RADIUS; radius += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
            continue;
          }

          const nextX = clampedX + offsetX;
          const nextY = clampedY + offsetY;

          if (
            nextX >= 0 &&
            nextY >= 0 &&
            nextX < CANVAS_SIZE &&
            nextY < CANVAS_SIZE
          ) {
            const nextIndex = nextY * CANVAS_SIZE + nextX;

            if (!boundaryMask[nextIndex]) {
              return nextIndex;
            }
          }
        }
      }
    }

    return null;
  }

  const floodFill = useCallback(
    (startX: number, startY: number, nextFillColor: string) => {
      const maskCanvas = maskCanvasRef.current;
      const colorCanvas = colorCanvasRef.current;
      const boundaryMask = boundaryMaskRef.current;

      if (!maskCanvas || !colorCanvas || !boundaryMask || !imageUrl) {
        return;
      }

      const colorContext = colorCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!colorContext) {
        return;
      }

      if (
        startX < 0 ||
        startY < 0 ||
        startX >= CANVAS_SIZE ||
        startY >= CANVAS_SIZE
      ) {
        return;
      }

      const colorImage = colorContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const startPixelIndex = findFillStartPoint(startX, startY, boundaryMask);

      if (startPixelIndex === null) {
        return;
      }

      undoStackRef.current.push(colorImage);
      setCanUndo(true);

      const fill = hexToRgba(nextFillColor);
      const visited = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
      const stack = new Int32Array(CANVAS_SIZE * CANVAS_SIZE);
      let stackLength = 1;
      stack[0] = startPixelIndex;
      visited[startPixelIndex] = 1;

      while (stackLength > 0) {
        stackLength -= 1;
        const pixelIndex = stack[stackLength];
        const dataIndex = pixelIndex * 4;

        if (boundaryMask[pixelIndex]) {
          continue;
        }

        colorImage.data[dataIndex] = fill.r;
        colorImage.data[dataIndex + 1] = fill.g;
        colorImage.data[dataIndex + 2] = fill.b;
        colorImage.data[dataIndex + 3] = fill.a;

        const x = pixelIndex % CANVAS_SIZE;
        const left = pixelIndex - 1;
        const right = pixelIndex + 1;
        const up = pixelIndex - CANVAS_SIZE;
        const down = pixelIndex + CANVAS_SIZE;

        if (x > 0 && !visited[left] && !boundaryMask[left]) {
          visited[left] = 1;
          stack[stackLength] = left;
          stackLength += 1;
        }

        if (x < CANVAS_SIZE - 1 && !visited[right] && !boundaryMask[right]) {
          visited[right] = 1;
          stack[stackLength] = right;
          stackLength += 1;
        }

        if (up >= 0 && !visited[up] && !boundaryMask[up]) {
          visited[up] = 1;
          stack[stackLength] = up;
          stackLength += 1;
        }

        if (down < visited.length && !visited[down] && !boundaryMask[down]) {
          visited[down] = 1;
          stack[stackLength] = down;
          stackLength += 1;
        }
      }

      colorContext.putImageData(colorImage, 0, 0);
    },
    [imageUrl],
  );

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    floodFill(point.x, point.y, fillColor);
  }

  function undoFill() {
    const colorCanvas = colorCanvasRef.current;
    const colorContext = colorCanvas?.getContext("2d");
    const snapshot = undoStackRef.current.pop();

    if (!colorCanvas || !colorContext || !snapshot) {
      return;
    }

    colorContext.putImageData(snapshot, 0, 0);
    setCanUndo(undoStackRef.current.length > 0);
  }

  function clearColors() {
    const colorCanvas = colorCanvasRef.current;
    const colorContext = colorCanvas?.getContext("2d");

    if (!colorCanvas || !colorContext) {
      return;
    }

    const current = colorContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    undoStackRef.current.push(current);
    setCanUndo(true);
    colorContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function downloadColoringPage() {
    const colorCanvas = colorCanvasRef.current;
    const lineCanvas = lineCanvasRef.current;

    if (!colorCanvas || !lineCanvas || !imageUrl) {
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_SIZE;
    exportCanvas.height = CANVAS_SIZE;
    const context = exportCanvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.drawImage(colorCanvas, 0, 0);
    context.drawImage(lineCanvas, 0, 0);

    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `${selectedPokemon.name.toLowerCase()}-${selectedPose}-coloring-page.png`;
    link.click();
  }

  function selectPokemon(pokemon: PokemonOption) {
    setSelectedPokemon(pokemon);
    clearAllCanvases();
    setStatus(`Selected ${pokemon.name}`);
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)] max-[980px]:grid-cols-1">
        <aside className="border-r border-slate-200 bg-white p-4 max-[980px]:border-b max-[980px]:border-r-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">Canvas Camp</h1>
              <p className="text-sm font-bold text-slate-500">
                {POKEMON_COUNT} Pokemon coloring tree
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-lg bg-slate-950 text-white">
              <PaintBucket aria-hidden="true" size={21} />
            </span>
          </div>

          <label className="mb-4 grid gap-2 text-xs font-black uppercase text-slate-500">
            Model
            <select
              className="h-11 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none transition focus:border-slate-950"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-4 grid gap-2">
            <p className="text-xs font-black uppercase text-slate-500">Pose</p>
            <div className="grid grid-cols-2 gap-2">
              {POSE_OPTIONS.map((pose) => (
                <button
                  key={pose.id}
                  className={`h-10 rounded-lg border-2 px-3 text-sm font-black transition ${
                    selectedPose === pose.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  type="button"
                  onClick={() => {
                    setSelectedPose(pose.id);
                    clearAllCanvases();
                    setStatus(
                      `Selected ${selectedPokemon.name} ${pose.label.toLowerCase()}`,
                    );
                  }}
                >
                  {pose.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            {POKEMON_TYPE_GROUPS.map((group) => (
              <section key={group.id} className="rounded-lg border border-slate-200">
                <button
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  type="button"
                  onClick={() => setActiveType(group.id)}
                >
                  <span className="flex items-center gap-2 text-sm font-black">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.label}
                  </span>
                  <span className="font-mono text-xs font-black text-slate-400">
                    {group.pokemon.length}
                  </span>
                </button>

                {activeType === group.id ? (
                  <div className="grid gap-1 border-t border-slate-100 p-2">
                    {group.pokemon.map((pokemon) => (
                      <button
                        key={`${group.id}-${pokemon.name}`}
                        className={`flex h-10 items-center justify-between rounded-md px-3 text-left text-sm font-black transition ${
                          selectedPokemon.name === pokemon.name &&
                          selectedPokemon.type === pokemon.type
                            ? "bg-slate-950 text-white"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                        type="button"
                        onClick={() => selectPokemon(pokemon)}
                      >
                        {pokemon.name}
                        <Sparkles aria-hidden="true" size={16} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">
                {selectedPokemon.type}
              </p>
              <h2 className="text-xl font-black">{selectedPokemon.name}</h2>
              <p className="text-sm font-bold text-slate-500">
                {POSE_OPTIONS.find((pose) => pose.id === selectedPose)?.label}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  aria-label={`Use color ${swatch}`}
                  className={`size-9 rounded-lg border-2 ${
                    fillColor === swatch ? "border-slate-950" : "border-white"
                  } shadow-sm ring-1 ring-slate-200`}
                  style={{ backgroundColor: swatch }}
                  type="button"
                  onClick={() => setFillColor(swatch)}
                />
              ))}
              <input
                aria-label="Custom color"
                className="size-10 rounded-lg border-2 border-slate-200 bg-white p-1"
                type="color"
                value={fillColor}
                onChange={(event) => setFillColor(event.target.value)}
              />
              <button
                aria-label="Undo"
                className="grid size-10 place-items-center rounded-lg border-2 border-slate-200 bg-white text-slate-950 disabled:opacity-40"
                disabled={!canUndo}
                type="button"
                onClick={undoFill}
              >
                <Undo2 aria-hidden="true" size={18} />
              </button>
              <button
                aria-label="Clear colors"
                className="grid size-10 place-items-center rounded-lg border-2 border-slate-200 bg-white text-slate-950 disabled:opacity-40"
                disabled={!imageUrl}
                type="button"
                onClick={clearColors}
              >
                <Eraser aria-hidden="true" size={18} />
              </button>
              <button
                aria-label="Generate image"
                className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-40"
                disabled={isGenerating}
                type="button"
                onClick={() => void generateColoringPagePng(selectedPokemon.name)}
              >
                {isGenerating ? (
                  <Loader2 aria-hidden="true" className="animate-spin" size={18} />
                ) : (
                  <Sparkles aria-hidden="true" size={18} />
                )}
                Generate
              </button>
              <button
                aria-label="Download PNG"
                className="grid size-10 place-items-center rounded-lg bg-slate-950 text-white disabled:opacity-40"
                disabled={!imageUrl}
                type="button"
                onClick={downloadColoringPage}
              >
                <Download aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-5">
            <div className="w-full max-w-[min(76vh,900px)]">
              <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-slate-950 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <canvas
                  ref={maskCanvasRef}
                  className="hidden"
                  height={CANVAS_SIZE}
                  width={CANVAS_SIZE}
                />
                <canvas
                  ref={colorCanvasRef}
                  className="absolute inset-0 size-full"
                  height={CANVAS_SIZE}
                  width={CANVAS_SIZE}
                />
                <canvas
                  ref={lineCanvasRef}
                  aria-label="Pokemon coloring canvas"
                  className="absolute inset-0 size-full cursor-crosshair touch-none"
                  height={CANVAS_SIZE}
                  width={CANVAS_SIZE}
                  onPointerDown={handleCanvasPointerDown}
                />
                {!imageUrl ? (
                  <div className="absolute inset-0 grid place-items-center bg-white text-center">
                    <div className="grid gap-3">
                      <ImageIcon
                        aria-hidden="true"
                        className="mx-auto text-slate-300"
                        size={56}
                      />
                      <button
                        className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                        disabled={isGenerating}
                        type="button"
                        onClick={() =>
                          void generateColoringPagePng(selectedPokemon.name)
                        }
                      >
                        {isGenerating
                          ? "Generating"
                          : `Generate ${selectedPokemon.name} ${
                              POSE_OPTIONS.find((pose) => pose.id === selectedPose)
                                ?.label
                            }`}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm font-black text-slate-500">
                <span>{status}</span>
                <span className="font-mono">{CANVAS_SIZE} PNG</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
