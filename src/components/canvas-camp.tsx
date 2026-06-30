"use client";

import { useState } from "react";
import Link from "next/link";

// ── Constants ────────────────────────────────────────────
const INK = "#2B2622";
const ZONE_BASE = "#ECE6DD";

const TYPES = [
  { id: "electric", label: "Electric", color: "#E0B458" },
  { id: "fire",     label: "Fire",     color: "#D98361" },
  { id: "water",    label: "Water",    color: "#74A8C9" },
  { id: "grass",    label: "Grass",    color: "#84A877" },
  { id: "normal",   label: "Normal",   color: "#B0A89E" },
  { id: "psychic",  label: "Psychic",  color: "#CC85A6" },
  { id: "dragon",   label: "Dragon",   color: "#9189C4" },
  { id: "ghost",    label: "Ghost",    color: "#8A7DB8" },
  { id: "fighting", label: "Fighting", color: "#C16A63" },
  { id: "flying",   label: "Flying",   color: "#8FA9CE" },
  { id: "ice",      label: "Ice",      color: "#93C6CC" },
  { id: "fairy",    label: "Fairy",    color: "#D993A0" },
];

const CREATURES: Record<string, string[]> = {
  electric: ["Pikachu", "Raichu", "Jolteon"],
  fire:     ["Charmander", "Charizard", "Vulpix", "Arcanine"],
  water:    ["Squirtle", "Psyduck", "Lapras", "Gyarados"],
  grass:    ["Bulbasaur", "Chikorita", "Treecko"],
  normal:   ["Eevee", "Snorlax", "Jigglypuff"],
  psychic:  ["Mewtwo", "Mew", "Alakazam"],
  dragon:   ["Dragonite", "Rayquaza", "Garchomp"],
  ghost:    ["Gengar", "Mimikyu", "Decidueye"],
  fighting: ["Lucario", "Machamp"],
  flying:   ["Pidgeot", "Lugia", "Togekiss"],
  ice:      ["Articuno", "Glaceon"],
  fairy:    ["Sylveon", "Clefairy", "Gardevoir"],
};

const POSES = [
  { id: "portrait",  label: "Portrait" },
  { id: "sitting",   label: "Sitting" },
  { id: "leaping",   label: "Leaping" },
  { id: "curious",   label: "Curious" },
  { id: "hero",      label: "Hero stance" },
  { id: "sleeping",  label: "Sleeping" },
  { id: "waving",    label: "Waving" },
  { id: "battle",    label: "Battle ready" },
];

const POSE_T: Record<string, string> = {
  portrait:  "none",
  sitting:   "translateY(7%) scaleY(.9)",
  leaping:   "rotate(-18deg)",
  curious:   "rotate(9deg)",
  hero:      "scale(1.08)",
  sleeping:  "rotate(90deg) scale(.8)",
  waving:    "rotate(-9deg)",
  battle:    "rotate(-13deg) scale(1.04)",
};

const SWATCHES = [
  "#2B2622", "#6E655C", "#B0A89E", "#E8E1D6",
  "#E0B458", "#C39466", "#D98361", "#C16A63",
  "#D993A0", "#CC85A6", "#A98BC0", "#9189C4",
  "#8FA9CE", "#74A8C9", "#93C6CC", "#84A877",
];

const BACKGROUNDS = [
  { id: "meadow", label: "Meadow", tint: "#E7EEDF" },
  { id: "dusk",   label: "Dusk",   tint: "#EAE2EE" },
  { id: "shore",  label: "Shore",  tint: "#DEEAEF" },
  { id: "ember",  label: "Ember",  tint: "#F2E6DB" },
  { id: "studio", label: "Studio", tint: "#F1ECE4" },
];

const STEPS = [
  { label: "Choose",  eyebrow: "Roster",   title: "Pick your creature",  caption: "Browse the camp roster and choose who you want to bring to life on paper." },
  { label: "Pose",    eyebrow: "Line art", title: "Set the pose",         caption: "Each pose becomes a fresh line-art sheet, clean and ready to color." },
  { label: "Color",   eyebrow: "Studio",   title: "Color the line art",   caption: "Pick a swatch, then tap a region to fill it. There is no wrong way to do this." },
  { label: "Details", eyebrow: "Card",     title: "Design the card",      caption: "Name the moves and watch your collectible card quietly assemble itself." },
  { label: "Mint",    eyebrow: "Finish",   title: "Mint & share",         caption: "Save the finished card to your camp gallery and share it with friends." },
];

const VARIANTS = [
  { id: "A", label: "Atelier" },
  { id: "B", label: "Console" },
  { id: "C", label: "Stage" },
];

