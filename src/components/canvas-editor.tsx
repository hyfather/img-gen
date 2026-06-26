"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Images,
  Image as ImageIcon,
  Layers,
  Loader2,
  PaintBucket,
  Palette,
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
  card?: MintedCard;
  image?: GeneratedImage;
  imageUrl?: string;
  error?: string;
};

type MintedCard = {
  downloadUrl: string;
  pathname: string;
  pokemonName: string;
  renderUrl: string;
  source: "blob" | "local";
  uploadedAt: string;
  url: string;
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

type PaintOption = {
  id: string;
  label: string;
  color: string;
  kind?:
    | "solid"
    | "premium-gold"
    | "premium-silver"
    | "holo-rainbow"
    | "pearl-foil"
    | "shadow-foil";
  rarity?: "rare" | "ultra-rare";
};

type WizardStepId =
  | "pokemon"
  | "pose"
  | "image"
  | "color"
  | "card"
  | "mint";

type WizardStep = {
  id: WizardStepId;
  label: string;
  eyebrow: string;
  title: string;
  caption: string;
};

type CardRarityOption = {
  id: string;
  label: string;
  symbol: string;
  accent: string;
};

type CardCopyResponse = {
  attackOneName?: string;
  attackOneDamage?: string;
  attackTwoName?: string;
  attackTwoDamage?: string;
  weakness?: string;
  resistance?: string;
  retreatCost?: string;
  cardStage?: string;
  evolvesFrom?: string;
  isExCard?: boolean;
  cardNumber?: string;
  error?: string;
};

const CANVAS_SIZE = 1024;
const OUTLINE_DILATION_RADIUS = 2;
const TAP_SEARCH_RADIUS = 12;
const DEFAULT_MODEL = "google/gemini-2.5-flash-image";
const MODEL_OPTIONS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];
const COLOR_PALETTES: { label: string; colors: PaintOption[] }[] = [
  {
    label: "Partner Sparks",
    colors: [
      { id: "pikachu-zap", label: "Pikachu zap", color: "#F8D84A" },
      { id: "eevee-ruff", label: "Eevee ruff", color: "#B9824B" },
      { id: "jigglypuff-blush", label: "Jigglypuff blush", color: "#F2A7C8" },
      { id: "meowth-coin", label: "Meowth coin", color: "#D6A94D" },
      { id: "psyduck-cream", label: "Psyduck cream", color: "#F6D875" },
      { id: "snorlax-teal", label: "Snorlax teal", color: "#2D8EA0" },
      { id: "lapras-shell", label: "Lapras shell", color: "#7EC9E6" },
      { id: "bulba-sprout", label: "Bulba sprout", color: "#68B96E" },
    ],
  },
  {
    label: "Starter Trails",
    colors: [
      { id: "ember-tail", label: "Ember tail", color: "#E85F3A" },
      { id: "charizard-flame", label: "Charizard flame", color: "#F28B34" },
      { id: "squirtle-splash", label: "Squirtle splash", color: "#53A9E8" },
      { id: "blastoise-cannon", label: "Blastoise cannon", color: "#2F6FBB" },
      { id: "vine-whip", label: "Vine whip", color: "#4FAF5E" },
      { id: "venusaur-leaf", label: "Venusaur leaf", color: "#2E7D52" },
      { id: "chikorita-mint", label: "Chikorita mint", color: "#A6D96F" },
      { id: "mudkip-blue", label: "Mudkip blue", color: "#5CA8D8" },
    ],
  },
  {
    label: "Energy Badges",
    colors: [
      { id: "thunder-stone", label: "Thunder stone", color: "#FACC15" },
      { id: "fire-stone", label: "Fire stone", color: "#EF4444" },
      { id: "water-stone", label: "Water stone", color: "#38BDF8" },
      { id: "leaf-stone", label: "Leaf stone", color: "#22C55E" },
      { id: "ice-crystal", label: "Ice crystal", color: "#A5F3FC" },
      { id: "psychic-glow", label: "Psychic glow", color: "#D946EF" },
      { id: "fairy-ribbon", label: "Fairy ribbon", color: "#FB7185" },
      { id: "dragon-scale", label: "Dragon scale", color: "#7C3AED" },
    ],
  },
  {
    label: "Legend Tones",
    colors: [
      { id: "mewtwo-aura", label: "Mewtwo aura", color: "#8B5CF6" },
      { id: "mew-bubble", label: "Mew bubble", color: "#F0A6D8" },
      { id: "lugia-silver", label: "Lugia silver", color: "#CBD5E1" },
      { id: "ho-oh-plume", label: "Ho-Oh plume", color: "#F97316" },
      { id: "rayquaza-jade", label: "Rayquaza jade", color: "#15803D" },
      { id: "giratina-shadow", label: "Giratina shadow", color: "#4C1D95" },
      { id: "solgaleo-white", label: "Solgaleo white", color: "#F8FAFC" },
      { id: "lunala-violet", label: "Lunala violet", color: "#4338CA" },
    ],
  },
  {
    label: "Rare Sheens",
    colors: [
      {
        id: "premium-gold",
        label: "Holographic champagne gold",
        color: "#D8B15D",
        kind: "premium-gold",
        rarity: "ultra-rare",
      },
      {
        id: "premium-silver",
        label: "Liquid platinum silver",
        color: "#C9D1DA",
        kind: "premium-silver",
        rarity: "ultra-rare",
      },
      {
        id: "holo-rainbow",
        label: "Secret rare rainbow foil",
        color: "#E879F9",
        kind: "holo-rainbow",
        rarity: "ultra-rare",
      },
      {
        id: "pearl-foil",
        label: "Prismatic pearl foil",
        color: "#F8FAFC",
        kind: "pearl-foil",
        rarity: "rare",
      },
      {
        id: "shadow-foil",
        label: "Black star shadow foil",
        color: "#1F2937",
        kind: "shadow-foil",
        rarity: "rare",
      },
    ],
  },
];
const DEFAULT_PAINT = COLOR_PALETTES[0].colors[0];
const INITIAL_RECENT_PAINTS = [
  DEFAULT_PAINT,
  COLOR_PALETTES[0].colors[2],
  COLOR_PALETTES[0].colors[5],
  COLOR_PALETTES[1].colors[4],
  COLOR_PALETTES[2].colors[5],
  COLOR_PALETTES[4].colors[0],
];
const RECENT_PAINT_LIMIT = 6;

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
const WIZARD_STEPS: WizardStep[] = [
  {
    id: "pokemon",
    label: "Pokemon",
    eyebrow: "01",
    title: "Choose your star",
    caption: "Start with the character that should carry the whole card.",
  },
  {
    id: "pose",
    label: "Pose",
    eyebrow: "02",
    title: "Set the energy",
    caption: "Pick the silhouette and attitude for the coloring page.",
  },
  {
    id: "image",
    label: "Image",
    eyebrow: "03",
    title: "Find the line art",
    caption: "Use a saved sketch or make a fresh one for this pose.",
  },
  {
    id: "color",
    label: "Color",
    eyebrow: "04",
    title: "Pick the palette",
    caption: "Choose a paint, then hop to the canvas for flood-fill color.",
  },
  {
    id: "card",
    label: "Card",
    eyebrow: "05",
    title: "Stage the card",
    caption: "Place the finished art and tune the headline card details.",
  },
  {
    id: "mint",
    label: "Mint",
    eyebrow: "06",
    title: "Make it real",
    caption: "Save the polished card render to the gallery.",
  },
];
const CARD_RARITY_OPTIONS: CardRarityOption[] = [
  { id: "common", label: "Common", symbol: "●", accent: "#64748b" },
  { id: "uncommon", label: "Uncommon", symbol: "◆", accent: "#2563eb" },
  { id: "rare", label: "Rare", symbol: "★", accent: "#ca8a04" },
  { id: "ultra-rare", label: "Ultra rare", symbol: "✦", accent: "#db2777" },
];
const DEFAULT_CARD_RARITY = CARD_RARITY_OPTIONS[0];

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

