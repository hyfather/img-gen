import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.SMOKE_URL ?? "http://localhost:3000";
const screenshotPath =
  process.env.SMOKE_SCREENSHOT ?? "/tmp/canvas-camp-smoke.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  deviceScaleFactor: 1,
  viewport: { width: 1440, height: 1000 },
});
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

await page.goto(url, { timeout: 30000, waitUntil: "networkidle" });
await page.waitForSelector("text=Canvas Camp", { timeout: 10000 });

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
  inputCount: document.querySelectorAll("input").length,
  svgCount: document.querySelectorAll("svg").length,
  title: document.title,
}));

await page.getByRole("button", { name: "Backgrounds" }).click();
await page.getByRole("button", { name: /Meadow Stage/i }).click();
await page.getByRole("button", { name: "Pokemon" }).click();
await page.getByRole("button", { name: /Fire/i }).click();
await page.waitForSelector("text=Charizard", { timeout: 5000 });
const charizardAvailable = await page.getByText("Charizard").isVisible();
await page.getByRole("button", { name: /Grass/i }).click();
await page.waitForSelector("text=Bulbasaur", { timeout: 5000 });
const bulbasaurAvailable = await page.getByText("Bulbasaur").isVisible();
await page.getByRole("button", { name: /Electric/i }).click();
const pikachuAvailable = await page.getByText("Pikachu").isVisible();
const topThreeAvailable =
  pikachuAvailable && charizardAvailable && bulbasaurAvailable;
await page.getByRole("button", { name: /Pikachu.*Add/i }).click();
await page.getByRole("button", { name: "Close settings" }).click();
await page.getByRole("button", { name: "Open settings" }).click();
await page.getByLabel("Name").fill("Kinder Card");
await page.getByRole("button", { name: /Outline/i }).click();

const after = await page.evaluate(() => ({
  backgroundImageCount: document.querySelectorAll("svg image").length,
  cardText: Array.from(document.querySelectorAll("svg text")).map((text) =>
    text.textContent?.trim(),
  ),
  inputValues: Array.from(document.querySelectorAll("input"))
    .map((input) => input.value)
    .slice(0, 8),
  nameInputEdited: Array.from(document.querySelectorAll("input")).some(
    (input) => input.value === "Kinder Card",
  ),
  panelSettingsButtonPresent: Array.from(document.querySelectorAll("button")).some(
    (button) => button.textContent?.trim() === "Close settings",
  ),
  outlineOff: Array.from(document.querySelectorAll("button")).some(
    (button) => button.textContent?.trim() === "OutlineOff",
  ),
  simplifiedCard:
    !Array.from(document.querySelectorAll("svg text")).some((text) =>
      ["Thunderbolt", "Electric type"].includes(
        text.textContent?.trim() ?? "",
      ),
    ) &&
    Array.from(document.querySelectorAll("svg text")).some((text) =>
      text.textContent?.trim().startsWith("Kinder"),
    ) &&
    Array.from(document.querySelectorAll("svg text")).some(
      (text) => text.textContent?.trim() === "HP 60",
    ),
  shapeButtonsRemoved: !document.body.innerText.includes("Box"),
  svgGroupCount: document.querySelectorAll("svg g").length,
}));
after.topThreeAvailable = topThreeAvailable;

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
