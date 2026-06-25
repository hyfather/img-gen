"use client";

import type { CanvasBackground } from "@/lib/backgrounds";
import NextImage from "next/image";
import {
  BringToFront,
  Copy,
  Download,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  SendToBack,
  Settings,
  Trash2,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PokemonType =
  | "fire"
  | "water"
  | "grass"
  | "electric"
  | "psychic"
  | "ice"
  | "fairy";

type CanvasItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  pokemonType: PokemonType;
  hp: number;
  move: string;
  showOutline: boolean;
};

type PokemonTemplate = {
  label: string;
  pokemonType: PokemonType;
  hp: number;
  move: string;
  fill: string;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";
type PanelMode = "pokemon" | "backgrounds";

type Interaction =
  | {
      mode: "drag";
      id: string;
      start: CanvasItem;
      offsetX: number;
      offsetY: number;
    }
  | {
      mode: "resize";
      id: string;
      start: CanvasItem;
      handle: ResizeHandle;
    }
  | {
      mode: "rotate";
      id: string;
      start: CanvasItem;
    };

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const CARD_MIN_WIDTH = 130;
const CARD_MIN_HEIGHT = 180;

const POKEMON_TYPES: Record<
  PokemonType,
  { name: string; abbr: string; color: string; soft: string; ink: string }
> = {
  fire: {
    name: "Fire",
    abbr: "F",
    color: "#f97316",
    soft: "#ffedd5",
    ink: "#7c2d12",
  },
  water: {
    name: "Water",
    abbr: "W",
    color: "#38bdf8",
    soft: "#e0f2fe",
    ink: "#075985",
  },
  grass: {
    name: "Grass",
    abbr: "G",
    color: "#22c55e",
    soft: "#dcfce7",
    ink: "#14532d",
  },
  electric: {
    name: "Electric",
    abbr: "E",
    color: "#facc15",
    soft: "#fef9c3",
    ink: "#713f12",
  },
  psychic: {
    name: "Psychic",
    abbr: "P",
    color: "#ec4899",
    soft: "#fce7f3",
    ink: "#831843",
  },
  ice: {
    name: "Ice",
    abbr: "I",
    color: "#67e8f9",
    soft: "#cffafe",
    ink: "#155e75",
  },
  fairy: {
    name: "Fairy",
    abbr: "Y",
    color: "#fb7185",
    soft: "#ffe4e6",
    ink: "#881337",
  },
};

const TYPE_LIST = Object.keys(POKEMON_TYPES) as PokemonType[];

const POKEMON_TEMPLATES: PokemonTemplate[] = [
  {
    label: "Spark Cub",
    pokemonType: "electric",
    hp: 60,
    move: "Zap Hop",
    fill: "#fef08a",
  },
  {
    label: "Sprout Pal",
    pokemonType: "grass",
    hp: 70,
    move: "Leaf Hug",
    fill: "#bbf7d0",
  },
  {
    label: "Bubble Pup",
    pokemonType: "water",
    hp: 65,
    move: "Splash Dash",
    fill: "#bae6fd",
  },
  {
    label: "Toast Tot",
    pokemonType: "fire",
    hp: 75,
    move: "Warm Wiggle",
    fill: "#fed7aa",
  },
  {
    label: "Dream Kit",
    pokemonType: "psychic",
    hp: 80,
    move: "Mind Bloom",
    fill: "#fbcfe8",
  },
  {
    label: "Snow Bean",
    pokemonType: "ice",
    hp: 55,
    move: "Frost Pop",
    fill: "#cffafe",
  },
  {
    label: "Charm Puff",
    pokemonType: "fairy",
    hp: 90,
    move: "Glitter Bop",
    fill: "#fecdd3",
  },
];

const DEFAULT_ITEMS: CanvasItem[] = [];

const SWATCHES = [
  "#fef08a",
  "#fed7aa",
  "#bae6fd",
  "#bbf7d0",
  "#fbcfe8",
  "#fecdd3",
  "#c4b5fd",
  "#ffffff",
  "#111827",
];

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function shortText(value: string, max = 15) {
  return value.length > max ? `${value.slice(0, max - 1)}.` : value;
}

function cardTitleText(label: string, width: number, fontSize: number) {
  const maxCharacters = clamp(
    Math.floor((width * 0.52) / (fontSize * 0.55)),
    5,
    14,
  );

  return shortText(label, maxCharacters);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rotatePoint(point: CanvasPoint, center: CanvasPoint, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function getItemCenter(item: CanvasItem) {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
}

function strokeColor(item: CanvasItem) {
  return item.showOutline ? "#111827" : "none";
}

function strokeWidth(item: CanvasItem, width: number | string) {
  return item.showOutline ? width : 0;
}

function svgStroke(item: CanvasItem, width: number | string) {
  return `stroke="${strokeColor(item)}" stroke-width="${strokeWidth(
    item,
    width,
  )}"`;
}

function typeMarkSvg(
  type: PokemonType,
  x: number,
  y: number,
  radius: number,
  showOutline: boolean,
) {
  const style = POKEMON_TYPES[type];

  return `
    <circle cx="${x}" cy="${y}" r="${radius}" fill="${style.color}" stroke="${
      showOutline ? "#111827" : "none"
    }" stroke-width="${showOutline ? Math.max(2, radius * 0.08) : 0}" />
    <text x="${x}" y="${y + radius * 0.36}" text-anchor="middle" font-family="Geist, Arial, sans-serif" font-size="${radius}" font-weight="900" fill="${style.ink}">${style.abbr}</text>
  `;
}

function pokemonCardSvg(item: CanvasItem) {
  const typeStyle = POKEMON_TYPES[item.pokemonType];
  const x = item.x;
  const y = item.y;
  const width = item.width;
  const height = item.height;
  const cx = x + width / 2;
  const imageTop = y + height * 0.18;
  const imageHeight = height * 0.38;
  const titleSize = clamp(width * 0.085, 15, 24);
  const hpSize = clamp(width * 0.075, 12, 22);
  const bodySize = clamp(width * 0.075, 11, 21);
  const radius = Math.min(8, width * 0.04);
  const creatureTop = imageTop + imageHeight * 0.18;
  const creatureBase = imageTop + imageHeight * 0.73;
  const hpText = `HP ${item.hp}`;
  const hpX = item.showOutline ? x + width * 0.78 : x + width * 0.08;
  const hpY = item.showOutline ? y + height * 0.103 : y + height * 0.16;
  const typeX = item.showOutline
    ? x + width * 0.88
    : hpX + hpText.length * hpSize * 0.62 + width * 0.075;
  const typeY = item.showOutline ? y + height * 0.091 : y + height * 0.146;

  return `
    ${
      item.showOutline
        ? `
          <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${item.fill}" ${svgStroke(
            item,
            4,
          )} />
          <rect x="${x + width * 0.045}" y="${y + height * 0.035}" width="${
            width * 0.91
          }" height="${height * 0.11}" rx="${Math.min(
            8,
            radius,
          )}" fill="${typeStyle.soft}" ${svgStroke(item, 2)} />
        `
        : ""
    }
    <text x="${x + width * 0.08}" y="${
      y + height * 0.105
    }" font-family="Geist, Arial, sans-serif" font-size="${titleSize}" font-weight="900" fill="#111827">${escapeXml(
      cardTitleText(item.label, width, titleSize),
    )}</text>
    <text x="${hpX}" y="${hpY}" text-anchor="${
      item.showOutline ? "end" : "start"
    }" font-family="Geist, Arial, sans-serif" font-size="${hpSize}" font-weight="900" fill="#111827">${hpText}</text>
    ${typeMarkSvg(
      item.pokemonType,
      typeX,
      typeY,
      width * 0.052,
      item.showOutline,
    )}
    ${
      item.showOutline
        ? `<rect x="${x + width * 0.08}" y="${imageTop}" width="${
            width * 0.84
          }" height="${imageHeight}" rx="${Math.min(
            8,
            radius,
          )}" fill="#ffffff" fill-opacity="0.72" ${svgStroke(item, 2)} />`
        : ""
    }
    <ellipse cx="${cx}" cy="${creatureBase}" rx="${width * 0.19}" ry="${
      imageHeight * 0.2
    }" fill="${typeStyle.color}" fill-opacity="0.22" />
    <circle cx="${cx}" cy="${creatureTop + imageHeight * 0.24}" r="${
      width * 0.15
    }" fill="${typeStyle.color}" stroke="#111827" stroke-width="3" />
    <ellipse cx="${cx - width * 0.085}" cy="${
      creatureTop + imageHeight * 0.21
    }" rx="${width * 0.055}" ry="${imageHeight * 0.12}" fill="${
      typeStyle.soft
    }" stroke="#111827" stroke-width="3" />
    <ellipse cx="${cx + width * 0.085}" cy="${
      creatureTop + imageHeight * 0.21
    }" rx="${width * 0.055}" ry="${imageHeight * 0.12}" fill="${
      typeStyle.soft
    }" stroke="#111827" stroke-width="3" />
    <circle cx="${cx - width * 0.05}" cy="${
      creatureTop + imageHeight * 0.27
    }" r="${width * 0.012}" fill="#111827" />
    <circle cx="${cx + width * 0.05}" cy="${
      creatureTop + imageHeight * 0.27
    }" r="${width * 0.012}" fill="#111827" />
    <path d="M ${cx - width * 0.045} ${
      creatureTop + imageHeight * 0.36
    } Q ${cx} ${creatureTop + imageHeight * 0.43} ${cx + width * 0.045} ${
      creatureTop + imageHeight * 0.36
    }" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" />
    ${
      item.showOutline
        ? `
          <rect x="${x + width * 0.08}" y="${y + height * 0.61}" width="${
            width * 0.84
          }" height="${height * 0.11}" rx="${Math.min(
            8,
            radius,
          )}" fill="#ffffff" fill-opacity="0.65" ${svgStroke(item, 2)} />
          <text x="${x + width * 0.12}" y="${
            y + height * 0.68
          }" font-family="Geist, Arial, sans-serif" font-size="${bodySize}" font-weight="850" fill="#111827">${escapeXml(
            shortText(item.move, 18),
          )}</text>
          <text x="${x + width * 0.12}" y="${
            y + height * 0.82
          }" font-family="Geist, Arial, sans-serif" font-size="${bodySize * 0.82}" font-weight="800" fill="#111827">${typeStyle.name} type</text>
          <rect x="${x + width * 0.12}" y="${y + height * 0.86}" width="${
            width * 0.76
          }" height="${height * 0.035}" rx="${
            height * 0.018
          }" fill="#111827" fill-opacity="0.14" />
          <rect x="${x + width * 0.12}" y="${y + height * 0.86}" width="${
            width * 0.76 * clamp(item.hp / 120, 0.1, 1)
          }" height="${height * 0.035}" rx="${
            height * 0.018
          }" fill="${typeStyle.color}" />
        `
        : ""
    }
  `;
}

function itemSvg(item: CanvasItem) {
  const center = getItemCenter(item);

  return `<g transform="rotate(${item.rotation} ${center.x} ${center.y})">${pokemonCardSvg(
    item,
  )}</g>`;
}

function exportItemsSvg(items: CanvasItem[]) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">
      ${items.map(itemSvg).join("")}
    </svg>
  `;
}

