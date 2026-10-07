/* Visual check: screenshots across viewport + color-scheme.
 * Usage: node scripts/screenshot.mjs   (server must be on :3100)
 * Output: /tmp/mc-shots/*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const OUT = "/tmp/mc-shots";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function sessionCookie() {
  const req = await fetch(`${BASE}/api/auth/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "0811 222 3334" }),
  });
  const issued = await req.json();
  const code = issued.devOtp;
  if (!code) throw new Error(`no dev otp: ${JSON.stringify(issued)}`);
  const res = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "08112223334", code }),
  });
  const raw = res.headers.getSetCookie().find((c) => c.startsWith("mc_session="));
  if (!raw) throw new Error("no session cookie");
  return raw.split(";")[0];
}

const PAGES = ["/dashboard", "/food", "/expenses", "/budget", "/settings"];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

const cookie = await sessionCookie();
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    await ctx.addCookies([{ name: "mc_session", value: cookie.split("=").slice(1).join("="), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(700); // let animations settle
      await page.screenshot({ path: `${OUT}/${vp.name}-${scheme}-${path.slice(1)}.png`, fullPage: true });
      console.log(`✓ ${vp.name}-${scheme}-${path.slice(1)}.png`);
    }
    await ctx.close();
  }
}

// Login page (signed out) on mobile light
const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await anon.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/mobile-light-login.png`, fullPage: true });
console.log("✓ mobile-light-login.png");

await browser.close();
