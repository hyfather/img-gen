export type PokemonType =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy";

export type PokemonOption = {
  name: string;
  type: PokemonType;
};

export type PokemonTypeGroup = {
  id: PokemonType;
  label: string;
  color: string;
  pokemon: PokemonOption[];
};

export const POKEMON_TYPE_GROUPS: PokemonTypeGroup[] = [
  {
    id: "electric",
    label: "Electric",
    color: "#facc15",
    pokemon: [
      { name: "Pikachu", type: "electric" },
      { name: "Raichu", type: "electric" },
      { name: "Jolteon", type: "electric" },
    ],
  },
  {
    id: "fire",
    label: "Fire",
    color: "#f97316",
    pokemon: [
      { name: "Charmander", type: "fire" },
      { name: "Charizard", type: "fire" },
      { name: "Vulpix", type: "fire" },
      { name: "Arcanine", type: "fire" },
    ],
  },
  {
    id: "water",
    label: "Water",
    color: "#38bdf8",
    pokemon: [
      { name: "Squirtle", type: "water" },
      { name: "Psyduck", type: "water" },
      { name: "Lapras", type: "water" },
      { name: "Gyarados", type: "water" },
    ],
  },
  {
    id: "grass",
    label: "Grass",
    color: "#22c55e",
    pokemon: [
      { name: "Bulbasaur", type: "grass" },
      { name: "Chikorita", type: "grass" },
      { name: "Treecko", type: "grass" },
    ],
  },
  {
    id: "normal",
    label: "Normal",
    color: "#a8a29e",
    pokemon: [
      { name: "Eevee", type: "normal" },
      { name: "Snorlax", type: "normal" },
      { name: "Jigglypuff", type: "normal" },
    ],
  },
  {
    id: "psychic",
    label: "Psychic",
    color: "#ec4899",
    pokemon: [
      { name: "Mewtwo", type: "psychic" },
      { name: "Mew", type: "psychic" },
      { name: "Alakazam", type: "psychic" },
    ],
  },
  {
    id: "dragon",
    label: "Dragon",
    color: "#8b5cf6",
    pokemon: [
      { name: "Dragonite", type: "dragon" },
      { name: "Rayquaza", type: "dragon" },
      { name: "Garchomp", type: "dragon" },
    ],
  },
  {
    id: "ghost",
    label: "Ghost",
    color: "#7c3aed",
    pokemon: [
      { name: "Gengar", type: "ghost" },
      { name: "Mimikyu", type: "ghost" },
      { name: "Decidueye", type: "ghost" },
    ],
  },
  {
    id: "fighting",
    label: "Fighting",
    color: "#dc2626",
    pokemon: [
      { name: "Lucario", type: "fighting" },
      { name: "Machamp", type: "fighting" },
    ],
  },
  {
    id: "flying",
    label: "Flying",
    color: "#60a5fa",
    pokemon: [
      { name: "Pidgeot", type: "flying" },
      { name: "Lugia", type: "flying" },
      { name: "Togekiss", type: "flying" },
    ],
  },
  {
    id: "poison",
    label: "Poison",
    color: "#a855f7",
    pokemon: [
      { name: "Gengar", type: "poison" },
      { name: "Nidoking", type: "poison" },
    ],
  },
  {
    id: "ground",
    label: "Ground",
    color: "#d97706",
    pokemon: [
      { name: "Sandshrew", type: "ground" },
      { name: "Cubone", type: "ground" },
    ],
  },
  {
    id: "ice",
    label: "Ice",
    color: "#67e8f9",
    pokemon: [
      { name: "Articuno", type: "ice" },
      { name: "Glaceon", type: "ice" },
    ],
  },
  {
    id: "bug",
    label: "Bug",
    color: "#84cc16",
    pokemon: [
      { name: "Butterfree", type: "bug" },
      { name: "Scyther", type: "bug" },
      { name: "Heracross", type: "bug" },
    ],
  },
  {
    id: "rock",
    label: "Rock",
    color: "#78716c",
    pokemon: [
      { name: "Onix", type: "rock" },
      { name: "Tyranitar", type: "rock" },
    ],
  },
  {
    id: "dark",
    label: "Dark",
    color: "#44403c",
    pokemon: [
      { name: "Umbreon", type: "dark" },
      { name: "Greninja", type: "dark" },
      { name: "Absol", type: "dark" },
    ],
  },
  {
    id: "steel",
    label: "Steel",
    color: "#94a3b8",
    pokemon: [
      { name: "Steelix", type: "steel" },
      { name: "Metagross", type: "steel" },
    ],
  },
  {
    id: "fairy",
    label: "Fairy",
    color: "#fb7185",
    pokemon: [
      { name: "Sylveon", type: "fairy" },
      { name: "Clefairy", type: "fairy" },
      { name: "Gardevoir", type: "fairy" },
    ],
  },
];

export const POKEMON_COUNT = POKEMON_TYPE_GROUPS.reduce(
  (total, group) => total + group.pokemon.length,
  0,
);
