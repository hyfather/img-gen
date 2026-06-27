// Standard collectible-card geometry, shared by the flat composite we send to
// the mint model, the realistic render we request back, and printing.
//
// Real trading cards are 2.5in x 3.5in (a 5:7 ratio, ~63:88). The render size
// keeps that proportion while staying divisible by 64 for the image model.
export const CARD_RENDER_WIDTH = 1024;
export const CARD_RENDER_HEIGHT = 1408;
export const CARD_RENDER_SIZE = `${CARD_RENDER_WIDTH}x${CARD_RENDER_HEIGHT}`;

// Physical print size of a standard trading card.
export const CARD_PRINT_WIDTH_IN = 2.5;
export const CARD_PRINT_HEIGHT_IN = 3.5;
