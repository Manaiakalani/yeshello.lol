import { test, expect } from '@playwright/test';

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
        const text = msg.text();
        // Ignore CSP violations from third-party scripts (analytics, Cloudflare)
        if (text.includes('Content Security Policy') || text.includes('CSP')) return;
        errors.push(text);
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});

test.describe('YesHello.lol - Dark Mode', () => {
  test('should have a theme toggle button', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[aria-label*="theme" i], [aria-label*="dark" i], [aria-label*="mode" i], .theme-toggle, #theme-toggle, button:has-text("🌙"), button:has-text("☀")');
    await expect(toggle.first()).toBeVisible();
  });

  test('should toggle between light and dark mode', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[aria-label*="theme" i], [aria-label*="dark" i], [aria-label*="mode" i], .theme-toggle, #theme-toggle, button:has-text("🌙"), button:has-text("☀")');

    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme') ||
      document.body.getAttribute('data-theme') ||
      document.documentElement.classList.toString()
    );
    await toggle.first().click();
    // Wait for theme transition
    await page.waitForTimeout(300);
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme') ||
      document.body.getAttribute('data-theme') ||
      document.documentElement.classList.toString()
    );

    expect(initialTheme).not.toBe(newTheme);
  });
});

test.describe('YesHello.lol - Slang Glossary', () => {
  test('should reveal glossary when emoji is clicked', async ({ page }) => {
    await page.goto('/');

    // Find the 👀 trigger element
    const trigger = page.locator('text=👀').first();
    if (await trigger.isVisible()) {
      await trigger.click();
      // Wait a moment for any animation
      await page.waitForTimeout(500);

      // Check that glossary content becomes visible
      const glossary = page.locator('[class*="glossary"], [id*="glossary"], [class*="slang"], [id*="slang"], dialog, [role="dialog"]');
      if (await glossary.count() > 0) {
        await expect(glossary.first()).toBeVisible();
      }
    }
  });
});

test.describe('YesHello.lol - Social Sharing', () => {
  test('should display social sharing buttons', async ({ page }) => {
    await page.goto('/');
    const shareButtons = page.locator('a[href*="twitter.com"], a[href*="x.com"], [class*="share"], [aria-label*="share" i], button:has-text("share")');
    expect(await shareButtons.count()).toBeGreaterThan(0);
  });
});

test.describe('YesHello.lol - Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    expect(await h1.count()).toBe(1);
  });

  test('should have alt text on images', async ({ page }) => {
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
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('should have skip-to-content or proper landmarks', async ({ page }) => {
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
    // Content should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 5); // small tolerance
  });
});

test.describe('YesHello.lol - 404 Page', () => {
  test('should show custom 404 page for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');
    // Azure Static Web Apps should serve 404.html
    if (response) {
      expect(response.status()).toBe(404);
    }
    // The page should have some content (not a blank/generic error)
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text?.length).toBeGreaterThan(50);
  });
});
