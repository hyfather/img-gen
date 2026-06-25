"use client";

import {
  Download,
  Eraser,
  Images,
  Image as ImageIcon,
  Layers,
  Loader2,
  PaintBucket,
  Plus,
  Sparkles,
  Undo2,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  POKEMON_COUNT,
  POKEMON_TYPE_GROUPS,
  type PokemonOption,
  type PokemonType,
} from "@/lib/pokemon";
import type { CanvasBackground } from "@/lib/backgrounds";

type GenerateResponse = {
  image?: GeneratedImage;
  imageUrl?: string;
  error?: string;
};

type ImagesResponse = {
  images?: GeneratedImage[];
  error?: string;
};

type GeneratedImage = {
  downloadUrl: string;
  pathname: string;
  renderUrl: string;
  source: "blob" | "local";
  uploadedAt: string;
  url: string;
};

type CanvasEditorProps = {
  backgrounds: CanvasBackground[];
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

const CARD_BORDER_SWATCHES = ["#facc15", "#f97316", "#38bdf8", "#22c55e", "#a78bfa", "#f8fafc", "#0f172a"];
const TYPE_ICON_STYLES: Record<PokemonType, { label: string; glyph: string; color: string; textColor?: string }> = {
  normal: { label: "Normal", glyph: "★", color: "#c9c3b8", textColor: "#1f2937" },
  fire: { label: "Fire", glyph: "♨", color: "#f97316" },
  water: { label: "Water", glyph: "●", color: "#38bdf8" },
  electric: { label: "Electric", glyph: "⚡", color: "#facc15", textColor: "#111827" },
  grass: { label: "Grass", glyph: "✿", color: "#22c55e" },
  ice: { label: "Ice", glyph: "❄", color: "#67e8f9", textColor: "#0f172a" },
  fighting: { label: "Fighting", glyph: "✊", color: "#dc2626" },
  poison: { label: "Poison", glyph: "☠", color: "#a855f7" },
  ground: { label: "Ground", glyph: "◆", color: "#d97706" },
  flying: { label: "Flying", glyph: "✦", color: "#60a5fa" },
  psychic: { label: "Psychic", glyph: "☯", color: "#ec4899" },
  bug: { label: "Bug", glyph: "✣", color: "#84cc16", textColor: "#172554" },
  rock: { label: "Rock", glyph: "⬟", color: "#78716c" },
  ghost: { label: "Ghost", glyph: "◉", color: "#7c3aed" },
  dragon: { label: "Dragon", glyph: "✹", color: "#8b5cf6" },
  dark: { label: "Dark", glyph: "☾", color: "#44403c" },
  steel: { label: "Steel", glyph: "⬢", color: "#94a3b8", textColor: "#0f172a" },
  fairy: { label: "Fairy", glyph: "✧", color: "#fb7185" },
};
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
  if (src.startsWith("http")) {
    image.crossOrigin = "anonymous";
  }

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

async function readImagesResponse(response: Response): Promise<ImagesResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      error: `Server returned an empty response (${response.status}).`,
    };
  }

  try {
    return JSON.parse(text) as ImagesResponse;
  } catch {
    return {
      error: text.slice(0, 240) || "Server returned a non-JSON response.",
    };
  }
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

