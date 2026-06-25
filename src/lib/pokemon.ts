export type PokemonType =
  | "fire"
  | "water"
  | "grass"
  | "electric"
  | "psychic"
  | "ice"
  | "fairy";

export type PokemonTypeStyle = {
  name: string;
  abbr: string;
  color: string;
  soft: string;
  ink: string;
};

export const POKEMON_TYPES: Record<PokemonType, PokemonTypeStyle> = {
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

export const TYPE_LIST = Object.keys(POKEMON_TYPES) as PokemonType[];

export function isPokemonType(value: unknown): value is PokemonType {
  return typeof value === "string" && value in POKEMON_TYPES;
}