function mixChannel(start: number, end: number, amount: number) {
  return Math.round(start + (end - start) * amount);
}

function mixRgb(
  start: { r: number; g: number; b: number },
  end: { r: number; g: number; b: number },
  amount: number,
) {
  return {
    r: mixChannel(start.r, end.r, amount),
    g: mixChannel(start.g, end.g, amount),
    b: mixChannel(start.b, end.b, amount),
    a: 255,
  };
}

function getPaintPreview(paint: PaintOption) {
  if (paint.kind === "premium-gold") {
    return "linear-gradient(135deg, #7a4d18 0%, #d8b15d 24%, #fff6c7 42%, #c99844 62%, #f4df9f 78%, #8f5f21 100%)";
  }

  if (paint.kind === "premium-silver") {
    return "linear-gradient(135deg, #64748b 0%, #c9d1da 26%, #fafcff 48%, #94a3b8 68%, #eef2f7 86%, #475569 100%)";
  }

  if (paint.kind === "holo-rainbow") {
    return "conic-gradient(from 35deg, #f43f5e, #facc15, #22c55e, #38bdf8, #8b5cf6, #f472b6, #f43f5e)";
  }

  if (paint.kind === "pearl-foil") {
    return "linear-gradient(135deg, #ffffff 0%, #dbeafe 22%, #fce7f3 44%, #fef9c3 62%, #dcfce7 80%, #ffffff 100%)";
  }

  if (paint.kind === "shadow-foil") {
    return "linear-gradient(135deg, #030712 0%, #1f2937 24%, #6d28d9 42%, #0f172a 64%, #22d3ee 76%, #020617 100%)";
  }

  return paint.color;
}

function getPaintRgba(paint: PaintOption, x: number, y: number) {
  if (
    paint.kind === "premium-gold" ||
    paint.kind === "premium-silver" ||
    paint.kind === "pearl-foil" ||
    paint.kind === "shadow-foil"
  ) {
    const base =
      paint.kind === "premium-gold"
        ? { r: 216, g: 177, b: 93 }
        : paint.kind === "premium-silver"
          ? { r: 201, g: 209, b: 218 }
          : paint.kind === "pearl-foil"
            ? { r: 240, g: 245, b: 255 }
            : { r: 31, g: 41, b: 55 };
    const highlight =
      paint.kind === "premium-gold"
        ? { r: 255, g: 246, b: 199 }
        : paint.kind === "premium-silver"
          ? { r: 250, g: 252, b: 255 }
          : paint.kind === "pearl-foil"
            ? { r: 255, g: 255, b: 255 }
            : { r: 34, g: 211, b: 238 };
    const shadow =
      paint.kind === "premium-gold"
        ? { r: 156, g: 115, b: 52 }
        : paint.kind === "premium-silver"
          ? { r: 126, g: 139, b: 153 }
          : paint.kind === "pearl-foil"
            ? { r: 216, g: 180, b: 254 }
            : { r: 2, g: 6, b: 23 };
    const shimmer =
      (Math.sin((x + y) / 38) + Math.sin((x - y) / 74) + 2) / 4;
    const sparkle = (x * 3 + y * 5) % 211 < 4 ? 0.22 : 0;
    const mix = Math.min(1, shimmer * 0.62 + sparkle);
    const low = shimmer < 0.22 ? shadow : base;

    return mixRgb(low, highlight, mix);
  }

  if (paint.kind === "holo-rainbow") {
    const band = (Math.sin((x + y) / 58) + 1) / 2;
    const sweep = (Math.sin((x - y) / 91) + 1) / 2;
    const sparkle = (x * 7 + y * 11) % 317 < 5 ? 0.26 : 0;
    const colors = [
      { r: 244, g: 63, b: 94 },
      { r: 250, g: 204, b: 21 },
      { r: 34, g: 197, b: 94 },
      { r: 56, g: 189, b: 248 },
      { r: 139, g: 92, b: 246 },
      { r: 244, g: 114, b: 182 },
    ];
    const position = ((x / CANVAS_SIZE + y / CANVAS_SIZE + band + sweep) / 4) *
      colors.length;
    const startIndex = Math.floor(position) % colors.length;
    const endIndex = (startIndex + 1) % colors.length;
    const mixed = mixRgb(
      colors[startIndex],
      colors[endIndex],
      position - Math.floor(position),
    );

    return mixRgb(mixed, { r: 255, g: 255, b: 255 }, sparkle);
  }

  return hexToRgba(paint.color);
}