function TypeDot({ type }: { type: PokemonType }) {
  const style = POKEMON_TYPES[type];

  return (
    <span
      className="grid size-8 place-items-center rounded-full border-2 border-slate-950 text-sm font-black"
      style={{ background: style.color, color: style.ink }}
    >
      {style.abbr}
    </span>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <input
        className="h-11 rounded-lg border-2 border-slate-200 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-slate-950"
        max={max}
        min={min}
        type="number"
        value={Math.round(value)}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
    </label>
  );
}

function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";

  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}.`));
    image.src = src;
  });
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
) {
  const scale = Math.max(
    CANVAS_WIDTH / image.naturalWidth,
    CANVAS_HEIGHT / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = (CANVAS_HEIGHT - height) / 2;

  context.drawImage(image, x, y, width, height);
}

function drawDotGrid(context: CanvasRenderingContext2D) {
  context.fillStyle = "rgba(148, 163, 184, 0.62)";

  for (let x = 1.5; x < CANVAS_WIDTH; x += 32) {
    for (let y = 1.5; y < CANVAS_HEIGHT; y += 32) {
      context.beginPath();
      context.arc(x, y, 1.5, 0, Math.PI * 2);
      context.fill();
    }
  }
}

export function CanvasEditor({
  backgrounds,
}: {
  backgrounds: CanvasBackground[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [items, setItems] = useState<CanvasItem[]>(DEFAULT_ITEMS);
  const [selectedId, setSelectedId] = useState("");
  const [settingsCardId, setSettingsCardId] = useState("");
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [activePanel, setActivePanel] = useState<PanelMode>("pokemon");
  const [activeType, setActiveType] = useState<PokemonType>("electric");
  const [selectedBackgroundSrc, setSelectedBackgroundSrc] = useState("");
  const [showGrid, setShowGrid] = useState(true);
  const [exportScale, setExportScale] = useState(2);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const selectedBackground = useMemo(
    () =>
      backgrounds.find((background) => background.src === selectedBackgroundSrc) ??
      null,
    [backgrounds, selectedBackgroundSrc],
  );

  const filteredPokemon = useMemo(
    () =>
      POKEMON_TEMPLATES.filter(
        (template) => template.pokemonType === activeType,
      ),
    [activeType],
  );

  const settingsOpen = selectedItem?.id === settingsCardId;

  function toCanvasPoint(event: PointerEvent | ReactPointerEvent): CanvasPoint {
    const svg = svgRef.current;

    if (!svg) {
      return { x: 0, y: 0 };
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return { x: 0, y: 0 };
    }

    const transformed = point.matrixTransform(matrix.inverse());

    return {
      x: transformed.x,
      y: transformed.y,
    };
  }

  function updateItem(id: string, patch: Partial<CanvasItem>) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  function addPokemon(template: PokemonTemplate) {
    const offset = (items.length % 5) * 48;
    const newItem: CanvasItem = {
      id: makeId(),
      label: template.label,
      pokemonType: template.pokemonType,
      hp: template.hp,
      move: template.move,
      x: 610 + offset,
      y: 235 + offset,
      width: 300,
      height: 410,
      rotation: 0,
      fill: template.fill,
      showOutline: true,
    };

    setItems((currentItems) => [...currentItems, newItem]);
    setSelectedId(newItem.id);
    setSettingsCardId(newItem.id);
  }

  function toggleSettingsForItem(id: string) {
    setSelectedId(id);
    setSettingsCardId((currentId) => (currentId === id ? "" : id));
  }

  function beginDrag(event: ReactPointerEvent<SVGGElement>, item: CanvasItem) {
    event.stopPropagation();
    const point = toCanvasPoint(event);

    setSelectedId(item.id);
    setInteraction({
      mode: "drag",
      id: item.id,
      start: item,
      offsetX: point.x - item.x,
      offsetY: point.y - item.y,
    });
  }

  function beginResize(
    event: ReactPointerEvent<SVGCircleElement>,
    item: CanvasItem,
    handle: ResizeHandle,
  ) {
    event.stopPropagation();
    setSelectedId(item.id);
    setInteraction({
      mode: "resize",
      id: item.id,
      start: item,
      handle,
    });
  }

  function beginRotate(
    event: ReactPointerEvent<SVGCircleElement>,
    item: CanvasItem,
  ) {
    event.stopPropagation();
    setSelectedId(item.id);
    setInteraction({
      mode: "rotate",
      id: item.id,
      start: item,
    });
  }

  function duplicateSelected() {
    if (!selectedItem) {
      return;
    }

    const copy = {
      ...selectedItem,
      id: makeId(),
      x: selectedItem.x + 44,
      y: selectedItem.y + 44,
      label: `${selectedItem.label} Copy`,
    };

    setItems((currentItems) => [...currentItems, copy]);
    setSelectedId(copy.id);
    setSettingsCardId(copy.id);
  }

  function deleteSelected() {
    if (!selectedItem) {
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== selectedItem.id),
    );
    setSelectedId("");
    setSettingsCardId("");
  }

  function bringForward() {
    if (!selectedItem) {
      return;
    }

    setItems((currentItems) => {
      const index = currentItems.findIndex((item) => item.id === selectedItem.id);

      if (index === -1 || index === currentItems.length - 1) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(index + 1, 0, item);

      return nextItems;
    });
  }

  function sendBackward() {
    if (!selectedItem) {
      return;
    }

    setItems((currentItems) => {
      const index = currentItems.findIndex((item) => item.id === selectedItem.id);

      if (index <= 0) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(index - 1, 0, item);

      return nextItems;
    });
  }

  async function downloadPng() {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH * exportScale;
    canvas.height = CANVAS_HEIGHT * exportScale;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.scale(exportScale, exportScale);

    if (selectedBackground) {
      const backgroundImage = await loadImage(selectedBackground.src);
      drawCoverImage(context, backgroundImage);
    } else {
      context.fillStyle = "#fbfcff";
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (showGrid) {
      drawDotGrid(context);
    }

    const itemSvgBlob = new Blob([exportItemsSvg(items)], {
      type: "image/svg+xml",
    });
    const itemSvgUrl = URL.createObjectURL(itemSvgBlob);
    const itemImage = await loadImage(itemSvgUrl);
    context.drawImage(itemImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    URL.revokeObjectURL(itemSvgUrl);

    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `pokemon-canvas-${CANVAS_WIDTH * exportScale}x${
        CANVAS_HEIGHT * exportScale
      }.png`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    }, "image/png");
  }

  useEffect(() => {
    if (!interaction) {
      return;
    }

    const activeInteraction = interaction;

    function handlePointerMove(event: PointerEvent) {
      const point = toCanvasPoint(event);

      if (activeInteraction.mode === "drag") {
        const nextX = clamp(
          point.x - activeInteraction.offsetX,
          -activeInteraction.start.width * 0.7,
          CANVAS_WIDTH - activeInteraction.start.width * 0.3,
        );
        const nextY = clamp(
          point.y - activeInteraction.offsetY,
          -activeInteraction.start.height * 0.7,
          CANVAS_HEIGHT - activeInteraction.start.height * 0.3,
        );

        updateItem(activeInteraction.id, {
          x: nextX,
          y: nextY,
        });
      }

      if (activeInteraction.mode === "resize") {
        const start = activeInteraction.start;
        const center = getItemCenter(start);
        const localPoint = rotatePoint(point, center, -start.rotation);
        const right = start.x + start.width;
        const bottom = start.y + start.height;
        let nextX = start.x;
        let nextY = start.y;
        let nextWidth = start.width;
        let nextHeight = start.height;

        if (activeInteraction.handle.includes("e")) {
          nextWidth = clamp(
            localPoint.x - start.x,
            CARD_MIN_WIDTH,
            CANVAS_WIDTH * 1.3,
          );
        }

        if (activeInteraction.handle.includes("s")) {
          nextHeight = clamp(
            localPoint.y - start.y,
            CARD_MIN_HEIGHT,
            CANVAS_HEIGHT * 1.3,
          );
        }

        if (activeInteraction.handle.includes("w")) {
          nextWidth = clamp(
            right - localPoint.x,
            CARD_MIN_WIDTH,
            CANVAS_WIDTH * 1.3,
          );
          nextX = right - nextWidth;
        }

        if (activeInteraction.handle.includes("n")) {
          nextHeight = clamp(
            bottom - localPoint.y,
            CARD_MIN_HEIGHT,
            CANVAS_HEIGHT * 1.3,
          );
          nextY = bottom - nextHeight;
        }

        updateItem(activeInteraction.id, {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        });
      }

      if (activeInteraction.mode === "rotate") {
        const center = getItemCenter(activeInteraction.start);
        const angle =
          (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI +
          90;

        updateItem(activeInteraction.id, {
          rotation: Math.round(angle),
        });
      }
    }

    function handlePointerUp() {
      setInteraction(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [interaction]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        deleteSelected();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-950">
      <div className="absolute inset-0 p-3 md:p-5">
        <svg
          ref={svgRef}
          aria-label="Image canvas"
          className="h-full w-full rounded-lg border-2 border-slate-200 bg-white shadow-sm"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        >
          <defs>
            <pattern
              id="dot-grid"
              height="32"
              patternUnits="userSpaceOnUse"
              width="32"
            >
              <circle cx="1.5" cy="1.5" fill="#94a3b8" opacity="0.62" r="1.5" />
            </pattern>
          </defs>
          <rect
            fill="#fbfcff"
            height={CANVAS_HEIGHT}
            width={CANVAS_WIDTH}
            x={0}
            y={0}
            onPointerDown={() => setSelectedId("")}
          />
          {selectedBackground ? (
            <image
              height={CANVAS_HEIGHT}
              href={selectedBackground.src}
              preserveAspectRatio="xMidYMid slice"
              width={CANVAS_WIDTH}
              x={0}
              y={0}
              onPointerDown={() => setSelectedId("")}
            />
          ) : null}
          {showGrid ? (
            <rect
              fill="url(#dot-grid)"
              height={CANVAS_HEIGHT}
              pointerEvents="none"
              width={CANVAS_WIDTH}
              x={0}
              y={0}
            />
          ) : null}

          {items.map((item) => {
            const center = getItemCenter(item);
            const isSelected = item.id === selectedId;
            const handlePoints: { key: ResizeHandle; x: number; y: number }[] = [
              { key: "nw", x: item.x, y: item.y },
              { key: "ne", x: item.x + item.width, y: item.y },
              { key: "sw", x: item.x, y: item.y + item.height },
              {
                key: "se",
                x: item.x + item.width,
                y: item.y + item.height,
              },
            ];

            return (
              <g key={item.id}>
                <g
                  className="cursor-grab active:cursor-grabbing"
                  transform={`rotate(${item.rotation} ${center.x} ${center.y})`}
                  onPointerDown={(event) => beginDrag(event, item)}
                >
                  <PokemonCard item={item} />
                </g>

                {isSelected ? (
                  <g
                    transform={`rotate(${item.rotation} ${center.x} ${center.y})`}
                  >
                    <rect
                      fill="none"
                      height={item.height}
                      pointerEvents="none"
                      stroke="#2563eb"
                      strokeDasharray="12 10"
                      strokeWidth="4"
                      width={item.width}
                      x={item.x}
                      y={item.y}
                    />
                    <line
                      stroke="#2563eb"
                      strokeWidth="4"
                      x1={center.x}
                      x2={center.x}
                      y1={item.y}
                      y2={item.y - 48}
                    />
                    <circle
                      className="cursor-grab"
                      cx={center.x}
                      cy={item.y - 58}
                      fill="#ffffff"
                      r="15"
                      stroke="#2563eb"
                      strokeWidth="5"
                      onPointerDown={(event) => beginRotate(event, item)}
                    />
                    {handlePoints.map((handle) => (
                      <circle
                        key={handle.key}
                        className="cursor-nwse-resize"
                        cx={handle.x}
                        cy={handle.y}
                        fill="#ffffff"
                        r="13"
                        stroke="#2563eb"
                        strokeWidth="5"
                        onPointerDown={(event) =>
                          beginResize(event, item, handle.key)
                        }
                      />
                    ))}
                    <g
                      aria-label={`${item.label} settings`}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        toggleSettingsForItem(item.id);
                      }}
                    >
                      <rect
                        fill={settingsOpen ? "#020617" : "#ffffff"}
                        height="52"
                        rx="8"
                        stroke="#020617"
                        strokeWidth="4"
                        width="52"
                        x={item.x + item.width - 18}
                        y={item.y - 76}
                      />
                      <Settings
                        aria-hidden="true"
                        color={settingsOpen ? "#ffffff" : "#020617"}
                        height="26"
                        strokeWidth={3}
                        width="26"
                        x={item.x + item.width - 5}
                        y={item.y - 63}
                      />
                    </g>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="absolute left-4 top-4 z-10 flex max-h-[calc(100vh-2rem)] w-[min(21rem,calc(100vw-2rem))] flex-col gap-3 overflow-auto rounded-lg border-2 border-slate-950 bg-white/95 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur md:left-6 md:top-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">Canvas Camp</h1>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {CANVAS_WIDTH} x {CANVAS_HEIGHT}
            </p>
          </div>
          <button
            className="grid size-11 place-items-center rounded-lg border-2 border-slate-200 bg-slate-50 text-slate-950 transition hover:border-slate-950"
            title="Select"
            type="button"
            onClick={() => setSelectedId(selectedItem?.id ?? "")}
          >
            <MousePointer2 aria-hidden="true" size={22} strokeWidth={2.8} />
            <span className="sr-only">Select</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(["pokemon", "backgrounds"] as PanelMode[]).map((panel) => (
            <button
              key={panel}
              className={`h-11 rounded-md text-sm font-black transition ${
                activePanel === panel
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
              type="button"
              onClick={() => setActivePanel(panel)}
            >
              {panel === "pokemon" ? "Pokemon" : "Backgrounds"}
            </button>
          ))}
        </div>

        {activePanel === "pokemon" ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_LIST.map((type) => {
                const style = POKEMON_TYPES[type];

                return (
                  <button
                    key={type}
                    className={`flex h-14 items-center justify-center rounded-lg border-2 text-sm font-black transition ${
                      activeType === type
                        ? "border-slate-950"
                        : "border-transparent hover:border-slate-300"
                    }`}
                    style={{ background: style.soft, color: style.ink }}
                    type="button"
                    onClick={() => setActiveType(type)}
                  >
                    {style.abbr}
                    <span className="sr-only">{style.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2">
              {filteredPokemon.map((template) => (
                <button
                  key={template.label}
                  className="grid min-h-20 grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-lg border-2 border-slate-200 bg-white p-3 text-left transition hover:border-slate-950 hover:bg-slate-50"
                  type="button"
                  onClick={() => addPokemon(template)}
                >
                  <TypeDot type={template.pokemonType} />
                  <span>
                    <span className="block text-base font-black leading-tight">
                      {template.label}
                    </span>
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      HP {template.hp}
                    </span>
                  </span>
                  <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-black text-white">
                    Add
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <button
              className={`grid min-h-24 grid-cols-[4.5rem_1fr] items-center gap-3 rounded-lg border-2 bg-white p-2 text-left transition hover:border-slate-950 ${
                !selectedBackgroundSrc ? "border-slate-950" : "border-slate-200"
              }`}
              type="button"
              onClick={() => setSelectedBackgroundSrc("")}
            >
              <span className="grid aspect-video place-items-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50">
                <ImageIcon aria-hidden="true" size={22} strokeWidth={2.8} />
              </span>
              <span className="text-base font-black">Blank</span>
            </button>

            {backgrounds.map((background) => (
              <button
                key={background.src}
                className={`grid min-h-24 grid-cols-[4.5rem_1fr] items-center gap-3 rounded-lg border-2 bg-white p-2 text-left transition hover:border-slate-950 ${
                  selectedBackgroundSrc === background.src
                    ? "border-slate-950"
                    : "border-slate-200"
                }`}
                type="button"
                onClick={() => setSelectedBackgroundSrc(background.src)}
              >
                <NextImage
                  alt=""
                  className="aspect-video w-full rounded-md border border-slate-200 object-cover"
                  height={81}
                  src={background.src}
                  width={144}
                />
                <span className="text-base font-black">{background.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="absolute right-4 top-4 z-10 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border-2 border-slate-950 bg-white/95 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.16)] backdrop-blur md:right-6 md:top-6">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">Settings</h2>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {selectedItem ? selectedItem.label : "None"}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              className="grid size-10 place-items-center rounded-lg border-2 border-slate-200 bg-white transition hover:border-slate-950 disabled:opacity-40"
              disabled={!selectedItem}
              title="Copy"
              type="button"
              onClick={duplicateSelected}
            >
              <Copy aria-hidden="true" size={18} strokeWidth={2.8} />
              <span className="sr-only">Copy</span>
            </button>
            <button
              className="grid size-10 place-items-center rounded-lg border-2 border-slate-200 bg-white transition hover:border-red-500 hover:text-red-600 disabled:opacity-40"
              disabled={!selectedItem}
              title="Delete"
              type="button"
              onClick={deleteSelected}
            >
              <Trash2 aria-hidden="true" size={18} strokeWidth={2.8} />
              <span className="sr-only">Delete</span>
            </button>
          </div>
        </div>

        <button
          className={`flex h-11 items-center justify-center gap-2 rounded-lg border-2 text-sm font-black transition disabled:opacity-40 ${
            settingsOpen
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-950 hover:border-slate-950"
          }`}
          disabled={!selectedItem}
          type="button"
          onClick={() => selectedItem && toggleSettingsForItem(selectedItem.id)}
        >
          <Settings aria-hidden="true" size={18} strokeWidth={2.8} />
          {settingsOpen ? "Close settings" : "Open settings"}
        </button>

        {selectedItem && settingsOpen ? (
          <>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
              <span>Name</span>
              <input
                className="h-11 rounded-lg border-2 border-slate-200 bg-white px-3 text-base font-black normal-case tracking-normal text-slate-950 outline-none transition focus:border-slate-950"
                value={selectedItem.label}
                onChange={(event) =>
                  updateItem(selectedItem.id, { label: event.target.value })
                }
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="W"
                max={900}
                min={CARD_MIN_WIDTH}
                value={selectedItem.width}
                onChange={(value) =>
                  updateItem(selectedItem.id, { width: value })
                }
              />
              <NumberField
                label="H"
                max={900}
                min={CARD_MIN_HEIGHT}
                value={selectedItem.height}
                onChange={(value) =>
                  updateItem(selectedItem.id, { height: value })
                }
              />
              <NumberField
                label="Turn"
                max={360}
                min={-360}
                value={selectedItem.rotation}
                onChange={(value) =>
                  updateItem(selectedItem.id, { rotation: value })
                }
              />
            </div>

            <div className="grid grid-cols-[1fr_1.3fr] gap-2">
              <NumberField
                label="HP"
                max={999}
                min={10}
                value={selectedItem.hp}
                onChange={(value) => updateItem(selectedItem.id, { hp: value })}
              />
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                <span>Move</span>
                <input
                  className="h-11 rounded-lg border-2 border-slate-200 bg-white px-3 text-base font-black normal-case tracking-normal text-slate-950 outline-none transition focus:border-slate-950"
                  value={selectedItem.move}
                  onChange={(event) =>
                    updateItem(selectedItem.id, { move: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {TYPE_LIST.map((type) => {
                const style = POKEMON_TYPES[type];

                return (
                  <button
                    key={type}
                    className={`flex h-12 items-center justify-center rounded-lg border-2 text-sm font-black transition ${
                      selectedItem.pokemonType === type
                        ? "border-slate-950"
                        : "border-transparent hover:border-slate-300"
                    }`}
                    style={{ background: style.soft, color: style.ink }}
                    type="button"
                    onClick={() =>
                      updateItem(selectedItem.id, { pokemonType: type })
                    }
                  >
                    {style.abbr}
                    <span className="sr-only">{style.name}</span>
                  </button>
                );
              })}
            </div>

            <button
              aria-pressed={selectedItem.showOutline}
              className={`flex h-11 items-center justify-between rounded-lg border-2 px-3 text-sm font-black transition ${
                selectedItem.showOutline
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950 hover:border-slate-950"
              }`}
              type="button"
              onClick={() =>
                updateItem(selectedItem.id, {
                  showOutline: !selectedItem.showOutline,
                })
              }
            >
              <span>Outline</span>
              <span>{selectedItem.showOutline ? "On" : "Off"}</span>
            </button>

            <div className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Color
              </span>
              <div className="grid grid-cols-[repeat(9,1fr)] gap-1">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    aria-label={`Color ${swatch}`}
                    className={`aspect-square rounded-md border-2 transition ${
                      selectedItem.fill === swatch
                        ? "border-slate-950"
                        : "border-slate-200 hover:border-slate-500"
                    }`}
                    style={{ background: swatch }}
                    type="button"
                    onClick={() => updateItem(selectedItem.id, { fill: swatch })}
                  />
                ))}
              </div>
              <input
                aria-label="Custom color"
                className="h-10 w-full rounded-lg border-2 border-slate-200 bg-white p-1"
                type="color"
                value={selectedItem.fill}
                onChange={(event) =>
                  updateItem(selectedItem.id, { fill: event.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white text-sm font-black transition hover:border-slate-950"
                title="Send backward"
                type="button"
                onClick={sendBackward}
              >
                <SendToBack aria-hidden="true" size={18} strokeWidth={2.8} />
                Back
              </button>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white text-sm font-black transition hover:border-slate-950"
                title="Bring forward"
                type="button"
                onClick={bringForward}
              >
                <BringToFront aria-hidden="true" size={18} strokeWidth={2.8} />
                Front
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-black text-slate-500">
            {selectedItem ? "Settings closed" : "Nothing selected"}
          </div>
        )}
      </section>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border-2 border-slate-950 bg-white/95 p-2 shadow-[0_14px_40px_rgba(15,23,42,0.16)] backdrop-blur md:bottom-6">
        <button
          className={`grid size-11 place-items-center rounded-lg border-2 transition ${
            showGrid
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-950 hover:border-slate-950"
          }`}
          title="Grid"
          type="button"
          onClick={() => setShowGrid((current) => !current)}
        >
          <Grid3X3 aria-hidden="true" size={20} strokeWidth={2.8} />
          <span className="sr-only">Grid</span>
        </button>

        <div className="flex rounded-lg bg-slate-100 p-1">
          {[1, 2, 4].map((scale) => (
            <button
              key={scale}
              className={`h-9 w-11 rounded-md text-sm font-black transition ${
                exportScale === scale
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
              type="button"
              onClick={() => setExportScale(scale)}
            >
              {scale}x
            </button>
          ))}
        </div>

        <button
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-blue-700"
          type="button"
          onClick={downloadPng}
        >
          <Download aria-hidden="true" size={18} strokeWidth={2.8} />
          PNG
        </button>
        <div className="hidden items-center gap-1 pl-1 text-xs font-black uppercase tracking-wide text-slate-500 md:flex">
          <Layers aria-hidden="true" size={15} strokeWidth={2.6} />
          {items.length}
        </div>
      </div>
    </main>
  );
}

function PokemonCard({ item }: { item: CanvasItem }) {
  const typeStyle = POKEMON_TYPES[item.pokemonType];
  const titleSize = clamp(item.width * 0.085, 15, 24);
  const hpSize = clamp(item.width * 0.075, 12, 22);
  const bodySize = clamp(item.width * 0.075, 11, 21);
  const imageTop = item.y + item.height * 0.18;
  const imageHeight = item.height * 0.38;
  const centerX = item.x + item.width / 2;
  const creatureTop = imageTop + imageHeight * 0.18;
  const creatureBase = imageTop + imageHeight * 0.73;
  const radius = Math.min(8, item.width * 0.04);
  const hpText = `HP ${item.hp}`;
  const hpX = item.showOutline
    ? item.x + item.width * 0.78
    : item.x + item.width * 0.08;
  const hpY = item.showOutline
    ? item.y + item.height * 0.103
    : item.y + item.height * 0.16;
  const typeX = item.showOutline
    ? item.x + item.width * 0.88
    : hpX + hpText.length * hpSize * 0.62 + item.width * 0.075;
  const typeY = item.showOutline
    ? item.y + item.height * 0.091
    : item.y + item.height * 0.146;

  return (
    <>
      {item.showOutline ? (
        <>
          <rect
            fill={item.fill}
            height={item.height}
            rx={radius}
            stroke={strokeColor(item)}
            strokeWidth={strokeWidth(item, 4)}
            width={item.width}
            x={item.x}
            y={item.y}
          />
          <rect
            fill={typeStyle.soft}
            height={item.height * 0.11}
            rx={Math.min(8, radius)}
            stroke={strokeColor(item)}
            strokeWidth={strokeWidth(item, 2)}
            width={item.width * 0.91}
            x={item.x + item.width * 0.045}
            y={item.y + item.height * 0.035}
          />
        </>
      ) : null}
      <text
        fill="#111827"
        fontFamily="Geist, Arial, sans-serif"
        fontSize={titleSize}
        fontWeight="900"
        x={item.x + item.width * 0.08}
        y={item.y + item.height * 0.105}
      >
        {cardTitleText(item.label, item.width, titleSize)}
      </text>
      <text
        fill="#111827"
        fontFamily="Geist, Arial, sans-serif"
        fontSize={hpSize}
        fontWeight="900"
        textAnchor={item.showOutline ? "end" : "start"}
        x={hpX}
        y={hpY}
      >
        {hpText}
      </text>
      <TypeMark
        radius={item.width * 0.052}
        showOutline={item.showOutline}
        type={item.pokemonType}
        x={typeX}
        y={typeY}
      />
      {item.showOutline ? (
        <rect
          fill="#ffffff"
          fillOpacity="0.72"
          height={imageHeight}
          rx={Math.min(8, radius)}
          stroke={strokeColor(item)}
          strokeWidth={strokeWidth(item, 2)}
          width={item.width * 0.84}
          x={item.x + item.width * 0.08}
          y={imageTop}
        />
      ) : null}
      <ellipse
        cx={centerX}
        cy={creatureBase}
        fill={typeStyle.color}
        fillOpacity="0.22"
        rx={item.width * 0.19}
        ry={imageHeight * 0.2}
      />
      <circle
        cx={centerX}
        cy={creatureTop + imageHeight * 0.24}
        fill={typeStyle.color}
        r={item.width * 0.15}
        stroke="#111827"
        strokeWidth="3"
      />
      <ellipse
        cx={centerX - item.width * 0.085}
        cy={creatureTop + imageHeight * 0.21}
        fill={typeStyle.soft}
        rx={item.width * 0.055}
        ry={imageHeight * 0.12}
        stroke="#111827"
        strokeWidth="3"
      />
      <ellipse
        cx={centerX + item.width * 0.085}
        cy={creatureTop + imageHeight * 0.21}
        fill={typeStyle.soft}
        rx={item.width * 0.055}
        ry={imageHeight * 0.12}
        stroke="#111827"
        strokeWidth="3"
      />
      <circle
        cx={centerX - item.width * 0.05}
        cy={creatureTop + imageHeight * 0.27}
        fill="#111827"
        r={item.width * 0.012}
      />
      <circle
        cx={centerX + item.width * 0.05}
        cy={creatureTop + imageHeight * 0.27}
        fill="#111827"
        r={item.width * 0.012}
      />
      <path
        d={`M ${centerX - item.width * 0.045} ${
          creatureTop + imageHeight * 0.36
        } Q ${centerX} ${creatureTop + imageHeight * 0.43} ${
          centerX + item.width * 0.045
        } ${creatureTop + imageHeight * 0.36}`}
        fill="none"
        stroke="#111827"
        strokeLinecap="round"
        strokeWidth="3"
      />
      {item.showOutline ? (
        <>
          <rect
            fill="#ffffff"
            fillOpacity="0.65"
            height={item.height * 0.11}
            rx={Math.min(8, radius)}
            stroke={strokeColor(item)}
            strokeWidth={strokeWidth(item, 2)}
            width={item.width * 0.84}
            x={item.x + item.width * 0.08}
            y={item.y + item.height * 0.61}
          />
          <text
            fill="#111827"
            fontFamily="Geist, Arial, sans-serif"
            fontSize={bodySize}
            fontWeight="850"
            x={item.x + item.width * 0.12}
            y={item.y + item.height * 0.68}
          >
            {shortText(item.move, 18)}
          </text>
          <text
            fill="#111827"
            fontFamily="Geist, Arial, sans-serif"
            fontSize={bodySize * 0.82}
            fontWeight="800"
            x={item.x + item.width * 0.12}
            y={item.y + item.height * 0.82}
          >
            {typeStyle.name} type
          </text>
          <rect
            fill="#111827"
            fillOpacity="0.14"
            height={item.height * 0.035}
            rx={item.height * 0.018}
            width={item.width * 0.76}
            x={item.x + item.width * 0.12}
            y={item.y + item.height * 0.86}
          />
          <rect
            fill={typeStyle.color}
            height={item.height * 0.035}
            rx={item.height * 0.018}
            width={item.width * 0.76 * clamp(item.hp / 120, 0.1, 1)}
            x={item.x + item.width * 0.12}
            y={item.y + item.height * 0.86}
          />
        </>
      ) : null}
    </>
  );
}

function TypeMark({
  type,
  x,
  y,
  radius,
  showOutline,
}: {
  type: PokemonType;
  x: number;
  y: number;
  radius: number;
  showOutline: boolean;
}) {
  const style = POKEMON_TYPES[type];

  return (
    <>
      <circle
        cx={x}
        cy={y}
        fill={style.color}
        r={radius}
        stroke={showOutline ? "#111827" : "none"}
        strokeWidth={showOutline ? Math.max(2, radius * 0.08) : 0}
      />
      <text
        fill={style.ink}
        fontFamily="Geist, Arial, sans-serif"
        fontSize={radius}
        fontWeight="900"
        textAnchor="middle"
        x={x}
        y={y + radius * 0.36}
      >
        {style.abbr}
      </text>
    </>
  );
}