function findFillStartPoint(
  startX: number,
  startY: number,
  boundaryMask: Uint8Array,
) {
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

export function CanvasEditor({ backgrounds }: CanvasEditorProps) {
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
  const [existingImages, setExistingImages] = useState<GeneratedImage[]>([]);
  const [status, setStatus] = useState("Choose a Pokemon");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState("");
  const [selectedBackground, setSelectedBackground] = useState(backgrounds[0]?.src ?? "");
  const [backgroundPrompt, setBackgroundPrompt] = useState("sunny meadow training arena");
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [cardHp, setCardHp] = useState(340);
  const [cardType, setCardType] = useState<PokemonType>(selectedPokemon.type);
  const [cardBorderColor, setCardBorderColor] = useState("#374151");
  const [cardStage, setCardStage] = useState("Stage 1");
  const [evolvesFrom, setEvolvesFrom] = useState("Riolu");
  const [isExCard, setIsExCard] = useState(true);
  const [attackOneName, setAttackOneName] = useState("Aura Jab");
  const [attackOneDamage, setAttackOneDamage] = useState("130");
  const [attackTwoName, setAttackTwoName] = useState("Mega Brave");
  const [attackTwoDamage, setAttackTwoDamage] = useState("270");
  const [weakness, setWeakness] = useState("×2");
  const [resistance, setResistance] = useState("-30");
  const [retreatCost, setRetreatCost] = useState("★★");
  const [cardNumber, setCardNumber] = useState("179/132");
  const cardTypeStyle = TYPE_ICON_STYLES[cardType];
  const selectedPoseLabel =
    POSE_OPTIONS.find((pose) => pose.id === selectedPose)?.label ??
    POSE_OPTIONS[0].label;
  const hasExistingImages = existingImages.length > 0;

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
    setCardImageUrl("");
  }

  const loadImageToCanvases = useCallback(async (nextImageUrl: string) => {
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadExistingImages() {
      setIsLoadingImages(true);
      setExistingImages([]);
      setStatus(
        `Looking for ${selectedPokemon.name} ${selectedPoseLabel.toLowerCase()}`,
      );

      try {
        const params = new URLSearchParams({
          pokemonName: selectedPokemon.name,
          pose: selectedPose,
        });
        const response = await fetch(`/api/coloring-page?${params}`, {
          signal: controller.signal,
        });
        const result = await readImagesResponse(response);

        if (!response.ok) {
          throw new Error(result.error || "Could not load saved images.");
        }

        if (controller.signal.aborted) {
          return;
        }

        const images = result.images ?? [];
        setExistingImages(images);

        if (images[0]) {
          await loadImageToCanvases(images[0].renderUrl);

          if (controller.signal.aborted) {
            return;
          }

          setImageUrl(images[0].renderUrl);
          setCardImageUrl("");
          setStatus(
            `Showing saved ${selectedPokemon.name} ${selectedPoseLabel.toLowerCase()}`,
          );
        } else {
          setStatus(
            `Selected ${selectedPokemon.name} ${selectedPoseLabel.toLowerCase()}`,
          );
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setStatus(error instanceof Error ? error.message : "Could not load saved images");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingImages(false);
        }
      }
    }

    void loadExistingImages();

    return () => controller.abort();
  }, [loadImageToCanvases, selectedPokemon.name, selectedPose, selectedPoseLabel]);

  async function generateColoringPagePng(pokemonName: string) {
    const poseLabel = selectedPoseLabel;

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
      setCardImageUrl("");
      if (result.image) {
        setExistingImages((images) => [
          result.image as GeneratedImage,
          ...images.filter((image) => image.pathname !== result.image?.pathname),
        ]);
      }
      setStatus(`${pokemonName} ${poseLabel.toLowerCase()} ready`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
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

  function composeColoredPokemon(includeWhiteBackground = false) {
    const colorCanvas = colorCanvasRef.current;
    const lineCanvas = lineCanvasRef.current;

    if (!colorCanvas || !lineCanvas || !imageUrl) {
      return "";
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_SIZE;
    exportCanvas.height = CANVAS_SIZE;
    const context = exportCanvas.getContext("2d");

    if (!context) {
      return "";
    }

    if (includeWhiteBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    context.drawImage(colorCanvas, 0, 0);
    context.drawImage(lineCanvas, 0, 0);

    return exportCanvas.toDataURL("image/png");
  }

  function placeOnCard() {
    const composedImage = composeColoredPokemon();

    if (!composedImage) {
      return;
    }

    setCardImageUrl(composedImage);
    setStatus(`${selectedPokemon.name} placed on card`);
  }

  async function generateBackground() {
    setIsGeneratingBackground(true);
    setStatus("Generating card background");

    try {
      const response = await fetch("/api/background-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: backgroundPrompt, model }),
      });
      const result = await readGenerateResponse(response);

      if (!response.ok || !result.imageUrl) {
        throw new Error(result.error || "Could not generate background.");
      }

      setSelectedBackground(result.imageUrl);
      setStatus("Generated background selected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Background generation failed");
    } finally {
      setIsGeneratingBackground(false);
    }
  }

  function downloadColoringPage() {
    const coloringPageImage = composeColoredPokemon(true);

    if (!coloringPageImage) {
      return;
    }

    const link = document.createElement("a");
    link.href = coloringPageImage;
    link.download = `${selectedPokemon.name.toLowerCase()}-${selectedPose}-coloring-page.png`;
    link.click();
  }

  function selectPokemon(pokemon: PokemonOption) {
    setSelectedPokemon(pokemon);
    setCardType(pokemon.type);
    setEvolvesFrom(pokemon.name === "Pikachu" ? "Pichu" : "");
    clearAllCanvases();
    setStatus(`Selected ${pokemon.name}`);
  }

  async function selectExistingImage(image: GeneratedImage) {
    setStatus(`Loading saved ${selectedPokemon.name}`);

    try {
      await loadImageToCanvases(image.renderUrl);
      setImageUrl(image.renderUrl);
      setCardImageUrl("");
      setStatus(
        `Showing saved ${selectedPokemon.name} ${selectedPoseLabel.toLowerCase()}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load image");
    }
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#f7f9fc] text-slate-950 overscroll-none">
      <div className="grid h-[100dvh] min-h-0 grid-cols-[280px_minmax(0,1fr)_320px] max-[980px]:grid-cols-[250px_minmax(0,1fr)] max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_minmax(0,1fr)_auto]">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white p-3 max-[720px]:max-h-[46dvh] max-[720px]:border-b max-[720px]:border-r-0">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black">Pokemon Camp</h1>
              <p className="text-xs font-bold text-slate-500">
                {POKEMON_COUNT} Pokemon coloring tree
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
              <PaintBucket aria-hidden="true" size={20} />
            </span>
          </div>

          <label className="mb-3 grid shrink-0 gap-2 text-xs font-black uppercase text-slate-500">
            Model
            <select
              className="h-10 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm normal-case text-slate-950"
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

          <div className="mb-3 grid shrink-0 gap-2">
            <p className="text-xs font-black uppercase text-slate-500">Pose</p>
            <div className="grid grid-cols-2 gap-2">
              {POSE_OPTIONS.map((pose) => (
                <button
                  key={pose.id}
                  className={`h-10 rounded-lg border-2 px-2 text-sm font-black transition ${
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="grid gap-2 pb-3">
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
          </div>
        </aside>

        <section className="flex h-[100dvh] min-h-0 flex-col overflow-hidden max-[720px]:h-full">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <div className="min-w-32">
              <p className="text-xs font-black uppercase text-slate-500">
                {selectedPokemon.type}
              </p>
              <h2 className="text-lg font-black leading-tight">{selectedPokemon.name}</h2>
              <p className="text-xs font-bold text-slate-500">
                {POSE_OPTIONS.find((pose) => pose.id === selectedPose)?.label}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  aria-label={`Use color ${swatch}`}
                  className={`size-10 rounded-lg border-2 ${
                    fillColor === swatch ? "border-slate-950" : "border-white"
                  } shadow-sm ring-1 ring-slate-200`}
                  style={{ backgroundColor: swatch }}
                  type="button"
                  onClick={() => setFillColor(swatch)}
                />
              ))}
              <input
                aria-label="Custom color"
                className="size-11 rounded-lg border-2 border-slate-200 bg-white p-1"
                type="color"
                value={fillColor}
                onChange={(event) => setFillColor(event.target.value)}
              />
              <button
                aria-label="Undo"
                className="grid size-11 place-items-center rounded-lg border-2 border-slate-200 bg-white text-slate-950 disabled:opacity-40"
                disabled={!canUndo}
                type="button"
                onClick={undoFill}
              >
                <Undo2 aria-hidden="true" size={18} />
              </button>
              <button
                aria-label="Clear colors"
                className="grid size-11 place-items-center rounded-lg border-2 border-slate-200 bg-white text-slate-950 disabled:opacity-40"
                disabled={!imageUrl}
                type="button"
                onClick={clearColors}
              >
                <Eraser aria-hidden="true" size={18} />
              </button>
              <button
                aria-label={hasExistingImages ? "Generate another image" : "Generate image"}
                className={
                  hasExistingImages
                    ? "grid size-11 place-items-center rounded-lg border-2 border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-40"
                    : "flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-40"
                }
                disabled={isGenerating}
                title={hasExistingImages ? "Generate another" : "Generate"}
                type="button"
                onClick={() => void generateColoringPagePng(selectedPokemon.name)}
              >
                {isGenerating ? (
                  <Loader2 aria-hidden="true" className="animate-spin" size={18} />
                ) : (
                  <Sparkles aria-hidden="true" size={18} />
                )}
                {hasExistingImages ? null : "Generate"}
              </button>
              <button
                aria-label="Place on card"
                className="flex h-11 items-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
                disabled={!imageUrl}
                type="button"
                onClick={placeOnCard}
              >
                <Layers aria-hidden="true" size={18} />
                Place on card
              </button>
              <button
                aria-label="Download PNG"
                className="grid size-11 place-items-center rounded-lg bg-slate-950 text-white disabled:opacity-40"
                disabled={!imageUrl}
                type="button"
                onClick={downloadColoringPage}
              >
                <Download aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          {hasExistingImages ? (
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="hidden items-center gap-2 text-xs font-black uppercase text-slate-500 min-[560px]:flex">
                <Images aria-hidden="true" size={16} />
                Saved
              </div>
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain">
                {existingImages.map((image, index) => (
                  <button
                    key={image.pathname}
                    aria-label={`Open saved image ${index + 1}`}
                    className={`relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-white transition ${
                      image.renderUrl === imageUrl
                        ? "border-slate-950"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                    type="button"
                    onClick={() => void selectExistingImage(image)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="size-full object-contain"
                      src={image.renderUrl}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
            <div
              className="w-full"
              style={{
                maxWidth: hasExistingImages
                  ? "min(100%, calc(100dvh - 250px), 860px)"
                  : "min(100%, calc(100dvh - 150px), 860px)",
              }}
            >
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
                      {isLoadingImages ? (
                        <Loader2
                          aria-hidden="true"
                          className="mx-auto animate-spin text-slate-300"
                          size={56}
                        />
                      ) : (
                        <ImageIcon
                          aria-hidden="true"
                          className="mx-auto text-slate-300"
                          size={56}
                        />
                      )}
                      {isLoadingImages ? null : (
                        <button
                          className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                          disabled={isGenerating}
                          type="button"
                          onClick={() =>
                            void generateColoringPagePng(selectedPokemon.name)
                          }
                        >
                          {isGenerating ? (
                            <Loader2
                              aria-hidden="true"
                              className="animate-spin"
                              size={18}
                            />
                          ) : (
                            <Plus aria-hidden="true" size={18} />
                          )}
                          {isGenerating
                            ? "Generating"
                            : `Generate ${selectedPokemon.name} ${selectedPoseLabel}`}
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
                <span className="truncate">{status}</span>
                <span className="font-mono">{CANVAS_SIZE} PNG</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 max-[980px]:col-span-2 max-[980px]:border-l-0 max-[980px]:border-t max-[720px]:col-span-1">
          <div>
            <h2 className="text-lg font-black">Pokemon card studio</h2>
            <p className="text-xs font-bold text-slate-500">Place the colored Pokemon on a card, choose a scene, and tune battle details.</p>
          </div>

          <div
            className="mx-auto w-full max-w-[380px] rounded-[28px] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
            style={{ backgroundColor: cardBorderColor }}
          >
            <div className="relative aspect-[63/88] overflow-hidden rounded-[22px] border-2 border-white/50 bg-slate-800 p-2">
              <div className="absolute inset-1 rounded-[20px] border-4 border-slate-300/80" />
              <div className="relative size-full overflow-hidden rounded-[18px] border-[3px] border-slate-950 bg-slate-100">
                {selectedBackground ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Selected card background"
                    className="absolute inset-0 size-full object-cover"
                    src={selectedBackground}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-slate-950/30" />
                <div className="absolute -left-16 top-28 h-9 w-[135%] rotate-[-27deg] bg-cyan-400/90 shadow-[0_0_0_3px_rgba(14,165,233,0.25)]" />
                <div className="absolute -right-12 top-52 h-9 w-[125%] rotate-[29deg] bg-red-500/90 shadow-[0_0_0_3px_rgba(239,68,68,0.25)]" />
                <div className="absolute -left-10 bottom-36 h-8 w-[130%] rotate-[18deg] bg-cyan-300/75" />

                <div className="absolute inset-x-3 top-3 z-20 rounded-[18px] border-[3px] border-slate-950 bg-white/88 p-2 shadow-[0_3px_12px_rgba(15,23,42,0.22)] backdrop-blur-sm">
                  <div className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-start gap-2">
                    <div className="grid gap-1">
                      <span className="rounded-full border border-slate-400 bg-white px-1 py-0.5 text-center text-[10px] font-black uppercase italic leading-tight text-slate-600 shadow">
                        {cardStage}
                      </span>
                      <div className="grid size-12 place-items-center overflow-hidden rounded-full border-4 border-slate-300 bg-white shadow-inner">
                        {cardImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`${selectedPokemon.name} evolution portrait`}
                            className="size-full object-contain p-1"
                            src={cardImageUrl}
                          />
                        ) : (
                          <span className="text-lg font-black">?</span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[26px] font-black leading-none tracking-tight text-yellow-300 [text-shadow:_1px_1px_0_rgb(15_23_42),_-1px_1px_0_rgb(15_23_42),_1px_-1px_0_rgb(15_23_42),_-1px_-1px_0_rgb(15_23_42)]">
                        {selectedPokemon.name}
                        {isExCard ? <span className="ml-1 text-[18px] italic text-lime-300">ex</span> : null}
                      </h3>
                      <p className="mt-1 text-[11px] font-black italic leading-tight text-slate-600">
                        Evolves from {evolvesFrom || selectedPokemon.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black uppercase text-slate-600">HP</span>
                      <span className="text-[32px] font-black leading-none text-slate-950">{cardHp}</span>
                      <span
                        aria-label={`${cardTypeStyle.label} energy`}
                        className="grid size-9 place-items-center rounded-full border-2 border-white text-lg font-black shadow-[inset_0_2px_5px_rgba(255,255,255,0.65),0_2px_6px_rgba(15,23,42,0.25)]"
                        style={{
                          backgroundColor: cardTypeStyle.color,
                          color: cardTypeStyle.textColor ?? "#ffffff",
                        }}
                        title={`${cardTypeStyle.label} energy`}
                      >
                        {cardTypeStyle.glyph}
                      </span>
                    </div>
                  </div>
                  {isExCard ? (
                    <div className="absolute -right-2 top-12 rounded-full bg-pink-200 px-3 py-1 text-[11px] font-black italic text-pink-700 shadow">
                      Mega-Evolved Pokemon ex
                    </div>
                  ) : null}
                </div>

                {cardImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Colored Pokemon on card"
                    className="absolute inset-x-0 top-[21%] z-10 mx-auto h-[38%] w-auto object-contain drop-shadow-[0_18px_10px_rgba(15,23,42,0.45)]"
                    src={cardImageUrl}
                  />
                ) : (
                  <div className="absolute inset-x-8 top-[27%] z-10 text-center text-xl font-black text-slate-600/80">
                    Color a Pokemon, then place it here.
                  </div>
                )}

                <div className="absolute inset-x-4 bottom-[118px] z-20 grid gap-1.5 text-white [text-shadow:_1px_1px_2px_rgb(15_23_42)]">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                    <div className="flex -space-x-1">
                      {[0, 1].map((cost) => (
                        <span
                          key={`attack-one-${cost}`}
                          className="grid size-6 place-items-center rounded-full border border-white text-xs font-black shadow"
                          style={{
                            backgroundColor: cardTypeStyle.color,
                            color: cardTypeStyle.textColor ?? "#ffffff",
                          }}
                        >
                          {cardTypeStyle.glyph}
                        </span>
                      ))}
                    </div>
                    <span className="text-[25px] font-black leading-none">{attackOneName}</span>
                    <span className="text-[28px] font-black leading-none">{attackOneDamage}</span>
                  </div>
                  <p className="max-w-[94%] text-[13px] font-black leading-tight">
                    Attach up to 3 Basic Energy cards from your discard pile to your Benched Pokemon in any way you like.
                  </p>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pt-1">
                    <div className="flex -space-x-1">
                      {[0, 1, 2].map((cost) => (
                        <span
                          key={`attack-two-${cost}`}
                          className="grid size-6 place-items-center rounded-full border border-white text-xs font-black shadow"
                          style={{
                            backgroundColor: cost === 2 ? "#e5e7eb" : cardTypeStyle.color,
                            color: cost === 2 ? "#111827" : cardTypeStyle.textColor ?? "#ffffff",
                          }}
                        >
                          {cost === 2 ? "★" : cardTypeStyle.glyph}
                        </span>
                      ))}
                    </div>
                    <span className="text-[25px] font-black leading-none">{attackTwoName}</span>
                    <span className="text-[28px] font-black leading-none">{attackTwoDamage}</span>
                  </div>
                  <p className="max-w-[94%] text-[13px] font-black leading-tight">
                    During your next turn, this Pokemon can&apos;t use {attackTwoName}.
                  </p>
                </div>

                <div className="absolute inset-x-3 bottom-[78px] z-20 grid grid-cols-3 gap-1 border-y border-white/80 bg-white/70 px-1 py-1 text-center text-[9px] font-black uppercase text-slate-700">
                  <span>Weakness {weakness}</span>
                  <span>Resistance {resistance}</span>
                  <span>Retreat {retreatCost}</span>
                </div>

                {isExCard ? (
                  <div className="absolute inset-x-8 bottom-7 z-30 rounded-full border-2 border-slate-900 bg-gradient-to-r from-yellow-300 via-white to-yellow-300 px-2 py-1 text-center text-[11px] font-black leading-tight text-slate-900 shadow">
                    Pokemon ex rule: when this Pokemon ex is Knocked Out, your opponent takes 2 Prize cards.
                  </div>
                ) : null}

                <div className="absolute inset-x-3 bottom-1 z-20 flex items-center justify-between bg-white/80 px-2 py-0.5 text-[10px] font-black text-slate-700">
                  <span>©2026 Canvas Camp</span>
                  <span>{cardNumber} ★</span>
                </div>
              </div>
            </div>
          </div>

          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            HP
            <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" min="10" max="340" step="10" type="number" value={cardHp} onChange={(event) => setCardHp(Number(event.target.value) || 10)} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Stage
              <select className="h-10 rounded-lg border-2 border-slate-200 bg-white px-3 text-slate-950" value={cardStage} onChange={(event) => setCardStage(event.target.value)}>
                <option>Basic</option>
                <option>Stage 1</option>
                <option>Stage 2</option>
                <option>Mega</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Evolves from
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 normal-case text-slate-950" value={evolvesFrom} onChange={(event) => setEvolvesFrom(event.target.value)} />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs font-black uppercase text-slate-500">
            <input checked={isExCard} type="checkbox" onChange={(event) => setIsExCard(event.target.checked)} />
            Show ex styling and rule box
          </label>

          <div className="grid grid-cols-[1fr_72px] gap-2">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Attack 1
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 normal-case text-slate-950" value={attackOneName} onChange={(event) => setAttackOneName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Damage
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" value={attackOneDamage} onChange={(event) => setAttackOneDamage(event.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-[1fr_72px] gap-2">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Attack 2
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 normal-case text-slate-950" value={attackTwoName} onChange={(event) => setAttackTwoName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Damage
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" value={attackTwoDamage} onChange={(event) => setAttackTwoDamage(event.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Weakness
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" value={weakness} onChange={(event) => setWeakness(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Resist
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" value={resistance} onChange={(event) => setResistance(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Retreat
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" value={retreatCost} onChange={(event) => setRetreatCost(event.target.value)} />
            </label>
          </div>

          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            Card number
            <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-slate-950" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} />
          </label>

          <div className="grid gap-2 text-xs font-black uppercase text-slate-500">
            Border
            <div className="flex flex-wrap items-center gap-2">
              {CARD_BORDER_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  aria-label={`Use card border ${swatch}`}
                  className={`size-9 rounded-lg border-2 shadow-sm ${
                    cardBorderColor === swatch ? "border-slate-950" : "border-white"
                  }`}
                  style={{ backgroundColor: swatch }}
                  type="button"
                  onClick={() => setCardBorderColor(swatch)}
                />
              ))}
              <input
                aria-label="Custom card border"
                className="size-10 rounded-lg border-2 border-slate-200 bg-white p-1"
                type="color"
                value={cardBorderColor}
                onChange={(event) => setCardBorderColor(event.target.value)}
              />
            </div>
          </div>

          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            Type icon
            <select className="h-10 rounded-lg border-2 border-slate-200 bg-white px-3 text-slate-950" value={cardType} onChange={(event) => setCardType(event.target.value as PokemonType)}>
              {POKEMON_TYPE_GROUPS.map((group) => (
                <option key={group.id} value={group.id}>{group.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
            Default backgrounds
            <select className="h-10 rounded-lg border-2 border-slate-200 bg-white px-3 text-slate-950" value={selectedBackground} onChange={(event) => setSelectedBackground(event.target.value)}>
              <option value="">Blank studio</option>
              {backgrounds.map((background) => (
                <option key={background.src} value={background.src}>{background.name}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-2 rounded-lg border border-slate-200 p-2">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
              Generate background
              <input className="h-10 rounded-lg border-2 border-slate-200 px-3 text-sm normal-case text-slate-950" value={backgroundPrompt} onChange={(event) => setBackgroundPrompt(event.target.value)} />
            </label>
            <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white disabled:opacity-40" disabled={isGeneratingBackground || !backgroundPrompt.trim()} type="button" onClick={() => void generateBackground()}>
              {isGeneratingBackground ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Sparkles aria-hidden="true" size={16} />}
              Generate scene
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
