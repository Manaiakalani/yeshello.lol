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
        if (text.includes('Content Security Policy') || text.includes('CSP')) return;
        errors.push(text);
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('should have hero image visible', async ({ page }) => {
    await page.goto('/');
    const heroImg = page.locator('.featured-image');
    await expect(heroImg).toBeVisible();
    await expect(heroImg).toHaveAttribute('alt', /.+/);
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
