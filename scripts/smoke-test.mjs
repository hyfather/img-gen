import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.SMOKE_URL ?? "http://localhost:3000";
const screenshotPath =
  process.env.SMOKE_SCREENSHOT ?? "/tmp/canvas-camp-smoke.png";
const viewport = {
  width: Number(process.env.SMOKE_WIDTH ?? 1180),
  height: Number(process.env.SMOKE_HEIGHT ?? 820),
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: false,
  viewport,
});
const page = await context.newPage();
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

const outlineSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="white"/>
    <circle cx="512" cy="512" r="280" fill="white" stroke="black" stroke-width="32"/>
    <circle cx="412" cy="430" r="32" fill="black"/>
    <circle cx="612" cy="430" r="32" fill="black"/>
    <path d="M420 620 Q512 700 604 620" fill="none" stroke="black" stroke-width="28" stroke-linecap="round"/>
  </svg>
`;
const mockImageUrl = `data:image/svg+xml;base64,${Buffer.from(outlineSvg).toString(
  "base64",
)}`;
const generationRequests = [];

await page.route("**/api/coloring-page", async (route) => {
  if (route.request().method() === "GET") {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        images: [],
      }),
    });
    return;
  }

  generationRequests.push(route.request().postDataJSON());

  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      image: {
        downloadUrl: mockImageUrl,
        pathname: "generated-coloring-pages/charmander/fighting/mock.png",
        source: "local",
        uploadedAt: new Date().toISOString(),
        url: mockImageUrl,
      },
      imageUrl: mockImageUrl,
      model: "google/gemini-2.5-flash-lite",
      pokemonName: "Charmander",
      pose: "fighting",
    }),
  });
});

await page.goto(url, { timeout: 30000, waitUntil: "networkidle" });
await page.waitForSelector("text=Pokemon Camp", { timeout: 10000 });

const before = await page.evaluate(() => ({
  bodyState: document.body.innerText.trim().length > 0 ? "HAS_CONTENT" : "BLANK",
  overlayState: document.querySelector(
    "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
  )
    ? "ERROR_OVERLAY"
    : "OK",
  buttonLabels: Array.from(document.querySelectorAll("button"))
    .map((button) => button.textContent?.trim())
    .filter(Boolean)
    .slice(0, 24),
  canvasCount: document.querySelectorAll("canvas").length,
  title: document.title,
}));

await page.getByRole("button", { name: /Fire/i }).click();
await page.getByRole("button", { name: /Charmander/i }).click();
const requestsAfterSelection = generationRequests.length;
await page.getByRole("button", { name: "Fighting", exact: true }).click();
const requestsAfterPose = generationRequests.length;
await page.getByRole("button", { name: "Generate image" }).click();
await page.waitForSelector("text=Charmander fighting ready", { timeout: 5000 });
const canvasBox = await page.getByLabel("Pokemon coloring canvas").boundingBox();

if (!canvasBox) {
  throw new Error("Could not find coloring canvas bounds.");
}

await page.touchscreen.tap(
  canvasBox.x + canvasBox.width / 2,
  canvasBox.y + canvasBox.height / 2,
);

const after = await page.evaluate(() => {
  const canvases = Array.from(document.querySelectorAll("canvas"));
  const colorCanvas = canvases[1];
  const lineCanvas = canvases[2];
  const context = colorCanvas?.getContext("2d");
  const lineContext = lineCanvas?.getContext("2d");
  const pixel = context?.getImageData(512, 512, 1, 1).data;
  const linePixel = lineContext?.getImageData(512, 512, 1, 1).data;
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = 1024;
  compositeCanvas.height = 1024;
  const compositeContext = compositeCanvas.getContext("2d");

  if (compositeContext && colorCanvas && lineCanvas) {
    compositeContext.fillStyle = "#ffffff";
    compositeContext.fillRect(0, 0, 1024, 1024);
    compositeContext.drawImage(colorCanvas, 0, 0);
    compositeContext.drawImage(lineCanvas, 0, 0);
  }

  const compositePixel = compositeContext?.getImageData(512, 512, 1, 1).data;

  return {
    hasFiftyTree: document.body.innerText.includes("50 Pokemon coloring tree"),
    hasNoModelSwitcher: document.querySelectorAll("select").length === 0,
    hasUndoButton: Boolean(document.querySelector('button[aria-label="Undo"]')),
    hasDownloadButton: Boolean(
      document.querySelector('button[aria-label="Download PNG"]'),
    ),
    hasPosePicker: document.body.innerText.includes("Fighting"),
    fillPixel: pixel ? Array.from(pixel) : [],
    linePixel: linePixel ? Array.from(linePixel) : [],
    compositePixel: compositePixel ? Array.from(compositePixel) : [],
    layout: {
      bodyClientHeight: document.body.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      canvasCssSize: lineCanvas
        ? {
            height: Math.round(lineCanvas.getBoundingClientRect().height),
            width: Math.round(lineCanvas.getBoundingClientRect().width),
          }
        : null,
    },
    statusReady: document.body.innerText.includes("Charmander fighting ready"),
  };
});
after.generationRequests = generationRequests;
after.requestsAfterSelection = requestsAfterSelection;
after.requestsAfterPose = requestsAfterPose;

const screenshot = await page.screenshot({ fullPage: true });
await writeFile(screenshotPath, screenshot);
await browser.close();

console.log(
  JSON.stringify(
    {
      after,
      before,
      consoleErrors,
      screenshotPath,
    },
    null,
    2,
  ),
);
