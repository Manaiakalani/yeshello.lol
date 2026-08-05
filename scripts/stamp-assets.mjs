/**
 * Stamps a content hash onto local CSS/JS references in the HTML.
 *
 * staticwebapp.config.json caches style.css and script.js for 24 hours while
 * index.html is only cached for 30 seconds. Without a versioned URL a deploy
 * publishes new HTML that keeps pointing at the old, still-cached asset, so
 * visitors get a mismatched page for up to a day - and any CDN in front of the
 * origin (Cloudflare, here) holds the stale copy just as long.
 *
 * Rewriting `style.css` to `style.css?v=<hash>` gives each build a URL the CDN
 * has never seen, so the new asset is fetched immediately. The path is
 * unchanged, so the exact-match route rules in staticwebapp.config.json still
 * apply, and servers ignore the query when resolving the file from disk.
 *
 * Run from CI before deploying. Idempotent: an existing ?v= is replaced.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGES = ['index.html', '404.html'];
const check = process.argv.includes('--check');

const hashes = new Map();
function hashOf(asset) {
  if (!hashes.has(asset)) {
    const file = join(ROOT, asset);
    if (!existsSync(file)) return null;
    // Normalise newlines before hashing: git stores LF but checks out CRLF on
    // Windows, so hashing raw bytes would give a developer and CI different
    // stamps for identical content and --check could never pass on both.
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    hashes.set(asset, createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 8));
  }
  return hashes.get(asset);
}

// Local .css/.js only: absolute URLs keep their own cache headers, and the
// leading ./ or / is preserved so the reference resolves exactly as before.
const REF = /(<(?:link|script)\b[^>]*?\b(?:href|src)=")(?!https?:|\/\/)([^"?]+\.(?:css|js))(?:\?v=[^"]*)?(")/gi;

let stale = 0;
for (const page of PAGES) {
  const file = join(ROOT, page);
  if (!existsSync(file)) continue;

  const before = readFileSync(file, 'utf8');
  const after = before.replace(REF, (match, open, asset, close) => {
    const hash = hashOf(asset.replace(/^\.?\//, ''));
    if (!hash) {
      console.warn(`  ! ${page}: ${asset} not found on disk, left as-is`);
      return match;
    }
    return `${open}${asset}?v=${hash}${close}`;
  });

  if (after === before) {
    console.log(`  = ${page} already current`);
    continue;
  }
  stale++;
  if (check) {
    console.error(`  x ${page} has unstamped or outdated asset references`);
    continue;
  }
  writeFileSync(file, after);
  console.log(`  + ${page} stamped`);
}

for (const [asset, hash] of hashes) console.log(`    ${asset} -> ?v=${hash}`);

if (check && stale) {
  console.error('\nRun `npm run stamp` and commit the result.');
  process.exit(1);
}
