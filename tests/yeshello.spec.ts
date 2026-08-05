import { test, expect, type Page } from '@playwright/test';
import {
  ATTR,
  EXTERNAL,
  LIST_VALUED,
  STAMPABLE,
  candidates,
  isStamped,
  parts,
} from '../scripts/asset-patterns.mjs';

/**
 * Cloudflare fronts production and injects two scripts into the HTML at the
 * edge: the Web Analytics beacon, and the Bot Management challenge bootstrap
 * (an inline script carrying a per-request token). Our CSP blocks both.
 *
 * Neither is fixable from this repo. The beacon's origin could be allow-listed,
 * but the inline bootstrap embeds a fresh token per request, so its hash is
 * never stable and no nonce can be issued from static hosting - only
 * 'unsafe-inline' would admit it, which is exactly the hole that let the
 * original font bug ship. The fix is to turn these off in the Cloudflare
 * dashboard, not to weaken the policy.
 *
 * So attribute those two and only those two, and keep failing on anything we
 * actually serve. The inline case is confirmed against the DOM the CSP was
 * applied to - CSP blocks execution, not parsing, so a blocked inline script is
 * still in the document. Reading it back from a second HTTP request would be
 * unsound: Cloudflare can answer a bare API client with a bot challenge, whose
 * only inline script is Cloudflare's, which would excuse every real violation
 * on the page we actually loaded.
 *
 * The exemption applies only while every executable inline script in the
 * document is Cloudflare's, so adding one of our own lapses it for the page.
 */
async function ours(messages: string[], page: Page): Promise<string[]> {
  if (!messages.some((m) => /content security policy/i.test(m))) return messages;

  const inlineScripts = await page.$$eval('script:not([src])', (els) =>
    els
      // JSON-LD is data, not script: the CSP never evaluates it.
      .filter((e) => !/^application\/(ld\+)?json$/i.test((e as HTMLScriptElement).type))
      .map((e) => e.textContent ?? ''),
  );

  const allInlineIsCloudflare =
    inlineScripts.length > 0 &&
    inlineScripts.every((s) => /__CF\$cv\$params|cdn-cgi\/challenge-platform/.test(s));

  return messages.filter((m) => {
    if (!/content security policy/i.test(m)) return true;
    if (/cloudflareinsights\.com/.test(m)) return false;
    if (allInlineIsCloudflare && /inline script/i.test(m)) return false;
    return true;
  });
}

test.describe('YesHello.lol - Page Load & Structure', () => {
  test('should load the homepage with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/yes,?\s*hello/i);
  });

  test('should display the hero section', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/hello/i);
  });

  test('should have a meta description', async ({ page }) => {
    await page.goto('/');
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('should load without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    // Uncaught exceptions surface as 'pageerror', not 'console', so listening
    // only for console errors would miss a script that throws on load.
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await ours(errors, page)).toHaveLength(0);
  });

  // Regression guard: the stylesheet used to rely on an inline
  // onload="this.media='all'" handler, which our CSP blocks, so fonts silently
  // never loaded in production.
  test('should not rely on inline handlers blocked by CSP', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && /content security policy/i.test(text)) {
        violations.push(text);
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const mine = await ours(violations, page);
    expect(mine, `CSP violations: ${mine.join(' | ')}`).toHaveLength(0);

    const printOnly = await page.locator('link[rel="stylesheet"][media="print"]').count();
    expect(printOnly).toBe(0);

    // The two assertions above still pass if the font link is deleted outright,
    // so check the markup the CSP would block and that the fonts really arrive.
    // Read it from the loaded document rather than a second request, which
    // Cloudflare may answer with a challenge page that passes vacuously.
    const inlineHandlers = await page.evaluate(() =>
      [...document.querySelectorAll('*')].flatMap((el) =>
        [...el.attributes].filter((a) => /^on[a-z]+$/i.test(a.name)).map((a) => `${el.tagName.toLowerCase()}[${a.name}]`),
      ),
    );
    expect(inlineHandlers, `inline handlers are blocked by our CSP`).toEqual([]);

    const fontLink = page.locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
    await expect(fontLink).toHaveCount(1);
    await expect(fontLink).not.toHaveAttribute('media', 'print');

    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))];
    });
    expect(families, 'webfonts should actually load, not just be linked').toEqual(
      expect.arrayContaining(['Manrope', 'Poppins'])
    );
  });

  test('should send the expected security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('should have hero image visible', async ({ page }) => {
    await page.goto('/');
    const heroImg = page.locator('.featured-image');
    await expect(heroImg).toBeVisible();
    await expect(heroImg).toHaveAttribute('alt', /.+/);
  });

  // Regression guard: declared dimensions must match the real intrinsic size,
  // otherwise the browser reserves the wrong aspect ratio and the layout shifts.
  test('hero image width/height should match its intrinsic ratio', async ({ page }) => {
    await page.goto('/');
    const heroImg = page.locator('.featured-image');
    const declared = await heroImg.evaluate((el: HTMLImageElement) => ({
      w: Number(el.getAttribute('width')),
      h: Number(el.getAttribute('height')),
    }));
    await expect
      .poll(async () =>
        heroImg.evaluate((el: HTMLImageElement) => el.naturalWidth > 0)
      )
      .toBe(true);
    const intrinsic = await heroImg.evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
    }));
    expect(Math.abs(declared.w / declared.h - intrinsic.w / intrinsic.h)).toBeLessThan(0.01);
  });
});