// ── Helpers ──────────────────────────────────────────────
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * amt);
  return "#" + [m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

function hashNum(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
}

function calcHp(name: string): number {
  let h = 60;
  for (const ch of name) h += ch.charCodeAt(0);
  return (h % 12) * 10 + 70;
}

function moveCode(s: string): number {
  let n = 10;
  for (const ch of s) n += ch.charCodeAt(0);
  return (n % 9) * 10 + 30;
}

function getTypeColor(id: string): string {
  return TYPES.find(t => t.id === id)?.color ?? "#B0A89E";
}

function getTypeLabel(id: string): string {
  return TYPES.find(t => t.id === id)?.label ?? "Normal";
}

function getBgTint(id: string): string {
  return BACKGROUNDS.find(b => b.id === id)?.tint ?? "#F1ECE4";
}

// ── Creature Art ─────────────────────────────────────────
type ZoneKey = "z1" | "z2" | "z3" | "z4" | "z5" | "z6";

interface ArtProps {
  zf: (k: ZoneKey) => string;
  transform?: string;
  size?: string;
  onFill?: (k: ZoneKey) => void;
}

function CreatureArt({ zf, transform = "none", size = "72%", onFill }: ArtProps) {
  const interactive = Boolean(onFill);
  const cs = interactive ? "pointer" : "default";
  const onClick = (k: ZoneKey) => onFill?.(k);
  return (
    <div style={{ position: "relative", width: size, aspectRatio: "1", transform }}>
      <div onClick={() => onClick("z2")} style={{ position: "absolute", left: "24%", top: "-1%", width: "14%", height: "25%", borderRadius: "60% 60% 22% 22%", transform: "rotate(-17deg)", background: zf("z2"), border: `1.5px solid ${INK}`, cursor: cs }} />
      <div onClick={() => onClick("z3")} style={{ position: "absolute", left: "62%", top: "-1%", width: "14%", height: "25%", borderRadius: "60% 60% 22% 22%", transform: "rotate(17deg)",  background: zf("z3"), border: `1.5px solid ${INK}`, cursor: cs }} />
      <div onClick={() => onClick("z4")} style={{ position: "absolute", left: "25%", top: "38%", width: "50%", height: "50%", borderRadius: "46% 46% 42% 42%", background: zf("z4"), border: `1.5px solid ${INK}`, cursor: cs }} />
      <div onClick={() => onClick("z1")} style={{ position: "absolute", left: "29%", top: "6%",  width: "42%", height: "42%", borderRadius: "48% 48% 42% 42%", background: zf("z1"), border: `1.5px solid ${INK}`, cursor: cs }} />
      <div onClick={() => onClick("z5")} style={{ position: "absolute", left: "29%", top: "80%", width: "17%", height: "16%", borderRadius: "50%", background: zf("z5"), border: `1.5px solid ${INK}`, cursor: cs }} />
      <div onClick={() => onClick("z6")} style={{ position: "absolute", left: "54%", top: "80%", width: "17%", height: "16%", borderRadius: "50%", background: zf("z6"), border: `1.5px solid ${INK}`, cursor: cs }} />
      <div style={{ position: "absolute", left: "40%", top: "21%", width: "6%", height: "7%", borderRadius: "50%", background: INK, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "54%", top: "21%", width: "6%", height: "7%", borderRadius: "50%", background: INK, pointerEvents: "none" }} />
    </div>
  );
}

// ── Card component (reused in Details, Mint, Gallery) ─────
interface CardProps {
  name: string;
  bgTint: string;
  zf: (k: ZoneKey) => string;
  typeColor: string;
  move1: string; dmg1: number;
  move2: string; dmg2: number;
  stageText: string;
  hpText: number;
  poseLabel: string;
  cardNo: string;
  width?: number;
}

function PokemonCard({ name, bgTint, zf, typeColor: tc, move1, dmg1, move2, dmg2, stageText, hpText, poseLabel, cardNo, width = 316 }: CardProps) {
  const fontSize = width < 200 ? "clamp(10px,2.5vw,14px)" : undefined;
  return (
    <div style={{ width, aspectRatio: "63/88", borderRadius: 22, padding: 10, background: "linear-gradient(160deg,#FCF8F1,#F3EADC)", border: "1px solid rgba(43,38,34,.12)", boxShadow: "0 18px 44px rgba(43,38,34,.16)", display: "flex", flexDirection: "column", fontSize }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, border: "1px solid rgba(43,38,34,.1)", borderRadius: 16, background: "#FBF6EE", padding: 13, gap: 11 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-space-mono, 'Space Mono', monospace)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#A99F92" }}>{stageText}</p>
            <p style={{ margin: "2px 0 0", fontFamily: "var(--font-newsreader, 'Newsreader', serif)", fontSize: width < 200 ? 14 : 24, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.01em" }}>{name}</p>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-space-mono, 'Space Mono', monospace)", fontSize: 9, color: "#A99F92" }}>HP</span>
            <span style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)", fontSize: width < 200 ? 14 : 24, fontWeight: 600, lineHeight: 1 }}>{hpText}</span>
            <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #FFF", background: tc, boxShadow: "0 1px 3px rgba(43,38,34,.25)", display: "inline-block" }} />
          </div>
        </div>
        {/* Artwork panel */}
        <div style={{ position: "relative", borderRadius: 13, overflow: "hidden", background: bgTint, border: "1px solid rgba(43,38,34,.1)", aspectRatio: "5/4" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(110% 80% at 50% 16%, rgba(255,255,255,.55), transparent 58%)", pointerEvents: "none" }} />
          <span style={{ position: "absolute", top: 9, left: 9, fontFamily: "var(--font-space-mono, 'Space Mono', monospace)", fontSize: 8, letterSpacing: ".08em", textTransform: "uppercase", color: "#6E655C", background: "#FFFFFFcc", padding: "3px 7px", borderRadius: 999 }}>{poseLabel}</span>
          <div style={{ position: "absolute", left: "50%", top: "54%", transform: "translate(-50%,-50%)", width: "62%", aspectRatio: "1" }}>
            <CreatureArt zf={zf} />
          </div>
        </div>
        {/* Moves */}
        <div style={{ borderRadius: 11, background: "#F4ECDF", border: "1px solid rgba(43,38,34,.07)", padding: "11px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ display: "flex", gap: 3 }}>
              <span style={{ width: 13, height: 13, borderRadius: "50%", background: tc, border: "1.5px solid #FFF", display: "inline-block" }} />
              <span style={{ width: 13, height: 13, borderRadius: "50%", background: "#D9CFBF", border: "1.5px solid #FFF", display: "inline-block" }} />
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{move1}</span>
            <span style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)", fontSize: 18, fontWeight: 600 }}>{dmg1}</span>
          </div>
          <div style={{ height: 1, background: "rgba(43,38,34,.08)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ display: "flex", gap: 3 }}>
              <span style={{ width: 13, height: 13, borderRadius: "50%", background: tc, border: "1.5px solid #FFF", display: "inline-block" }} />
              <span style={{ width: 13, height: 13, borderRadius: "50%", background: tc, border: "1.5px solid #FFF", display: "inline-block" }} />
              <span style={{ width: 13, height: 13, borderRadius: "50%", background: "#D9CFBF", border: "1.5px solid #FFF", display: "inline-block" }} />
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{move2}</span>
            <span style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)", fontSize: 18, fontWeight: 600 }}>{dmg2}</span>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-newsreader, 'Newsreader', serif)", fontStyle: "italic", fontSize: 11, lineHeight: 1.4, color: "#7A7064" }}>A quiet camp companion, happiest with a fresh box of colors and a long afternoon.</p>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-space-mono, 'Space Mono', monospace)", fontSize: 8.5, letterSpacing: ".06em", color: "#A99F92" }}>
          <span>CANVAS CAMP</span>
          <span>{cardNo} · ★</span>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar preview (small card artwork) ─────────────────
interface SidebarPreviewProps {
  bgTint: string;
  zf: (k: ZoneKey) => string;
  poseLabel: string;
  creatureColor: string;
}

function SidebarPreview({ bgTint, zf, poseLabel, creatureColor }: SidebarPreviewProps) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #ECE4D8", borderRadius: 18, padding: 14, boxShadow: "0 2px 4px rgba(43,38,34,.03), 0 10px 26px rgba(43,38,34,.05)" }}>
      <div style={{ position: "relative", aspectRatio: "5/6", borderRadius: 14, background: bgTint, border: "1px solid #ECE4D8", overflow: "hidden", display: "grid", placeItems: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 18%, rgba(255,255,255,.55), transparent 60%)", pointerEvents: "none" }} />
        <span style={{ position: "absolute", top: 11, left: 11, fontFamily: "var(--font-space-mono, 'Space Mono', monospace)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#8B8276", background: "#FFFFFFcc", padding: "3px 8px", borderRadius: 999 }}>{poseLabel}</span>
        <span style={{ position: "absolute", top: 11, right: 11, width: 14, height: 14, borderRadius: "50%", border: "2px solid #FFF", background: creatureColor, boxShadow: "0 1px 3px rgba(43,38,34,.25)", display: "inline-block" }} />
        <div style={{ position: "relative", width: "72%", aspectRatio: "1" }}>
          <CreatureArt zf={zf} size="100%" />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export function CanvasCamp() {
  const [step, setStep] = useState(0);
  const [activeType, setActiveType] = useState("electric");
  const [creatureName, setCreatureName] = useState("Pikachu");
  const [creatureType, setCreatureType] = useState("electric");
  const [pose, setPose] = useState("portrait");
  const [variant, setVariant] = useState("A");
  const [color, setColor] = useState("#E0B458");
  const [zones, setZones] = useState<Record<ZoneKey, string>>({ z1: "", z2: "", z3: "", z4: "", z5: "", z6: "" });
  const [bg, setBg] = useState("meadow");
  const [move1, setMove1] = useState("Static Spark");
  const [move2, setMove2] = useState("Thunder Arc");

  // Derived
  const creatureColor = getTypeColor(creatureType);
  const poseLabel = POSES.find(p => p.id === pose)?.label ?? "Portrait";
  const hp = calcHp(creatureName);
  const currentBgTint = getBgTint(bg);
  const stageText = hp > 110 ? "Stage 2" : hp > 80 ? "Stage 1" : "Basic";
  const cardNo = "No. " + String((hp % 89) + 11).padStart(3, "0");
  const zf = (k: ZoneKey) => zones[k] || ZONE_BASE;
  const fillZone = (k: ZoneKey) => setZones(prev => ({ ...prev, [k]: color }));
  const clearZones = () => setZones({ z1: "", z2: "", z3: "", z4: "", z5: "", z6: "" });
  const painted = (Object.keys(zones) as ZoneKey[]).filter(k => zones[k]).length;
  const dmg1 = moveCode(move1);
  const dmg2 = moveCode(move2);
  const cur = STEPS[step];

  const go = (i: number) => setStep(Math.max(0, Math.min(4, i)));
  const next = () => step >= 4 ? setStep(0) : go(step + 1);
  const back = () => go(step - 1);

  // Card props (shared)
  const cardProps: CardProps = {
    name: creatureName, bgTint: currentBgTint, zf, typeColor: creatureColor,
    move1, dmg1, move2, dmg2, stageText, hpText: hp, poseLabel, cardNo,
  };

  const fontSans = "var(--font-hanken, 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif)";
  const fontSerif = "var(--font-newsreader, 'Newsreader', serif)";
  const fontMono = "var(--font-space-mono, 'Space Mono', monospace)";

  return (
    <div style={{ display: "flex", height: "100dvh", minHeight: 560, width: "100%", fontFamily: fontSans, background: "#FBF9F5", color: INK, WebkitFontSmoothing: "antialiased", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 312, flexShrink: 0, display: "flex", flexDirection: "column", background: "#F0EAE1", borderRight: "1px solid #E8E1D6", padding: "26px 24px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: INK, display: "grid", placeItems: "center", color: "#F0EAE1", fontFamily: fontSerif, fontSize: 17, fontWeight: 600 }}>C</span>
          <span style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>Canvas Camp</span>
        </div>

        {/* Preview card */}
        <div style={{ marginTop: 24 }}>
          <SidebarPreview bgTint={currentBgTint} zf={zf} poseLabel={poseLabel} creatureColor={creatureColor} />
        </div>

        {/* Step rail */}
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  padding: "11px 12px", borderRadius: 14, cursor: "pointer", transition: "background .15s",
                  border: `1px solid ${active ? "#E2D7C6" : "transparent"}`,
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? INK : "#6E655C",
                  boxShadow: active ? "0 2px 8px rgba(43,38,34,.06)" : "none",
                  fontFamily: fontSans,
                }}
              >
                <span style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center",
                  fontFamily: fontMono, fontSize: 12, fontWeight: 700,
                  background: active ? INK : done ? "#DCD2C4" : "#E4DBCD",
                  color: active ? "#F7F2EA" : done ? "#5A5249" : "#9C9388",
                }}>
                  {done ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: active ? "#8B8276" : "#A99F92", marginTop: 1 }}>{s.eyebrow}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: ".08em", color: "#A99F92", textTransform: "uppercase" }}>Progress</span>
            <span style={{ fontFamily: fontMono, fontSize: 11, color: INK, fontWeight: 700 }}>{step + 1} / 5</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#E2D9CB", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: INK, width: `${((step + 1) / 5) * 100}%`, transition: "width .3s ease" }} />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 20px", borderBottom: "1px solid #EFE7DB", background: "#F0EAE1", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: INK, display: "grid", placeItems: "center", color: "#F0EAE1", fontFamily: fontSerif, fontSize: 15, fontWeight: 600 }}>C</span>
            <span style={{ fontFamily: fontSerif, fontSize: 17, fontWeight: 600 }}>Canvas Camp</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, transition: "all .2s", background: i <= step ? INK : "#DDD3C5", display: "inline-block" }} />
            ))}
          </div>
        </div>

        {/* Header */}
        <header style={{ flexShrink: 0, padding: "30px 40px 22px", borderBottom: "1px solid #EFE7DB", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: fontMono, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#A99F92" }}>
              Step {String(step + 1).padStart(2, "0")} / 05 · {cur.eyebrow}
            </p>
            <h1 style={{ margin: "7px 0 0", fontFamily: fontSerif, fontSize: 33, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.05, color: INK }}>{cur.title}</h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6E655C", lineHeight: 1.5 }}>{cur.caption}</p>
          </div>
          <Link href="/cards" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, border: "1px solid #E2D9CB", background: "#FFFFFF", fontSize: 13, fontWeight: 600, color: "#4A433B", textDecoration: "none" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#84A877", display: "inline-block" }} />
            Camp gallery
          </Link>
        </header>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "34px 40px" }}>

          {/* ── Step 0: Pick creature ── */}
          {step === 0 && (
            <div style={{ animation: "ccFade .4s ease both" }}>
              {/* Type filter pills */}
              <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
                {TYPES.map(t => {
                  const active = t.id === activeType;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveType(t.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
                        padding: "0 16px", height: 42, borderRadius: 999, cursor: "pointer",
                        fontSize: 13.5, fontWeight: 600, transition: "all .15s",
                        border: `1px solid ${active ? INK : "#E6DDCF"}`,
                        background: active ? INK : "#FFFFFF",
                        color: active ? "#F7F2EA" : "#4A433B",
                        fontFamily: fontSans,
                      }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.color, display: "inline-block" }} />
                      {t.label}
                      <span style={{ fontFamily: fontMono, fontSize: 11, opacity: 0.6 }}>{CREATURES[t.id]?.length}</span>
                    </button>
                  );
                })}
              </div>

              {/* Creature grid */}
              <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(186px,1fr))", gap: 14 }}>
                {(CREATURES[activeType] ?? []).map(name => {
                  const selected = name === creatureName && activeType === creatureType;
                  const tc = getTypeColor(activeType);
                  const h = hashNum(name);
                  const rot = (h % 9) - 4;
                  const artZf = (k: ZoneKey) => {
                    const defaults: Record<ZoneKey, string> = {
                      z1: lighten(tc, 0.42), z2: tc, z3: tc,
                      z4: lighten(tc, 0.56), z5: tc, z6: tc,
                    };
                    return defaults[k];
                  };
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => { setCreatureName(name); setCreatureType(activeType); }}
                      style={{
                        display: "flex", flexDirection: "column", textAlign: "left", padding: 11, borderRadius: 18,
                        cursor: "pointer", transition: "all .18s", background: "#FFFFFF",
                        border: `1.5px solid ${selected ? INK : "#ECE4D8"}`,
                        boxShadow: selected ? "0 8px 22px rgba(43,38,34,.1)" : "0 2px 4px rgba(43,38,34,.03)",
                        fontFamily: fontSans,
                      }}
                    >
                      <div style={{ position: "relative", aspectRatio: "7/5", borderRadius: 13, overflow: "hidden", background: lighten(tc, 0.82), border: "1px solid #ECE4D8", display: "grid", placeItems: "center" }}>
                        {selected && (
                          <span style={{ position: "absolute", top: 9, right: 9, width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", background: INK, color: "#F7F2EA", fontSize: 12, boxShadow: "0 2px 6px rgba(43,38,34,.25)" }}>✓</span>
                        )}
                        <div style={{ position: "relative", width: "52%", aspectRatio: "1", transform: `rotate(${rot}deg)` }}>
                          <CreatureArt zf={artZf} size="100%" />
                        </div>
                      </div>
                      <div style={{ marginTop: 10, paddingLeft: 2 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{name}</p>
                        <p style={{ margin: "3px 0 0", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8B8276" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tc, display: "inline-block" }} />
                          {getTypeLabel(activeType)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 1: Pick pose ── */}
          {step === 1 && (
            <div style={{ animation: "ccFade .4s ease both", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))", gap: 14 }}>
              {POSES.map((p, i) => {
                const selected = p.id === pose;
                const artT = POSE_T[p.id] ?? "none";
                const artZf = (k: ZoneKey) => {
                  const defaults: Record<ZoneKey, string> = {
                    z1: lighten(creatureColor, 0.5),
                    z2: creatureColor, z3: creatureColor,
                    z4: lighten(creatureColor, 0.64),
                    z5: creatureColor, z6: creatureColor,
                  };
                  return defaults[k];
                };
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPose(p.id)}
                    style={{
                      display: "flex", flexDirection: "column", textAlign: "left", padding: 11, borderRadius: 18,
                      cursor: "pointer", transition: "all .18s", background: "#FFFFFF",
                      border: `1.5px solid ${selected ? INK : "#ECE4D8"}`,
                      boxShadow: selected ? "0 8px 22px rgba(43,38,34,.1)" : "0 2px 4px rgba(43,38,34,.03)",
                      fontFamily: fontSans,
                    }}
                  >
                    <div style={{ position: "relative", aspectRatio: "1", borderRadius: 13, overflow: "hidden", border: `1px solid ${selected ? "#D8CDBC" : "#EDE6DA"}`, backgroundImage: "repeating-linear-gradient(135deg, #EFE7DB 0 9px, #F7F2EA 9px 18px)", display: "grid", placeItems: "center" }}>
                      <span style={{ position: "absolute", top: 8, left: 8, fontFamily: fontMono, fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: selected ? "#5A5249" : "#A99F92", background: "#FFFFFFd9", padding: "3px 7px", borderRadius: 999 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${selected ? INK : "#C9BFB0"}`, background: selected ? creatureColor : "transparent" }} />
                      <div style={{ position: "relative", width: "52%", aspectRatio: "1" }}>
                        <CreatureArt zf={artZf} transform={artT} size="100%" />
                      </div>
                    </div>
                    <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500 }}>{p.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Step 2: Color ── */}
          {step === 2 && (
            <div style={{ animation: "ccFade .4s ease both" }}>
              {/* Variant tabs + controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 999, background: "#F1EBE2", border: "1px solid #E8E1D6" }}>
                  {VARIANTS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariant(v.id)}
                      style={{
                        padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
                        transition: "all .15s", border: "none",
                        background: variant === v.id ? INK : "transparent",
                        color: variant === v.id ? "#F7F2EA" : "#6E655C",
                        fontFamily: fontSans,
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "#8B8276" }}>{painted} / 6 regions filled</span>
                  <button type="button" onClick={clearZones} style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid #E2D9CB", background: "#FFFFFF", fontSize: 12, fontWeight: 600, color: "#6E655C", cursor: "pointer", fontFamily: fontSans }}>Clear</button>
                </div>
              </div>

              {/* Variant A: Atelier */}
              {variant === "A" && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 138px", gap: 18, alignItems: "start" }}>
                  <div>
                    <div style={{ borderRadius: 22, background: currentBgTint, border: "1px solid #E8E1D6", padding: 34, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}>
                      <div style={{ position: "relative", width: "100%", maxWidth: 340, aspectRatio: "1", margin: "0 auto" }}>
                        <CreatureArt zf={zf} size="100%" onFill={fillZone} />
                      </div>
                    </div>
                    <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: 7, borderRadius: 999, background: "#FFFFFF", border: "1px solid #ECE4D8", boxShadow: "0 2px 8px rgba(43,38,34,.05)" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: color, border: "1.5px solid rgba(43,38,34,.15)", boxShadow: "inset 0 1px 2px rgba(255,255,255,.4)" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#5A5249", paddingRight: 4 }}>Active color</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {BACKGROUNDS.map(b => (
                          <button key={b.id} type="button" onClick={() => setBg(b.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 13px 7px 7px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 600, transition: "all .15s", border: `1px solid ${bg === b.id ? INK : "#E6DDCF"}`, background: bg === b.id ? "#FFFFFF" : "#FBF7F0", color: "#4A433B", fontFamily: fontSans }}>
                            <span style={{ width: 22, height: 22, borderRadius: "50%", background: b.tint, border: "1px solid rgba(43,38,34,.12)", display: "inline-block" }} />
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Palette */}
                  <div style={{ background: "#FFFFFF", border: "1px solid #ECE4D8", borderRadius: 18, padding: 13, boxShadow: "0 2px 8px rgba(43,38,34,.04)" }}>
                    <p style={{ margin: "0 0 10px", fontFamily: fontMono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#A99F92" }}>Palette</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                      {SWATCHES.map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)} style={{ width: "100%", aspectRatio: "1", borderRadius: 11, cursor: "pointer", background: c, transition: "transform .12s", border: `1.5px solid ${color === c ? INK : "rgba(43,38,34,.12)"}`, boxShadow: color === c ? `0 0 0 3px #FBF9F5, 0 0 0 4.5px ${INK}` : "inset 0 1px 2px rgba(255,255,255,.3)" }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Variant B: Console */}
              {variant === "B" && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 268px", gap: 18, alignItems: "start" }}>
                  <div style={{ borderRadius: 22, background: currentBgTint, border: "1px solid #E8E1D6", padding: 30, display: "grid", placeItems: "center", minHeight: 372 }}>
                    <div style={{ position: "relative", width: "100%", maxWidth: 300, aspectRatio: "1" }}>
                      <CreatureArt zf={zf} size="100%" onFill={fillZone} />
                    </div>
                  </div>
                  {/* Right panel */}
                  <div style={{ background: "#FFFFFF", border: "1px solid #ECE4D8", borderRadius: 20, padding: 18, boxShadow: "0 2px 10px rgba(43,38,34,.05)" }}>
                    <p style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#A99F92" }}>Palette</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
                      {SWATCHES.map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)} style={{ width: "100%", aspectRatio: "1", borderRadius: 10, cursor: "pointer", background: c, transition: "transform .12s", border: `1.5px solid ${color === c ? INK : "rgba(43,38,34,.12)"}`, boxShadow: color === c ? `0 0 0 3px #FBF9F5, 0 0 0 4.5px ${INK}` : "inset 0 1px 2px rgba(255,255,255,.3)" }} />
                      ))}
                    </div>
                    <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {BACKGROUNDS.map(b => (
                        <button key={b.id} type="button" onClick={() => setBg(b.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px 6px 6px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600, border: `1px solid ${bg === b.id ? INK : "#E6DDCF"}`, background: bg === b.id ? "#FFFFFF" : "#FBF7F0", color: "#4A433B", fontFamily: fontSans }}>
                          <span style={{ width: 18, height: 18, borderRadius: "50%", background: b.tint, border: "1px solid rgba(43,38,34,.12)", display: "inline-block" }} />
                          {b.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 9 }}>
                      <div style={{ flex: 1, padding: "10px 12px", borderRadius: 13, background: "#F4EEE5", border: "1px solid #ECE4D8" }}>
                        <p style={{ margin: "0 0 4px", fontFamily: fontMono, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "#A99F92" }}>Active</p>
                        <span style={{ display: "block", width: 28, height: 28, borderRadius: 8, background: color, border: "1.5px solid rgba(43,38,34,.15)" }} />
                      </div>
                      <div style={{ flex: 1, padding: "10px 12px", borderRadius: 13, background: "#F4EEE5", border: "1px solid #ECE4D8" }}>
                        <p style={{ margin: "0 0 4px", fontFamily: fontMono, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "#A99F92" }}>Filled</p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{painted} / 6</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Variant C: Stage */}
              {variant === "C" && (
                <div style={{ position: "relative", borderRadius: 26, background: currentBgTint, border: "1px solid #E8E1D6", padding: "46px 46px 30px", overflow: "hidden", boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(90% 70% at 50% 24%, rgba(255,255,255,.5), transparent 62%)", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", top: 20, right: 20, display: "inline-flex", alignItems: "center", gap: 6, padding: 7, borderRadius: 999, background: "#FFFFFFe6", border: "1px solid #ECE4D8", backdropFilter: "blur(6px)", boxShadow: "0 2px 10px rgba(43,38,34,.08)" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: color, border: "1.5px solid rgba(43,38,34,.15)" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#5A5249", paddingRight: 2 }}>{painted}/6 filled</span>
                  </div>
                  <div style={{ position: "relative", width: "100%", maxWidth: 392, aspectRatio: "1", margin: "6px auto 0" }}>
                    <CreatureArt zf={zf} size="100%" onFill={fillZone} />
                  </div>
                  {/* Swatch tray */}
                  <div style={{ position: "relative", margin: "26px auto 0", maxWidth: 560, background: "#FFFFFFe8", border: "1px solid #ECE4D8", borderRadius: 18, padding: 14, backdropFilter: "blur(6px)", boxShadow: "0 6px 20px rgba(43,38,34,.08)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(16,1fr)", gap: 7 }}>
                      {SWATCHES.map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)} style={{ width: "100%", aspectRatio: "1", borderRadius: 8, cursor: "pointer", background: c, border: `1.5px solid ${color === c ? INK : "rgba(43,38,34,.12)"}`, boxShadow: color === c ? `0 0 0 2.5px #FBF9F5, 0 0 0 4px ${INK}` : "none" }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ position: "relative", marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {BACKGROUNDS.map(b => (
                      <button key={b.id} type="button" onClick={() => setBg(b.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 6px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600, border: `1px solid ${bg === b.id ? INK : "#E6DDCF"}`, background: bg === b.id ? "#FFFFFFcc" : "#FFFFFFaa", color: "#4A433B", backdropFilter: "blur(4px)", fontFamily: fontSans }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: b.tint, border: "1px solid rgba(43,38,34,.12)", display: "inline-block" }} />
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {step === 3 && (
            <div style={{ animation: "ccFade .4s ease both", display: "grid", gridTemplateColumns: "316px minmax(0,1fr)", gap: 30, alignItems: "start" }}>
              <PokemonCard {...cardProps} width={316} />
              <div style={{ maxWidth: 440 }}>
                <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#A99F92" }}>Card details</p>
                <p style={{ margin: "8px 0 22px", fontSize: 14.5, lineHeight: 1.5, color: "#6E655C" }}>Name the two moves and the card on the left updates as you type. Everything else is set from your creature and palette.</p>
                <label style={{ display: "block", marginBottom: 18 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5A5249", marginBottom: 7 }}>First move</span>
                  <input type="text" value={move1} onChange={e => setMove1(e.target.value)} style={{ width: "100%", padding: "13px 15px", borderRadius: 13, border: "1px solid #E2D9CB", background: "#FFFFFF", fontSize: 15, color: INK, outline: "none", fontFamily: fontSans }} />
                </label>
                <label style={{ display: "block", marginBottom: 24 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5A5249", marginBottom: 7 }}>Second move</span>
                  <input type="text" value={move2} onChange={e => setMove2(e.target.value)} style={{ width: "100%", padding: "13px 15px", borderRadius: 13, border: "1px solid #E2D9CB", background: "#FFFFFF", fontSize: 15, color: INK, outline: "none", fontFamily: fontSans }} />
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { label: "Type",   value: <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: "50%", background: creatureColor, display: "inline-block" }} />{getTypeLabel(creatureType)}</span> },
                    { label: "Health", value: `${hp} HP` },
                    { label: "Stage",  value: stageText },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, minWidth: 96, padding: "13px 15px", borderRadius: 13, background: "#F4EEE5", border: "1px solid #ECE4D8" }}>
                      <p style={{ margin: 0, fontFamily: fontMono, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "#A99F92" }}>{item.label}</p>
                      <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 600 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Mint ── */}
          {step === 4 && (
            <div style={{ animation: "ccFade .4s ease both" }}>
              <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", gap: 40, alignItems: "center" }}>
                {/* Card with glow */}
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: -30, background: `radial-gradient(60% 50% at 50% 45%, ${creatureColor}33, transparent 70%)`, filter: "blur(8px)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", animation: "ccPop .5s ease both" }}>
                    <PokemonCard {...cardProps} width={300} />
                  </div>
                </div>
                {/* Text + actions */}
                <div style={{ maxWidth: 420 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: 999, background: "#EEF3E8", border: "1px solid #DCE6D0", fontSize: 11, fontWeight: 600, color: "#5C6B4C" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#84A877", display: "inline-block" }} />
                    Minted to your gallery
                  </span>
                  <h2 style={{ margin: "16px 0 0", fontFamily: fontSerif, fontSize: 34, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.08 }}>Your card is ready.</h2>
                  <p style={{ margin: "12px 0 26px", fontSize: 15, lineHeight: 1.5, color: "#6E655C" }}>{creatureName} is colored, named and saved. Download a high-resolution PNG or share it straight to the camp gallery.</p>
                  <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 22px", borderRadius: 999, border: "none", background: INK, color: "#F7F2EA", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(43,38,34,.18)", fontFamily: fontSans }}>
                      ↓ Download PNG
                    </button>
                    <Link href="/cards" style={{ display: "inline-flex", alignItems: "center", padding: "13px 22px", borderRadius: 999, border: "1px solid #E2D9CB", background: "#FFFFFF", color: "#4A433B", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                      Share
                    </Link>
                    <button type="button" onClick={() => setStep(0)} style={{ padding: "13px 22px", borderRadius: 999, border: "1px solid #E2D9CB", background: "#FFFFFF", color: "#4A433B", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: fontSans }}>
                      New card
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery strip */}
              <div style={{ marginTop: 38, paddingTop: 26, borderTop: "1px solid #EFE7DB" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ margin: 0, fontFamily: fontSerif, fontSize: 19, fontWeight: 600 }}>Camp gallery</p>
                  <Link href="/cards" style={{ fontFamily: fontMono, fontSize: 11, color: "#A99F92", textDecoration: "none" }}>View all →</Link>
                </div>
                <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
                  {/* Current card */}
                  <div style={{ flexShrink: 0, width: 138, borderRadius: 15, padding: 7, background: "linear-gradient(160deg,#FCF8F1,#F3EADC)", border: `1.5px solid ${INK}`, boxShadow: "0 8px 20px rgba(43,38,34,.12)" }}>
                    <div style={{ position: "relative", borderRadius: 11, overflow: "hidden", aspectRatio: "1", background: currentBgTint, display: "grid", placeItems: "center" }}>
                      <div style={{ position: "relative", width: "60%", aspectRatio: "1" }}>
                        <CreatureArt zf={zf} size="100%" />
                      </div>
                    </div>
                    <p style={{ margin: "8px 4px 2px", fontFamily: fontSerif, fontSize: 14, fontWeight: 600, lineHeight: 1 }}>{creatureName}</p>
                    <p style={{ margin: "0 4px 4px", fontFamily: fontMono, fontSize: 9, color: "#84A877" }}>JUST NOW</p>
                  </div>
                  {/* Placeholder slots */}
                  {BACKGROUNDS.slice(0, 4).map((b, i) => (
                    <div key={b.id} style={{ flexShrink: 0, width: 138, borderRadius: 15, padding: 7, background: "#FFFFFF", border: "1px solid #ECE4D8", boxShadow: "0 2px 8px rgba(43,38,34,.04)" }}>
                      <div style={{ borderRadius: 11, aspectRatio: "1", backgroundColor: b.tint, backgroundImage: "repeating-linear-gradient(135deg, rgba(43,38,34,.05) 0 8px, transparent 8px 16px)", display: "grid", placeItems: "center" }}>
                        <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: ".06em", color: "#8B8276" }}>// {b.label}</span>
                      </div>
                      <p style={{ margin: "8px 4px 2px", fontFamily: fontSerif, fontSize: 14, fontWeight: 600, lineHeight: 1, color: "#9C9388" }}>Empty slot</p>
                      <p style={{ margin: "0 4px 4px", fontFamily: fontMono, fontSize: 9, color: "#C3B9AB" }}>No. {String(12 + i * 7).padStart(3, "0")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <footer style={{ flexShrink: 0, padding: "18px 40px", borderTop: "1px solid #EFE7DB", background: "#FBF9F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            style={{ padding: "13px 22px", borderRadius: 999, cursor: step === 0 ? "default" : "pointer", fontSize: 14, fontWeight: 600, background: "transparent", border: "1px solid #E2D9CB", color: step === 0 ? "#C3B9AB" : "#4A433B", opacity: step === 0 ? 0.6 : 1, fontFamily: fontSans }}
          >
            ← Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, transition: "all .2s", background: i <= step ? INK : "#DDD3C5", display: "inline-block" }} />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 26px", borderRadius: 999, border: "none", background: INK, color: "#F7F2EA", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(43,38,34,.18)", fontFamily: fontSans }}
          >
            {step >= 4 ? "Start another" : "Continue"}
          </button>
        </footer>
      </main>

      <style>{`
        @keyframes ccFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes ccPop {
          from { opacity: 0; transform: scale(.95); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