function collectorNumberWithoutRarity(cardNumber: string) {
  return cardNumber.replace(/[●◆★✦]/g, "").trim();
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

async function readCardCopyResponse(response: Response): Promise<CardCopyResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      error: `Server returned an empty response (${response.status}).`,
    };
  }

  try {
    return JSON.parse(text) as CardCopyResponse;
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
  const loadedCanvasImageUrlRef = useRef("");
  const undoStackRef = useRef<ImageData[]>([]);
  const [activeType, setActiveType] = useState<PokemonType>("electric");
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonOption>(
    POKEMON_TYPE_GROUPS[0].pokemon[0],
  );
  const [selectedPaint, setSelectedPaint] = useState<PaintOption>(DEFAULT_PAINT);
  const [recentPaints, setRecentPaints] =
    useState<PaintOption[]>(INITIAL_RECENT_PAINTS);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#F6C945");
  const [selectedPose, setSelectedPose] = useState(POSE_OPTIONS[0].id);
  const [isWizardOpen, setIsWizardOpen] = useState(true);
  const [wizardStep, setWizardStep] = useState<WizardStepId>("pokemon");
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
  const [cardRarity, setCardRarity] = useState(DEFAULT_CARD_RARITY.id);
  const [illustratorName, setIllustratorName] = useState("Nikhil");
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
  const [mintedCardUrl, setMintedCardUrl] = useState("");
  const [isMintingCard, setIsMintingCard] = useState(false);
  const [isGeneratingCardCopy, setIsGeneratingCardCopy] = useState(false);
  const cardTypeStyle = TYPE_ICON_STYLES[cardType];
  const selectedCardRarity =
    CARD_RARITY_OPTIONS.find((rarity) => rarity.id === cardRarity) ??
    DEFAULT_CARD_RARITY;
  const selectedPokemonTypeStyle = TYPE_ICON_STYLES[selectedPokemon.type];
  const activeTypeGroup =
    POKEMON_TYPE_GROUPS.find((group) => group.id === activeType) ??
    POKEMON_TYPE_GROUPS[0];
  const selectedPoseLabel =
    POSE_OPTIONS.find((pose) => pose.id === selectedPose)?.label ??
    POSE_OPTIONS[0].label;
  const hasExistingImages = existingImages.length > 0;
  const wizardStepIndex = WIZARD_STEPS.findIndex((step) => step.id === wizardStep);
  const activeWizardStep = WIZARD_STEPS[wizardStepIndex] ?? WIZARD_STEPS[0];
  const wizardProgress = ((wizardStepIndex + 1) / WIZARD_STEPS.length) * 100;
  const wizardPreviewImage = mintedCardUrl || cardImageUrl || imageUrl;
  const isFirstWizardStep = wizardStepIndex <= 0;
  const isLastWizardStep = wizardStepIndex === WIZARD_STEPS.length - 1;
  const wizardCanAdvance =
    wizardStep === "pokemon" ||
    wizardStep === "pose" ||
    (wizardStep === "image" && Boolean(imageUrl)) ||
    (wizardStep === "color" && Boolean(imageUrl)) ||
    (wizardStep === "card" && Boolean(cardImageUrl)) ||
    wizardStep === "mint";
  const wizardNextLabel =
    wizardStep === "image" && !imageUrl
      ? "Choose art"
      : wizardStep === "color" && !cardImageUrl
        ? "Place on card"
        : isLastWizardStep
          ? "Minted"
          : "Next";

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
    loadedCanvasImageUrlRef.current = "";
    setCanUndo(false);
    setImageUrl("");
    setCardImageUrl("");
    setMintedCardUrl("");
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
    loadedCanvasImageUrlRef.current = nextImageUrl;
    setCanUndo(false);
  }, []);

  useEffect(() => {
    if (
      wizardStep === "color" &&
      imageUrl &&
      loadedCanvasImageUrlRef.current !== imageUrl
    ) {
      void loadImageToCanvases(imageUrl);
    }
  }, [imageUrl, loadImageToCanvases, wizardStep]);

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
          setMintedCardUrl("");
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
    (startX: number, startY: number, nextPaint: PaintOption) => {
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

        const x = pixelIndex % CANVAS_SIZE;
        const y = Math.floor(pixelIndex / CANVAS_SIZE);
        const fill = getPaintRgba(nextPaint, x, y);

        colorImage.data[dataIndex] = fill.r;
        colorImage.data[dataIndex + 1] = fill.g;
        colorImage.data[dataIndex + 2] = fill.b;
        colorImage.data[dataIndex + 3] = fill.a;
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

  function selectPaint(paint: PaintOption) {
    setSelectedPaint(paint);
    setRecentPaints((currentPaints) => [
      paint,
      ...currentPaints.filter((currentPaint) => currentPaint.id !== paint.id),
    ].slice(0, RECENT_PAINT_LIMIT));
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    floodFill(point.x, point.y, selectedPaint);
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
    setMintedCardUrl("");
    setStatus(`${selectedPokemon.name} placed on card`);
  }

  function goToWizardStep(nextStep: WizardStepId) {
    setWizardStep(nextStep);
    setIsWizardOpen(true);
  }

  function goToPreviousWizardStep() {
    if (isFirstWizardStep) {
      return;
    }

    setWizardStep(WIZARD_STEPS[wizardStepIndex - 1].id);
  }

  function goToNextWizardStep() {
    if (!wizardCanAdvance) {
      return;
    }

    if (wizardStep === "color" && imageUrl && !cardImageUrl) {
      placeOnCard();
    }

    if (isLastWizardStep) {
      return;
    }

    const nextStep = WIZARD_STEPS[wizardStepIndex + 1].id;

    setWizardStep(nextStep);

    if (nextStep === "card") {
      void generateCardCopy();
    }
  }

  async function loadCardAsset(src: string) {
    if (!src) {
      return null;
    }

    try {
      return await loadImage(src);
    } catch {
      return null;
    }
  }

  async function composeCardPreview() {
    if (!cardImageUrl) {
      return "";
    }

    const cardWidth = 900;
    const cardHeight = Math.round((cardWidth * 88) / 63);
    const canvas = document.createElement("canvas");
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    const backgroundImage = await loadCardAsset(selectedBackground);
    const pokemonImage = await loadCardAsset(cardImageUrl);
    const borderWidth = 42;
    const innerX = borderWidth;
    const innerY = borderWidth;
    const innerWidth = cardWidth - borderWidth * 2;
    const innerHeight = cardHeight - borderWidth * 2;

    context.fillStyle = cardBorderColor;
    context.fillRect(0, 0, cardWidth, cardHeight);
    context.fillStyle = "#111827";
    context.fillRect(18, 18, cardWidth - 36, cardHeight - 36);
    context.fillStyle = "#f8fafc";
    context.fillRect(innerX, innerY, innerWidth, innerHeight);

    if (backgroundImage) {
      context.drawImage(backgroundImage, innerX, innerY, innerWidth, innerHeight);
    } else {
      const gradient = context.createLinearGradient(0, innerY, 0, innerY + innerHeight);
      gradient.addColorStop(0, "#e0f2fe");
      gradient.addColorStop(1, "#475569");
      context.fillStyle = gradient;
      context.fillRect(innerX, innerY, innerWidth, innerHeight);
    }

    context.fillStyle = "rgba(255,255,255,0.88)";
    context.fillRect(innerX + 30, innerY + 30, innerWidth - 60, 142);
    context.fillStyle = "#111827";
    context.font = "800 58px Arial";
    context.fillText(`${selectedPokemon.name}${isExCard ? " ex" : ""}`, innerX + 150, innerY + 98);
    context.font = "800 24px Arial";
    context.fillText(cardStage, innerX + 46, innerY + 62);
    context.fillText(`Evolves from ${evolvesFrom || selectedPokemon.name}`, innerX + 152, innerY + 135);
    context.font = "900 52px Arial";
    context.fillText(`${cardHp} HP`, innerX + innerWidth - 230, innerY + 94);

    if (pokemonImage) {
      const pokemonHeight = innerHeight * 0.38;
      const pokemonWidth = pokemonHeight * (pokemonImage.naturalWidth / pokemonImage.naturalHeight);
      context.drawImage(
        pokemonImage,
        innerX + (innerWidth - pokemonWidth) / 2,
        innerY + innerHeight * 0.22,
        pokemonWidth,
        pokemonHeight,
      );
    }

    context.fillStyle = "rgba(15,23,42,0.72)";
    context.fillRect(innerX + 42, innerY + innerHeight - 360, innerWidth - 84, 238);
    context.fillStyle = "#ffffff";
    context.font = "900 44px Arial";
    context.fillText(`${attackOneName} ${attackOneDamage}`, innerX + 78, innerY + innerHeight - 288);
    context.fillText(`${attackTwoName} ${attackTwoDamage}`, innerX + 78, innerY + innerHeight - 174);
    context.font = "800 24px Arial";
    context.fillText(`Weakness ${weakness}    Resistance ${resistance}    Retreat ${retreatCost}`, innerX + 78, innerY + innerHeight - 104);
    context.font = "900 28px Arial";
    context.fillText(`Illus. ${illustratorName || "Unknown"}`, innerX + 78, innerY + innerHeight - 54);
    context.fillText(
      `${collectorNumberWithoutRarity(cardNumber)} ${selectedCardRarity.symbol}`.trim(),
      innerX + innerWidth - 230,
      innerY + innerHeight - 54,
    );

    return canvas.toDataURL("image/png");
  }

  async function mintRealisticCard() {
    setIsMintingCard(true);
    setStatus("Minting realistic Pokemon card");

    try {
      const finalCardImage = await composeCardPreview();

      if (!finalCardImage) {
        throw new Error("Place your colored Pokemon on the card before minting.");
      }

      const response = await fetch("/api/mint-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalCardImage,
          pokemonName: selectedPokemon.name,
          cardType: TYPE_ICON_STYLES[cardType].label,
          cardStage,
          cardHp,
          evolvesFrom,
          isExCard,
          attacks: [
            { name: attackOneName, damage: attackOneDamage },
            { name: attackTwoName, damage: attackTwoDamage },
          ],
          weakness,
          resistance,
          retreatCost,
          cardNumber,
          cardRarity: selectedCardRarity.label,
          cardRaritySymbol: selectedCardRarity.symbol,
          illustratorName,
          backgroundPrompt,
        }),
      });
      const result = await readGenerateResponse(response);

      if (!response.ok || !result.imageUrl) {
        throw new Error(result.error || "Could not mint the realistic card.");
      }

      setMintedCardUrl(result.card?.renderUrl ?? result.imageUrl);
      setStatus(`${selectedPokemon.name} realistic card minted and saved`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Card minting failed");
    } finally {
      setIsMintingCard(false);
    }
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

  async function generateCardCopy() {
    setIsGeneratingCardCopy(true);
    setStatus("Writing card attacks with AI");

    try {
      const response = await fetch("/api/card-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pokemonName: selectedPokemon.name,
          pokemonType: TYPE_ICON_STYLES[cardType].label,
          hp: cardHp,
          rarity: selectedCardRarity.label,
          raritySymbol: selectedCardRarity.symbol,
          pose: selectedPoseLabel,
        }),
      });
      const result = await readCardCopyResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Could not generate card text.");
      }

      setAttackOneName(result.attackOneName || "Quick Strike");
      setAttackOneDamage(result.attackOneDamage || "90");
      setAttackTwoName(result.attackTwoName || "Brilliant Rush");
      setAttackTwoDamage(result.attackTwoDamage || "180");
      setWeakness(result.weakness || "x2");
      setResistance(result.resistance || "-30");
      setRetreatCost(result.retreatCost || "★★");
      setCardStage(result.cardStage || "Basic");
      setEvolvesFrom(result.evolvesFrom || selectedPokemon.name);
      setIsExCard(Boolean(result.isExCard));
      setCardNumber(
        collectorNumberWithoutRarity(result.cardNumber || "001/132"),
      );
      setStatus("AI card attacks ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Card text generation failed");
    } finally {
      setIsGeneratingCardCopy(false);
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
    setActiveType(pokemon.type);
    setSelectedPokemon(pokemon);
    setCardType(pokemon.type);
    setEvolvesFrom(pokemon.name === "Pikachu" ? "Pichu" : "");
    clearAllCanvases();
    setStatus(`Selected ${pokemon.name}`);
  }

  function selectPose(pose: PoseOption) {
    setSelectedPose(pose.id);
    clearAllCanvases();
    setStatus(
      `Selected ${selectedPokemon.name} ${pose.label.toLowerCase()}`,
    );
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
    <main className="fixed inset-0 overflow-hidden bg-[#f7f9fc] text-slate-950 overscroll-none max-[720px]:static max-[720px]:min-h-dvh max-[720px]:overflow-x-hidden max-[720px]:overflow-y-auto max-[720px]:bg-gradient-to-b max-[720px]:from-white max-[720px]:to-slate-100 max-[720px]:pb-[calc(88px+env(safe-area-inset-bottom))]">
      {false ? (
      <div className="grid h-[100dvh] min-h-0 grid-cols-[280px_minmax(0,1fr)_320px] max-[980px]:grid-cols-[250px_minmax(0,1fr)] max-[720px]:h-auto max-[720px]:min-h-dvh max-[720px]:grid-cols-1 max-[720px]:gap-3 max-[720px]:p-3">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white p-3 max-[720px]:order-2 max-[720px]:max-h-none max-[720px]:overflow-visible max-[720px]:rounded-[28px] max-[720px]:border max-[720px]:border-slate-200/80 max-[720px]:shadow-sm">
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

          <button
            className="mb-3 flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            type="button"
            onClick={() => goToWizardStep("pokemon")}
          >
            <Sparkles aria-hidden="true" size={17} />
            Open guide
          </button>

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
            <div className="grid grid-cols-2 gap-2 max-[430px]:grid-cols-1">
              {POSE_OPTIONS.map((pose) => (
                <button
                  key={pose.id}
                  className={`h-10 rounded-lg border-2 px-2 text-sm font-black transition ${
                    selectedPose === pose.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  type="button"
                  onClick={() => selectPose(pose)}
                >
                  {pose.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 max-[720px]:overflow-visible max-[720px]:pr-0">
            <div className="grid gap-2 pb-3 max-[720px]:grid-cols-2 max-[430px]:grid-cols-1">
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

        <section className="flex h-[100dvh] min-h-0 flex-col overflow-hidden max-[720px]:order-1 max-[720px]:h-auto max-[720px]:overflow-visible">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 max-[720px]:sticky max-[720px]:top-0 max-[720px]:z-30 max-[720px]:rounded-[28px] max-[720px]:border max-[720px]:border-slate-200/80 max-[720px]:bg-white/92 max-[720px]:p-3 max-[720px]:shadow-[0_12px_34px_rgba(15,23,42,0.10)] max-[720px]:backdrop-blur">
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
              <button
                className="flex h-11 items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-950 transition hover:border-slate-300"
                type="button"
                onClick={() => goToWizardStep(imageUrl ? "color" : "pokemon")}
              >
                <Sparkles aria-hidden="true" size={18} />
                Guide
              </button>
              <div className="relative max-[720px]:static">
                <div className="flex h-12 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 shadow-sm">
                  {recentPaints.map((paint) => (
                    <button
                      key={paint.id}
                      aria-label={`Use recent color ${paint.label}`}
                      title={paint.label}
                      className={`relative size-8 rounded-full border-2 transition hover:scale-105 ${
                        selectedPaint.id === paint.id
                          ? "border-slate-950"
                          : "border-white"
                      } ring-1 ring-slate-200`}
                      style={{ background: getPaintPreview(paint) }}
                      type="button"
                      onClick={() => selectPaint(paint)}
                    >
                      {paint.rarity ? (
                        <Sparkles
                          aria-hidden="true"
                          className="absolute -right-1 -top-1 rounded-full bg-slate-950 p-0.5 text-white"
                          size={13}
                        />
                      ) : null}
                    </button>
                  ))}
                  <button
                    aria-expanded={isColorPickerOpen}
                    aria-label="Open color palette"
                    className="ml-1 flex h-9 max-w-[180px] items-center gap-2 rounded-full bg-slate-950 px-3 text-xs font-black text-white"
                    type="button"
                    onClick={() => setIsColorPickerOpen((isOpen) => !isOpen)}
                  >
                    <span
                      className="size-4 rounded-full ring-1 ring-white/40"
                      style={{ background: getPaintPreview(selectedPaint) }}
                    />
                    <span className="truncate max-[760px]:hidden">
                      {selectedPaint.label}
                    </span>
                    <Palette aria-hidden="true" size={15} />
                  </button>
                </div>

                {isColorPickerOpen ? (
                  <div className="absolute right-0 top-14 z-20 w-[min(90vw,500px)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur max-[720px]:fixed max-[720px]:inset-x-3 max-[720px]:bottom-[calc(86px+env(safe-area-inset-bottom))] max-[720px]:top-auto max-[720px]:z-50 max-[720px]:w-auto max-[720px]:rounded-[28px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="grid size-12 shrink-0 place-items-center rounded-xl border border-slate-200 shadow-inner"
                          style={{ background: getPaintPreview(selectedPaint) }}
                        >
                          {selectedPaint.rarity ? (
                            <Sparkles
                              aria-hidden="true"
                              className="text-white drop-shadow"
                              size={18}
                            />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Palette
                        </p>
                        <p className="truncate text-sm font-black text-slate-950">
                          {selectedPaint.label}
                        </p>
                        </div>
                      </div>
                      <input
                        aria-label="Custom color"
                        className="size-11 shrink-0 rounded-xl border border-slate-200 bg-white p-1"
                        type="color"
                        value={customColor}
                        onChange={(event) => {
                          const nextColor = event.target.value;
                          setCustomColor(nextColor);
                          selectPaint({
                            id: `custom-${nextColor}`,
                            label: "Custom color",
                            color: nextColor,
                          });
                        }}
                      />
                    </div>
                    <div className="grid gap-3">
                      {COLOR_PALETTES.map((palette) => (
                        <div key={palette.label} className="grid gap-1.5">
                          <p className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                            {palette.label}
                          </p>
                          <div
                            className={
                              palette.label === "Rare Sheens"
                                ? "grid grid-cols-5 gap-2"
                                : "grid grid-cols-8 gap-1.5 max-[420px]:grid-cols-4"
                            }
                          >
                            {palette.colors.map((paint) => (
                              <button
                                key={paint.id}
                                aria-label={`Use ${paint.label}`}
                                title={paint.label}
                                className={`relative aspect-square rounded-xl border-2 transition hover:scale-105 ${
                                  selectedPaint.id === paint.id
                                    ? "border-slate-950"
                                    : "border-white"
                                } shadow-sm ring-1 ring-slate-200`}
                                style={{ background: getPaintPreview(paint) }}
                                type="button"
                                onClick={() => selectPaint(paint)}
                              >
                                {paint.rarity ? (
                                  <Sparkles
                                    aria-hidden="true"
                                    className="absolute bottom-1 right-1 rounded-full bg-slate-950/85 p-0.5 text-white"
                                    size={14}
                                  />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
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

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 max-[720px]:overflow-visible max-[720px]:px-0 max-[720px]:py-2">
            <div
              className="w-full"
              style={{
                maxWidth: hasExistingImages
                  ? "min(100%, calc(100dvh - 250px), 860px)"
                  : "min(100%, calc(100dvh - 150px), 860px)",
              }}
            >
              <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-slate-950 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)] max-[720px]:rounded-[30px] max-[720px]:shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
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

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 max-[980px]:col-span-2 max-[980px]:border-l-0 max-[980px]:border-t max-[720px]:order-3 max-[720px]:col-span-1 max-[720px]:overflow-visible max-[720px]:rounded-[28px] max-[720px]:border max-[720px]:border-slate-200/80 max-[720px]:shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Pokemon card studio</h2>
              <p className="text-sm font-bold leading-snug text-slate-500">Review the card, tune the details, then create a polished realistic render.</p>
            </div>
            <a className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-950 hover:text-white" href="/cards">
              Gallery
            </a>
          </div>

          <div className="grid grid-cols-5 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-[10px] font-black uppercase text-slate-500 max-[430px]:text-[9px]">
            {["Pick", "Color", "Place", "Customize", "Mint"].map((step, index) => (
              <div
                key={step}
                className={`rounded-xl px-2 py-2 text-center ${
                  index === 4 ? "bg-lime-300 text-slate-950 shadow-sm" : "bg-white"
                }`}
              >
                <span className="mb-1 block text-[11px] text-slate-400">{index + 1}</span>
                {step}
              </div>
            ))}
          </div>

          {mintedCardUrl ? (
            <div className="grid gap-2 rounded-2xl border border-lime-200 bg-lime-50 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase text-lime-700">Minted realistic card saved to gallery</p>
                <div className="flex gap-2">
                  <a className="rounded-full bg-white px-3 py-1 text-xs font-black text-lime-700 shadow-sm" href="/cards">
                    Gallery
                  </a>
                  <a className="rounded-full bg-white px-3 py-1 text-xs font-black text-lime-700 shadow-sm" href={mintedCardUrl} download>
                    Download
                  </a>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Minted realistic Pokemon card" className="mx-auto max-h-[420px] w-auto rounded-xl border border-lime-200 shadow-sm" src={mintedCardUrl} />
            </div>
          ) : null}

          <div
            className="mx-auto w-full max-w-[320px] rounded-[24px] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] max-[720px]:max-w-[min(100%,330px)]"
            style={{ backgroundColor: cardBorderColor }}
          >
            <div className="relative aspect-[63/88] overflow-hidden rounded-[20px] border-2 border-white/50 bg-slate-800 p-2">
              <div className="absolute inset-1 rounded-[18px] border-4 border-slate-300/80" />
              <div className="relative size-full overflow-hidden rounded-[16px] border-[3px] border-slate-950 bg-slate-100">
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

                <div className="absolute inset-x-3 top-3 z-20 rounded-2xl border-2 border-slate-950 bg-white/92 p-2 shadow-[0_3px_12px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                  <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2">
                    <div className="grid gap-1">
                      <span className="rounded-full border border-slate-300 bg-white px-1 py-0.5 text-center text-[8px] font-black uppercase italic leading-tight text-slate-600 shadow-sm">
                        {cardStage}
                      </span>
                      <div className="grid size-9 place-items-center overflow-hidden rounded-full border-2 border-slate-300 bg-white shadow-inner">
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
                      <h3 className="truncate text-[18px] font-black leading-none tracking-tight text-yellow-300 [text-shadow:_1px_1px_0_rgb(15_23_42),_-1px_1px_0_rgb(15_23_42),_1px_-1px_0_rgb(15_23_42),_-1px_-1px_0_rgb(15_23_42)]">
                        {selectedPokemon.name}
                        {isExCard ? <span className="ml-1 text-[12px] italic text-lime-300">ex</span> : null}
                      </h3>
                      <p className="mt-0.5 truncate text-[9px] font-black italic leading-tight text-slate-600">
                        Evolves from {evolvesFrom || selectedPokemon.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-black uppercase text-slate-600">HP</span>
                      <span className="text-[22px] font-black leading-none text-slate-950">{cardHp}</span>
                      <span
                        aria-label={`${cardTypeStyle.label} energy`}
                        className="grid size-7 place-items-center rounded-full border-2 border-white text-sm font-black shadow-[inset_0_2px_5px_rgba(255,255,255,0.65),0_2px_6px_rgba(15,23,42,0.25)]"
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
                    <div className="absolute -right-1 top-11 rounded-full bg-pink-200 px-2 py-0.5 text-[8px] font-black italic text-pink-700 shadow">
                      Mega-Evolved Pokemon ex
                    </div>
                  ) : null}
                </div>

                {cardImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Colored Pokemon on card"
                    className="absolute inset-x-0 top-[22%] z-10 mx-auto h-[32%] w-auto object-contain drop-shadow-[0_14px_9px_rgba(15,23,42,0.38)]"
                    src={cardImageUrl}
                  />
                ) : (
                  <div className="absolute inset-x-8 top-[27%] z-10 text-center text-xl font-black text-slate-600/80">
                    Color a Pokemon, then place it here.
                  </div>
                )}

                <div className="absolute inset-x-4 bottom-[88px] z-20 grid gap-1 rounded-2xl bg-slate-950/55 p-2 text-white backdrop-blur-[1px] [text-shadow:_1px_1px_2px_rgb(15_23_42)]">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                    <div className="flex -space-x-1">
                      {[0, 1].map((cost) => (
                        <span
                          key={`attack-one-${cost}`}
                          className="grid size-4 place-items-center rounded-full border border-white text-[9px] font-black shadow"
                          style={{
                            backgroundColor: cardTypeStyle.color,
                            color: cardTypeStyle.textColor ?? "#ffffff",
                          }}
                        >
                          {cardTypeStyle.glyph}
                        </span>
                      ))}
                    </div>
                    <span className="truncate text-[14px] font-black leading-none">{attackOneName}</span>
                    <span className="text-[16px] font-black leading-none">{attackOneDamage}</span>
                  </div>
                  <p className="line-clamp-2 max-w-[94%] text-[9px] font-bold leading-tight">
                    Attach up to 3 Basic Energy cards from your discard pile to your Benched Pokemon in any way you like.
                  </p>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pt-1">
                    <div className="flex -space-x-1">
                      {[0, 1, 2].map((cost) => (
                        <span
                          key={`attack-two-${cost}`}
                          className="grid size-4 place-items-center rounded-full border border-white text-[9px] font-black shadow"
                          style={{
                            backgroundColor: cost === 2 ? "#e5e7eb" : cardTypeStyle.color,
                            color: cost === 2 ? "#111827" : cardTypeStyle.textColor ?? "#ffffff",
                          }}
                        >
                          {cost === 2 ? "★" : cardTypeStyle.glyph}
                        </span>
                      ))}
                    </div>
                    <span className="truncate text-[14px] font-black leading-none">{attackTwoName}</span>
                    <span className="text-[16px] font-black leading-none">{attackTwoDamage}</span>
                  </div>
                  <p className="line-clamp-2 max-w-[94%] text-[9px] font-bold leading-tight">
                    During your next turn, this Pokemon can&apos;t use {attackTwoName}.
                  </p>
                </div>

                <div className="absolute inset-x-4 bottom-[54px] z-20 grid grid-cols-3 gap-1 rounded-lg bg-white/78 px-1 py-1 text-center text-[7px] font-black uppercase text-slate-700">
                  <span>Weakness {weakness}</span>
                  <span>Resistance {resistance}</span>
                  <span>Retreat {retreatCost}</span>
                </div>

                {isExCard ? (
                  <div className="absolute inset-x-9 bottom-8 z-30 rounded-full border-2 border-slate-900 bg-gradient-to-r from-yellow-300 via-white to-yellow-300 px-2 py-1 text-center text-[8px] font-black leading-tight text-slate-900 shadow">
                    Pokemon ex rule: when this Pokemon ex is Knocked Out, your opponent takes 2 Prize cards.
                  </div>
                ) : null}

                <div className="absolute inset-x-3 bottom-1 z-20 flex items-center justify-between rounded bg-white/85 px-2 py-0.5 text-[8px] font-black text-slate-700">
                  <span>©2026 Canvas Camp</span>
                  <span>{cardNumber} ★</span>
                </div>
              </div>
            </div>
          </div>

          <button className="sticky bottom-2 z-30 flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-400 px-4 text-sm font-black text-slate-950 shadow-[0_12px_30px_rgba(132,204,22,0.35)] transition hover:bg-lime-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none max-[720px]:bottom-[calc(92px+env(safe-area-inset-bottom))]" disabled={!cardImageUrl || isMintingCard} type="button" onClick={() => void mintRealisticCard()}>
            {isMintingCard ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <Sparkles aria-hidden="true" size={18} />}
            <span>{isMintingCard ? "Minting actual card" : cardImageUrl ? "Mint actual card" : "Place on card to unlock minting"}</span>
          </button>

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

          <div className="grid grid-cols-3 gap-2 max-[430px]:grid-cols-1">
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
      ) : null}

      {isWizardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f7f9fc] p-0 max-[720px]:items-stretch">
          <section
            aria-labelledby="wizard-title"
            aria-modal="true"
            className="grid h-dvh w-full grid-cols-[340px_minmax(0,1fr)] overflow-hidden bg-white max-[860px]:grid-cols-1"
            role="dialog"
          >
            <aside className="relative flex min-h-0 flex-col overflow-hidden bg-[#101827] p-5 text-white max-[860px]:hidden">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: selectedPokemonTypeStyle.color }} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Pokemon Camp
                  </p>
                  <h2 className="mt-1 text-xl font-black">Card quest</h2>
                </div>
                <a
                  className="rounded-full border border-white/15 bg-white/8 px-3 py-2 text-xs font-black text-white transition hover:bg-white/14"
                  href="/cards"
                >
                  Gallery
                </a>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div
                  className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[18px] border border-white/12 bg-[#f8fafc]"
                  style={{
                    boxShadow: `0 24px 60px ${selectedPokemonTypeStyle.color}22`,
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-24 opacity-90"
                    style={{ backgroundColor: selectedPokemonTypeStyle.color }}
                  />
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase text-slate-700 shadow-sm">
                      {selectedPoseLabel}
                    </span>
                    <span
                      className="grid size-10 place-items-center rounded-full border-2 border-white text-lg font-black shadow-md"
                      style={{
                        backgroundColor: selectedPokemonTypeStyle.color,
                        color: selectedPokemonTypeStyle.textColor ?? "#ffffff",
                      }}
                    >
                      {selectedPokemonTypeStyle.glyph}
                    </span>
                  </div>
                  {wizardPreviewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="relative z-10 max-h-[62%] max-w-[74%] object-contain drop-shadow-[0_18px_16px_rgba(15,23,42,0.28)]"
                      src={wizardPreviewImage}
                    />
                  ) : (
                    <div className="relative z-10 grid size-32 place-items-center rounded-full border-4 border-white bg-slate-950 text-6xl font-black shadow-2xl">
                      {selectedPokemonTypeStyle.glyph}
                    </div>
                  )}
                  <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-slate-200 bg-white/92 p-3 text-slate-950 shadow-lg">
                    <p className="truncate text-2xl font-black leading-none">
                      {selectedPokemon.name}
                      {isExCard ? <span className="ml-1 text-sm italic text-pink-600">ex</span> : null}
                    </p>
                    <p className="mt-1 truncate text-xs font-black uppercase text-slate-400">
                      {selectedPokemonTypeStyle.label} · {cardHp} HP
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/8 p-3">
                    <p className="text-[9px] font-black uppercase text-white/35">Pose</p>
                    <p className="mt-1 truncate text-sm font-black">{selectedPoseLabel}</p>
                  </div>
                  <div className="rounded-xl bg-white/8 p-3">
                    <p className="text-[9px] font-black uppercase text-white/35">Paint</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="size-4 rounded-full" style={{ background: getPaintPreview(selectedPaint) }} />
                      <span className="truncate text-sm font-black">{selectedPaint.label}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/8 p-3">
                    <p className="text-[9px] font-black uppercase text-white/35">Stage</p>
                    <p className="mt-1 truncate text-sm font-black">{cardStage}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {WIZARD_STEPS.map((step, index) => {
                  const isActive = step.id === wizardStep;
                  const isComplete =
                    index < wizardStepIndex ||
                    (step.id === "image" && Boolean(imageUrl)) ||
                    (step.id === "card" && Boolean(cardImageUrl)) ||
                    (step.id === "mint" && Boolean(mintedCardUrl));

                  return (
                    <button
                      key={`${step.id}-rail`}
                      className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-white/35 bg-white text-slate-950"
                          : "border-white/10 bg-white/6 text-white hover:bg-white/10"
                      }`}
                      type="button"
                      onClick={() => {
                        setWizardStep(step.id);

                        if (step.id === "card") {
                          void generateCardCopy();
                        }
                      }}
                    >
                      <span
                        className={`grid size-8 place-items-center rounded-lg text-xs font-black ${
                          isActive ? "bg-slate-950 text-white" : "bg-white/10"
                        }`}
                      >
                        {step.eyebrow}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{step.label}</span>
                        <span className={`block truncate text-[10px] font-black uppercase ${isActive ? "text-slate-400" : "text-white/35"}`}>
                          {step.title}
                        </span>
                      </span>
                      {isComplete ? <Check aria-hidden="true" size={16} /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto pt-5">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: selectedPokemonTypeStyle.color,
                      width: `${wizardProgress}%`,
                    }}
                  />
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col bg-[#f8fafc]">
              <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-5 max-[720px]:px-4 max-[720px]:py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {activeWizardStep.eyebrow} · {activeWizardStep.label}
                    </p>
                    <h2 id="wizard-title" className="mt-1 text-3xl font-black leading-tight text-slate-950 max-[520px]:text-2xl">
                      {activeWizardStep.title}
                    </h2>
                    <p className="mt-1 max-w-[640px] text-sm font-bold leading-snug text-slate-500">
                      {activeWizardStep.caption}
                    </p>
                  </div>
                  <a
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-950 min-[861px]:hidden"
                    href="/cards"
                  >
                    Gallery
                  </a>
                </div>

                <div className="mt-4 hidden grid-cols-6 gap-1.5 max-[860px]:grid">
                  {WIZARD_STEPS.map((step, index) => {
                    const isActive = step.id === wizardStep;
                    const isComplete =
                      index < wizardStepIndex ||
                      (step.id === "image" && Boolean(imageUrl)) ||
                      (step.id === "card" && Boolean(cardImageUrl)) ||
                      (step.id === "mint" && Boolean(mintedCardUrl));

                    return (
                      <button
                        key={`${step.id}-mobile-rail`}
                        aria-label={step.label}
                        className={`h-2 rounded-full transition ${
                          isActive || isComplete ? "bg-slate-950" : "bg-slate-200"
                        }`}
                        type="button"
                        onClick={() => {
                          setWizardStep(step.id);

                          if (step.id === "card") {
                            void generateCardCopy();
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-6 max-[720px]:p-4">
                {wizardStep === "pokemon" ? (
                  <div className="grid gap-5">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {POKEMON_TYPE_GROUPS.map((group) => (
                        <button
                          key={`${group.id}-wizard-type`}
                          className={`flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black transition ${
                            activeType === group.id
                              ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/12"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                          type="button"
                          onClick={() => setActiveType(group.id)}
                        >
                          <span className="size-3 rounded-full" style={{ backgroundColor: group.color }} />
                          {group.label}
                          <span className="font-mono text-xs opacity-55">{group.pokemon.length}</span>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3 max-[980px]:grid-cols-2 max-[560px]:grid-cols-1">
                      {activeTypeGroup.pokemon.map((pokemon) => {
                        const typeStyle = TYPE_ICON_STYLES[pokemon.type];
                        const isSelected =
                          selectedPokemon.name === pokemon.name &&
                          selectedPokemon.type === pokemon.type;

                        return (
                          <button
                            key={`${pokemon.type}-${pokemon.name}-wizard`}
                            className={`group relative min-h-44 overflow-hidden rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${
                              isSelected
                                ? "border-slate-950 bg-slate-950 text-white shadow-xl shadow-slate-950/18"
                                : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
                            }`}
                            type="button"
                            onClick={() => selectPokemon(pokemon)}
                          >
                            <span
                              className="absolute right-4 top-4 grid size-12 place-items-center rounded-full border-2 border-white text-xl font-black shadow-sm"
                              style={{
                                backgroundColor: typeStyle.color,
                                color: typeStyle.textColor ?? "#ffffff",
                              }}
                            >
                              {typeStyle.glyph}
                            </span>
                            <span className="mt-16 block text-2xl font-black">{pokemon.name}</span>
                            <span className={`mt-2 block text-xs font-black uppercase ${isSelected ? "text-white/55" : "text-slate-400"}`}>
                              {typeStyle.label}
                            </span>
                            {isSelected ? (
                              <span className="absolute bottom-4 right-4 grid size-8 place-items-center rounded-full bg-white text-slate-950">
                                <Check aria-hidden="true" size={16} />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {wizardStep === "pose" ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="grid grid-cols-4 gap-3 max-[980px]:grid-cols-2 max-[520px]:grid-cols-1">
                      {POSE_OPTIONS.map((pose, index) => (
                        <button
                          key={`${pose.id}-wizard`}
                          className={`group min-h-36 rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${
                            selectedPose === pose.id
                              ? "border-slate-950 bg-slate-950 text-white shadow-xl shadow-slate-950/16"
                              : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
                          }`}
                          type="button"
                          onClick={() => selectPose(pose)}
                        >
                          <span
                            className="grid size-11 place-items-center rounded-xl text-sm font-black"
                            style={{
                              backgroundColor:
                                selectedPose === pose.id
                                  ? selectedPokemonTypeStyle.color
                                  : "#f1f5f9",
                              color:
                                selectedPose === pose.id
                                  ? selectedPokemonTypeStyle.textColor ?? "#ffffff"
                                  : "#475569",
                            }}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="mt-8 block text-xl font-black">{pose.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid content-start gap-3 rounded-[18px] border border-slate-200 bg-white p-4">
                      <label className="grid gap-2 text-xs font-black uppercase text-slate-500">
                        Model
                        <select
                          className="h-11 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm normal-case text-slate-950"
                          value={model}
                          onChange={(event) => setModel(event.target.value)}
                        >
                          {MODEL_OPTIONS.map((option) => (
                            <option key={`${option}-wizard`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase text-slate-400">Current</p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {selectedPokemon.name} · {selectedPoseLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {wizardStep === "image" ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="grid content-start gap-3">
                      {hasExistingImages ? (
                        <div className="grid grid-cols-4 gap-3 max-[980px]:grid-cols-3 max-[560px]:grid-cols-2">
                          {existingImages.map((image, index) => (
                            <button
                              key={`${image.pathname}-wizard`}
                              aria-label={`Use saved image ${index + 1}`}
                              className={`aspect-square overflow-hidden rounded-[18px] border-2 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-xl ${
                                image.renderUrl === imageUrl
                                  ? "border-slate-950 shadow-xl shadow-slate-950/14"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                              type="button"
                              onClick={() => void selectExistingImage(image)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img alt="" className="size-full object-contain" src={image.renderUrl} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid min-h-80 place-items-center rounded-[22px] border border-dashed border-slate-300 bg-white text-center">
                          {isLoadingImages ? (
                            <Loader2 aria-hidden="true" className="animate-spin text-slate-300" size={48} />
                          ) : (
                            <div className="grid gap-3">
                              <ImageIcon aria-hidden="true" className="mx-auto text-slate-300" size={56} />
                              <p className="text-sm font-black uppercase text-slate-400">No saved sketch yet</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid content-start gap-3">
                      <button
                        className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-[22px] bg-slate-950 px-4 text-center text-white shadow-xl shadow-slate-950/18 transition hover:bg-slate-800 disabled:opacity-45"
                        disabled={isGenerating}
                        type="button"
                        onClick={() => void generateColoringPagePng(selectedPokemon.name)}
                      >
                        {isGenerating ? <Loader2 aria-hidden="true" className="animate-spin" size={24} /> : <Sparkles aria-hidden="true" size={24} />}
                        <span className="text-lg font-black">{hasExistingImages ? "New sketch" : "Generate sketch"}</span>
                      </button>
                      <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                        <p className="text-xs font-black uppercase text-slate-400">Line art</p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {selectedPokemon.name}
                        </p>
                        <p className="text-sm font-bold text-slate-500">{selectedPoseLabel}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {wizardStep === "color" ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
                    <div className="grid content-start gap-3">
                      <div className="relative aspect-square overflow-hidden rounded-[24px] border-2 border-slate-950 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
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
                              <ImageIcon aria-hidden="true" className="mx-auto text-slate-300" size={56} />
                              <button
                                className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                                disabled={isGenerating}
                                type="button"
                                onClick={() => void generateColoringPagePng(selectedPokemon.name)}
                              >
                                {isGenerating ? (
                                  <Loader2 aria-hidden="true" className="animate-spin" size={18} />
                                ) : (
                                  <Plus aria-hidden="true" size={18} />
                                )}
                                Generate line art
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-500">
                        <span className="truncate">{status}</span>
                        <div className="flex items-center gap-2">
                          <button
                            aria-label="Undo"
                            className="grid size-10 place-items-center rounded-xl border-2 border-slate-200 bg-white text-slate-950 disabled:opacity-40"
                            disabled={!canUndo}
                            type="button"
                            onClick={undoFill}
                          >
                            <Undo2 aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label="Clear colors"
                            className="grid size-10 place-items-center rounded-xl border-2 border-slate-200 bg-white text-slate-950 disabled:opacity-40"
                            disabled={!imageUrl}
                            type="button"
                            onClick={clearColors}
                          >
                            <Eraser aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label="Download PNG"
                            className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white disabled:opacity-40"
                            disabled={!imageUrl}
                            type="button"
                            onClick={downloadColoringPage}
                          >
                            <Download aria-hidden="true" size={17} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid content-start gap-4 rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid size-16 shrink-0 place-items-center rounded-2xl border border-slate-200 shadow-inner"
                          style={{ background: getPaintPreview(selectedPaint) }}
                        >
                          {selectedPaint.rarity ? <Sparkles aria-hidden="true" className="text-white drop-shadow" size={20} /> : null}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-slate-400">Paint</p>
                          <p className="truncate text-xl font-black text-slate-950">{selectedPaint.label}</p>
                        </div>
                        <input
                          aria-label="Custom color"
                          className="ml-auto size-12 shrink-0 rounded-xl border border-slate-200 bg-white p-1"
                          type="color"
                          value={customColor}
                          onChange={(event) => {
                            const nextColor = event.target.value;
                            setCustomColor(nextColor);
                            selectPaint({
                              id: `wizard-custom-${nextColor}`,
                              label: "Custom color",
                              color: nextColor,
                            });
                          }}
                        />
                      </div>

                      <div className="grid gap-4">
                        {COLOR_PALETTES.map((palette) => (
                          <div key={`${palette.label}-wizard`} className="grid gap-2">
                            <p className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                              {palette.label}
                            </p>
                            <div className={palette.label === "Rare Sheens" ? "grid grid-cols-5 gap-2" : "grid grid-cols-8 gap-2 max-[560px]:grid-cols-4"}>
                              {palette.colors.map((paint) => (
                                <button
                                  key={`${paint.id}-wizard`}
                                  aria-label={`Use ${paint.label}`}
                                  className={`relative aspect-square rounded-xl border-2 transition hover:scale-105 ${
                                    selectedPaint.id === paint.id ? "border-slate-950" : "border-white"
                                  } shadow-sm ring-1 ring-slate-200`}
                                  style={{ background: getPaintPreview(paint) }}
                                  type="button"
                                  onClick={() => selectPaint(paint)}
                                >
                                  {paint.rarity ? (
                                    <Sparkles aria-hidden="true" className="absolute bottom-1 right-1 rounded-full bg-slate-950/85 p-0.5 text-white" size={13} />
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {wizardStep === "card" ? (
                  <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div
                      className="mx-auto w-full max-w-[240px] rounded-[22px] p-2 shadow-xl shadow-slate-950/14"
                      style={{ backgroundColor: cardBorderColor }}
                    >
                      <div className="grid aspect-[63/88] place-items-center overflow-hidden rounded-[18px] border-2 border-white/50 bg-slate-900">
                        {cardImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="Card preview Pokemon" className="max-h-[74%] max-w-[82%] object-contain drop-shadow-[0_16px_14px_rgba(0,0,0,0.35)]" src={cardImageUrl} />
                        ) : imageUrl ? (
                          <button
                            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-slate-950"
                            type="button"
                            onClick={placeOnCard}
                          >
                            <Layers aria-hidden="true" size={18} />
                            Place art
                          </button>
                        ) : (
                          <ImageIcon aria-hidden="true" className="text-slate-500" size={44} />
                        )}
                      </div>
                    </div>

                    <div className="grid content-start gap-4">
                      <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                          HP
                          <input className="h-11 rounded-lg border-2 border-slate-200 px-3 text-slate-950" min="10" max="340" step="10" type="number" value={cardHp} onChange={(event) => setCardHp(Number(event.target.value) || 10)} />
                        </label>
                        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                          Type
                          <select className="h-11 rounded-lg border-2 border-slate-200 bg-white px-3 text-slate-950" value={cardType} onChange={(event) => setCardType(event.target.value as PokemonType)}>
                            {POKEMON_TYPE_GROUPS.map((group) => (
                              <option key={`${group.id}-wizard-card-type`} value={group.id}>{group.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-2 rounded-[18px] border border-slate-200 bg-white p-4">
                        <p className="text-xs font-black uppercase text-slate-500">Rarity mark</p>
                        <div className="grid grid-cols-4 gap-2 max-[620px]:grid-cols-2">
                          {CARD_RARITY_OPTIONS.map((rarity) => (
                            <button
                              key={rarity.id}
                              className={`flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                                cardRarity === rarity.id
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
                              }`}
                              type="button"
                              onClick={() => setCardRarity(rarity.id)}
                            >
                              <span
                                className="grid size-9 shrink-0 place-items-center rounded-full text-lg font-black"
                                style={{
                                  backgroundColor: rarity.accent,
                                  color: "#ffffff",
                                }}
                              >
                                {rarity.symbol}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black">{rarity.label}</span>
                                <span className={`block text-[10px] font-black uppercase ${cardRarity === rarity.id ? "text-white/55" : "text-slate-400"}`}>
                                  {rarity.symbol}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 max-[620px]:grid-cols-1">
                        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                          Illustrator
                          <input className="h-11 rounded-lg border-2 border-slate-200 px-3 normal-case text-slate-950" value={illustratorName} onChange={(event) => setIllustratorName(event.target.value)} />
                        </label>
                        <button className="flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-40" disabled={isGeneratingCardCopy} type="button" onClick={() => void generateCardCopy()}>
                          {isGeneratingCardCopy ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Sparkles aria-hidden="true" size={16} />}
                          Regenerate attacks
                        </button>
                      </div>

                      <div className="grid gap-2 rounded-[18px] border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase text-slate-500">AI card text</p>
                          {isGeneratingCardCopy ? (
                            <Loader2 aria-hidden="true" className="animate-spin text-slate-400" size={16} />
                          ) : null}
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_64px] gap-2 text-sm font-black text-slate-950">
                          <span className="truncate">{attackOneName}</span>
                          <span className="text-right">{attackOneDamage}</span>
                          <span className="truncate">{attackTwoName}</span>
                          <span className="text-right">{attackTwoDamage}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {wizardStep === "mint" ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="grid min-h-80 place-items-center rounded-[22px] border border-slate-200 bg-white p-4">
                      {mintedCardUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="Minted realistic Pokemon card" className="max-h-[520px] rounded-[18px] border border-lime-200 shadow-sm" src={mintedCardUrl} />
                      ) : cardImageUrl ? (
                        <div className="text-center">
                          <Sparkles aria-hidden="true" className="mx-auto text-lime-500" size={52} />
                          <p className="mt-3 text-xl font-black text-slate-950">{selectedPokemon.name} card ready</p>
                        </div>
                      ) : (
                        <ImageIcon aria-hidden="true" className="text-slate-300" size={52} />
                      )}
                    </div>
                    <div className="grid content-start gap-3">
                      <button className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-lime-400 px-4 text-sm font-black text-slate-950 shadow-[0_12px_30px_rgba(132,204,22,0.25)] transition hover:bg-lime-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none" disabled={!cardImageUrl || isMintingCard} type="button" onClick={() => void mintRealisticCard()}>
                        {isMintingCard ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <Sparkles aria-hidden="true" size={18} />}
                        {isMintingCard ? "Minting card" : "Mint card"}
                      </button>
                      <a className="flex h-11 items-center justify-center rounded-[14px] border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-950 transition hover:border-slate-300" href="/cards">
                        Gallery
                      </a>
                      {mintedCardUrl ? (
                        <a className="flex h-11 items-center justify-center rounded-[14px] bg-slate-950 px-4 text-sm font-black text-white" href={mintedCardUrl} download>
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 max-[720px]:px-4">
                <button
                  className="flex h-11 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-950 transition hover:border-slate-300 disabled:opacity-40"
                  disabled={isFirstWizardStep}
                  type="button"
                  onClick={goToPreviousWizardStep}
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                  Back
                </button>
                <div className="min-w-0 truncate text-center text-xs font-black uppercase text-slate-400 max-[520px]:hidden">
                  {selectedPokemon.name} · {selectedPoseLabel}
                </div>
                <button
                  className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
                  disabled={!wizardCanAdvance}
                  type="button"
                  onClick={goToNextWizardStep}
                >
                  {wizardNextLabel}
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