test.describe('YesHello.lol - Dark Mode', () => {
  test('should have a theme toggle button', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-testid="theme-toggle"], #theme-toggle');
    await expect(toggle.first()).toBeVisible();
  });

  test('should toggle between light and dark mode', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-testid="theme-toggle"], #theme-toggle');

    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    await toggle.first().click();
    await page.waitForTimeout(300);
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );

    expect(initialTheme).not.toBe(newTheme);
  });
});

test.describe('YesHello.lol - Colour Contrast', () => {
  // The orange is used both as foreground text and as a button background, and it
  // changes per theme. A value that passes as text can still fail behind white
  // label text, so assert the real computed pairs in both themes.
  test('key controls meet WCAG AA in both themes', async ({ page }) => {
    await page.goto('/');

    const samples = await page.evaluate(() => {
      // Buttons transition background-color, so reading straight after flipping
      // the theme would capture an in-flight colour and make this test flaky.
      const freeze = document.createElement('style');
      freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(freeze);

      const lum = (rgb: number[]) =>
        0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
      function ch(v: number) {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const overlay = (fg: number[], bg: number[]) => {
        const a = fg[3] ?? 1;
        return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
      };
      // .term backgrounds are translucent and can stack (a term inside
      // .bad-hello-tag composites purple over red), so flatten the ancestor
      // chain instead of reading one possibly see-through layer.
      const effectiveBg = (el: HTMLElement) => {
        const stack: number[][] = [];
        let node: HTMLElement | null = el;
        while (node) {
          const c = parse(getComputedStyle(node).backgroundColor);
          if (c.length && (c[3] ?? 1) > 0) stack.push(c);
          node = node.parentElement;
        }
        let base = [255, 255, 255];
        for (let i = stack.length - 1; i >= 0; i--) base = overlay(stack[i], base);
        return base;
      };
      const ratio = (fg: number[], bg: number[]) => {
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      };

      const buttons = [
        { name: 'skip-link', sel: '.skip-link' },
        { name: 'close-flyout', sel: '#close-flyout' },
        { name: 'share-copy', sel: '.share-btn.copy, .copy' },
      ];

      const out: {
        theme: string;
        name: string;
        state: string;
        kind: string;
        ratio: number;
        fg: string;
        bg: string;
      }[] = [];
      // Every .term, not a sample: `color` used to be `inherit`, so a term's
      // legibility depended on where it sat. A term in the footer picked up the
      // muted --footer-text and fell to 2.83:1 while the sampled ones passed.
      const terms = Array.from(document.querySelectorAll('.term')) as HTMLElement[];
      const context = (el: HTMLElement) =>
        el.closest('.bad-hello-tag')
          ? 'bad-tag'
          : el.closest('.footer')
            ? 'footer'
            : el.closest('.section-title')
              ? 'section-title'
              : el.closest('#slang-flyout')
                ? 'glossary'
                : 'inline';

      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        for (const t of buttons) {
          const el = document.querySelector(t.sel) as HTMLElement | null;
          if (!el) continue;
          const fg = parse(getComputedStyle(el).color);
          const bg = effectiveBg(el);
          out.push({
            theme,
            name: t.name,
            state: 'rest',
            kind: 'button',
            ratio: ratio(fg, bg),
            fg: getComputedStyle(el).color,
            bg: `rgb(${bg.map(Math.round).join(', ')})`,
          });
        }
        for (const el of terms) {
          const fg = parse(getComputedStyle(el).color);
          const original = el.style.backgroundColor;
          // rest, plus the :hover and pulse-highlight peak alphas.
          const states: [string, string | null][] = [
            ['rest', null],
            ['hover', 'rgba(157, 78, 221, 0.25)'],
            ['pulse', 'rgba(157, 78, 221, 0.5)'],
          ];
          for (const [state, override] of states) {
            if (override) el.style.backgroundColor = override;
            const bg = effectiveBg(el);
            out.push({
              theme,
              name: `${context(el)} term "${(el.textContent ?? '').trim().slice(0, 16)}"`,
              state,
              kind: 'term',
              ratio: ratio(fg, bg),
              fg: getComputedStyle(el).color,
              bg: `rgb(${bg.map(Math.round).join(', ')})`,
            });
            el.style.backgroundColor = original;
          }
        }
      }
      freeze.remove();
      return { out, termCount: terms.length, contexts: [...new Set(terms.map(context))].sort() };
    });

    const { out: results, termCount, contexts } = samples;

    // Guard against a vacuous pass: every term must be sampled in both themes at
    // all three states, and the four placement contexts must all still exist.
    expect(termCount).toBeGreaterThan(20);
    expect(contexts).toEqual(['bad-tag', 'footer', 'glossary', 'inline', 'section-title']);
    expect(results.filter((r) => r.kind === 'button')).toHaveLength(3 * 2);
    expect(results.filter((r) => r.kind === 'term')).toHaveLength(termCount * 3 * 2);

    for (const r of results) {
      expect(
        r.ratio,
        `${r.name} (${r.state}) in ${r.theme} mode: ${r.fg} on ${r.bg}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // .theme-toggle sits on a gradient, so getComputedStyle reports its
  // background as transparent and the sweep above skips it. Its label was white
  // and failed against every stop, so sample the declared stops directly.
  test('theme toggle label is legible across its gradient', async ({ page }) => {
    await page.goto('/');

    const samples = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const ch = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (c: number[]) => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
      const ratio = (f: number[], g: number[]) => {
        const [a, b] = [lum(f), lum(g)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      };
      const resolve = (value: string) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.appendChild(probe);
        const rgb = parse(getComputedStyle(probe).color);
        probe.remove();
        return rgb;
      };

      const out: { theme: string; part: string; stop: string; ratio: number }[] = [];
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        const root = getComputedStyle(document.documentElement);
        // Both endpoints of `linear-gradient(135deg, start, end)`.
        const stops = ['--genz-gradient-start', '--genz-gradient-end'].map((n) => ({
          name: n,
          rgb: resolve(root.getPropertyValue(n).trim()),
        }));
        for (const sel of ['.toggle-label', '.icon-sun', '.icon-moon']) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const fg = parse(getComputedStyle(el).color);
          for (const stop of stops) {
            out.push({ theme, part: sel, stop: stop.name, ratio: ratio(fg, stop.rgb) });
          }
        }
      }
      return out;
    });

    expect(samples.length).toBeGreaterThanOrEqual(2 * 2);
    for (const s of samples) {
      expect(
        s.ratio,
        `${s.part} on ${s.stop} in ${s.theme} mode`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The <h1> cycles through @keyframes color-change, so a single computed-style
  // snapshot only samples one instant. Assert every declared stop instead.
  test('animated h1 stays legible at every keyframe stop', async ({ page }) => {
    await page.goto('/');

    const samples = await page.evaluate(() => {
      // Card backgrounds transition too, so freeze before sampling (see above).
      const freeze = document.createElement('style');
      freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(freeze);

      function ch(v: number) {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }
      const lum = (c: number[]) => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
      const parse = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
      const ratio = (fg: string, bg: string) => {
        const [a, b] = [lum(parse(fg)), lum(parse(bg))].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      };

      // Pull the declared colour of each keyframe stop out of the stylesheet.
      const stops: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRule[];
        try {
          rules = Array.from(sheet.cssRules);
        } catch {
          continue; // cross-origin sheet
        }
        for (const rule of rules) {
          if (rule instanceof CSSKeyframesRule && rule.name === 'color-change') {
            for (const kf of Array.from(rule.cssRules) as CSSKeyframeRule[]) {
              const c = kf.style.getPropertyValue('color').trim();
              if (c) stops.push(c);
            }
          }
        }
      }

      const title = document.querySelector('.main-title') as HTMLElement;
      // Resolve declared values (literals *and* var()) by letting the engine do it.
      const probe = document.createElement('span');
      title.appendChild(probe);

      const out: { theme: string; declared: string; resolved: string; bg: string; ratio: number }[] = [];
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        let node: HTMLElement | null = title.parentElement;
        let bg = 'rgb(255, 255, 255)';
        while (node) {
          const c = getComputedStyle(node).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)') {
            bg = c;
            break;
          }
          node = node.parentElement;
        }
        for (const declared of stops) {
          probe.style.color = declared;
          const resolved = getComputedStyle(probe).color;
          out.push({ theme, declared, resolved, bg, ratio: ratio(resolved, bg) });
        }
      }
      probe.remove();
      freeze.remove();
      return out;
    });

    // 3 stops x 2 themes; if the keyframes stop being found this drops to 0.
    expect(samples.length).toBe(6);
    for (const s of samples) {
      // .main-title is 40px/700, i.e. WCAG "large text", so the threshold is 3:1.
      expect(
        s.ratio,
        `${s.theme} mode stop ${s.declared} -> ${s.resolved} on ${s.bg}`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

test.describe('YesHello.lol - Slang Glossary', () => {
  test('should open glossary and set correct aria states', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-testid="glossary-trigger"], #secret-emoji');
    const flyout = page.locator('[data-testid="glossary-flyout"], #slang-flyout');

    // Initially hidden
    await expect(flyout.first()).toHaveAttribute('aria-hidden', 'true');

    // Open glossary
    await trigger.first().click();
    await page.waitForTimeout(500);

    // Should be visible with correct aria state
    await expect(flyout.first()).toHaveAttribute('aria-hidden', 'false');

    // Verify aria-expanded toggles when JS supports it
    const expandedAfter = await trigger.first().getAttribute('aria-expanded');
    if (expandedAfter === 'true') {
      // JS toggled it - verify the full cycle
      const closeFlyoutBtn = page.locator('[data-testid="close-flyout"], #close-flyout');
      await closeFlyoutBtn.first().click();
      await page.waitForTimeout(300);
      await expect(trigger.first()).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('should close glossary with close button and return focus', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-testid="glossary-trigger"], #secret-emoji');
    const flyout = page.locator('[data-testid="glossary-flyout"], #slang-flyout');
    const closeBtn = page.locator('[data-testid="glossary-close"], #close-flyout');

    // Open then close
    await trigger.first().click();
    await page.waitForTimeout(500);
    await closeBtn.first().click();
    await page.waitForTimeout(300);

    // Should be hidden again
    await expect(flyout.first()).toHaveAttribute('aria-hidden', 'true');

    // Focus should return to the trigger
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('secret-emoji');
  });

  test('should close glossary with Escape key', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-testid="glossary-trigger"], #secret-emoji');
    const flyout = page.locator('[data-testid="glossary-flyout"], #slang-flyout');

    await trigger.first().click();
    await page.waitForTimeout(500);
    await expect(flyout.first()).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(flyout.first()).toHaveAttribute('aria-hidden', 'true');
  });

  // The PWA manifest advertises a /#slang-flyout shortcut, which previously
  // landed on the homepage without opening anything.
  test('should open glossary from the #slang-flyout deep link', async ({ page }) => {
    await page.goto('/#slang-flyout');
    const flyout = page.locator('[data-testid="glossary-flyout"], #slang-flyout');
    await expect(flyout.first()).toHaveAttribute('aria-hidden', 'false');
  });
});

test.describe('YesHello.lol - Slang Terms', () => {
  // Regression guard: the typing animation used to re-parse innerHTML, which
  // discarded the listeners bound to .term nodes and left focusable
  // role="button" elements that did nothing.
  test('terms stay interactive after the message animation', async ({ page }) => {
    await page.goto('/');

    const term = page.locator('.good-hello .term[data-term]').first();
    await term.scrollIntoViewIfNeeded();

    // Wait out the staggered typing animation before asserting.
    await page.waitForTimeout(6000);

    await expect(term).toHaveAttribute('role', 'button');
    await expect(term).toHaveAttribute('tabindex', '0');

    await term.click();
    await expect(term).toHaveClass(/term-highlight/);
  });
});

test.describe('YesHello.lol - Social Sharing', () => {
  test('should display share buttons', async ({ page }) => {
    await page.goto('/');
    const shareButtons = page.locator('[data-testid="share-x"], .x-share, [data-testid="share-copy"], .copy');
    expect(await shareButtons.count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe('YesHello.lol - Accessibility', () => {
  test('should have exactly one h1', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    expect(await h1.count()).toBe(1);
  });

  test('should have alt text on all images', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt, `Image ${i} missing alt text`).toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('should have proper landmarks', async ({ page }) => {
    await page.goto('/');
    const landmarks = page.locator('main, [role="main"], nav, [role="navigation"], header, footer');
    expect(await landmarks.count()).toBeGreaterThan(0);
  });
});

test.describe('YesHello.lol - Responsive Design', () => {
  test('should render correctly on mobile viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Viewport test only on Chromium');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 5);
  });
});

test.describe('YesHello.lol - PWA', () => {
  test('manifest icons should resolve and match declared sizes', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifest = await (await request.get(href!)).json();
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), `${icon.src} should exist`).toBe(200);

      // PNGs carry their dimensions at a fixed offset in the IHDR chunk.
      if (icon.type === 'image/png') {
        const buf = await res.body();
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        expect(`${width}x${height}`, `${icon.src} size mismatch`).toBe(icon.sizes);
      }
    }

    // Chromium requires a >=192px icon before offering installation.
    const largest = Math.max(
      ...manifest.icons.map((i: { sizes: string }) => Number(i.sizes.split('x')[0]))
    );
    expect(largest).toBeGreaterThanOrEqual(192);
  });

  test('manifest theme_color should match the document theme-color', async ({ request }) => {
    // Read the raw HTML so the assertion is not affected by the runtime theme
    // switching that script.js applies to the meta tag.
    const html = await (await request.get('/')).text();
    const meta = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i);
    expect(meta, 'theme-color meta tag should be present').toBeTruthy();

    const manifest = await (await request.get('/manifest.json')).json();
    expect(manifest.theme_color.toLowerCase()).toBe(meta![1].toLowerCase());
  });
});

test.describe('YesHello.lol - Cache Busting', () => {
  // style.css and script.js are served with max-age=86400 while index.html is
  // only cached for 30s, so an unversioned reference makes a deploy publish new
  // HTML against a day-old asset. This happened in production: the CDN kept
  // serving the previous stylesheet after the page itself had updated.
  for (const [page, assets] of [
    ['/', ['style.css', 'script.js', 'manifest.json', 'favicon.ico', 'images/']],
    ['/404.html', ['error.css']],
  ] as const) {
    test(`${page} references its assets with a content hash`, async ({ request }) => {
      const html = await (await request.get(page)).text();
      // Covers srcset too: the <source> WebP is what most browsers actually
      // fetch, and it sits under the 30-day immutable /images/* rule.
      // The patterns come from the stamper's own module: a fourth hand-copy of
      // this list is exactly the drift that let srcset, and later .mjs, slip.
      const refs = [...html.matchAll(ATTR())]
        .flatMap((m) => candidates(m[3], LIST_VALUED.test(m[1])))
        .filter((u) => !EXTERNAL.test(u) && STAMPABLE.test(parts(u).path));
      expect(refs.length, `expected local asset refs in ${page}`).toBeGreaterThanOrEqual(
        assets.length,
      );

      for (const ref of refs) {
        expect(
          isStamped(ref),
          `${ref} must carry a ?v= hash in the query the browser actually sends`,
        ).toBe(true);
        // The hash is only useful if the versioned URL still resolves.
        const res = await request.get(ref.startsWith('/') ? ref : `/${ref}`);
        expect(res.status(), `${ref} should resolve`).toBe(200);
      }
      for (const asset of assets) {
        expect(
          refs.some((r) => r.includes(asset)),
          `${page} should reference ${asset}`,
        ).toBe(true);
      }
    });
  }
});

test.describe('YesHello.lol - 404 Page', () => {
  test('should show custom 404 page with proper content', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');
    if (response) {
      expect(response.status()).toBe(404);
    }
    const errorCode = page.locator('.error-code');
    await expect(errorCode).toContainText('404');
    const errorTitle = page.locator('.error-title');
    await expect(errorTitle).toBeVisible();
    const homeLink = page.locator('.home-link');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');
  });
});
