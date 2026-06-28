// Standard collectible-card geometry, shared by the flat composite we send to
// the mint model, the realistic render we request back, and printing.
//
// Real trading cards are 2.5in x 3.5in (a 5:7 ratio, ~63:88). The render size
// keeps that proportion while staying divisible by 64 for the image model.
export const CARD_RENDER_WIDTH = 1024;
export const CARD_RENDER_HEIGHT = 1408;
export const CARD_RENDER_SIZE = `${CARD_RENDER_WIDTH}x${CARD_RENDER_HEIGHT}`;

// Human-readable aspect ratio used to anchor the image model on a single,
// full-bleed portrait card rather than a side-by-side pair or grid.
export const CARD_ASPECT_RATIO = "5:7 (63:88), portrait";

// Physical print size of a standard trading card.
export const CARD_PRINT_WIDTH_IN = 2.5;
export const CARD_PRINT_HEIGHT_IN = 3.5;

// Standard A4 sheet, so a single card can be printed centered at true size
// and cut out.
export const A4_WIDTH_IN = 8.27;
export const A4_HEIGHT_IN = 11.69;
