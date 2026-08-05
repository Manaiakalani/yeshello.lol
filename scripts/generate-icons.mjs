/**
 * Generates the PWA icons referenced by manifest.json.
 *
 * Chromium only promotes an app as installable when a >=192px icon is
 * available, and a maskable icon needs its artwork inside the inner 80% safe
 * zone. Rendering through the browser (rather than upscaling the 180px
 * apple-touch-icon) keeps the mark crisp at 512px.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BACKGROUND = '#f8f8f8';

// scale = glyph size as a fraction of the canvas. Maskable art must stay within
// the inner 80% circle, so it is rendered smaller.
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 0.72 },
  { file: 'icon-512.png', size: 512, scale: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.52 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, scale } of ICONS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(`<!doctype html><meta charset="utf-8">
      <style>
        html,body{margin:0;padding:0;width:${size}px;height:${size}px;}
        body{display:flex;align-items:center;justify-content:center;background:${BACKGROUND};}
        span{font-size:${Math.round(size * scale)}px;line-height:1;
             font-family:"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif;}
      </style>
      <span>&#128075;</span>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(ROOT, file), omitBackground: false });
    await page.close();
    console.log(`wrote ${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
