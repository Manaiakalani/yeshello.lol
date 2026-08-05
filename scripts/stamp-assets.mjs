/**
 * Stamps a content hash onto the site's fixed-name assets.
 *
 * staticwebapp.config.json serves style.css and script.js with max-age=86400,
 * and manifest.json, favicon.ico and the PWA icons with max-age=2592000 and
 * `immutable`, while index.html is cached for only 30 seconds. `immutable` is a
 * promise the bytes at that URL will never change - which is false for a
 * fixed-name file we redeploy. Without a versioned URL a deploy publishes new
 * HTML that keeps resolving to the previously cached asset, and any CDN in
 * front of the origin (Cloudflare, here) holds the stale copy just as long.
 * That is not hypothetical: a deploy shipped new markup while Cloudflare kept
 * serving the old stylesheet (cf-cache-status: HIT, age: 3985).
 *
 * Rewriting `style.css` to `style.css?v=<hash>` gives each build a URL the CDN
 * has never seen, so the new asset is fetched immediately while unchanged
 * assets keep their long lifetime. The path is unchanged, so the exact-match
 * route rules in staticwebapp.config.json still apply, and servers ignore the
 * query when resolving the file from disk.
 *
 * The manifest's icons are stamped before the manifest is itself hashed, so a
 * changed icon propagates through the manifest to the HTML.
 *
 * Run from CI before deploying. Idempotent: an existing ?v= is replaced.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const MANIFEST = 'manifest.json';
const PAGES = ['index.html', '404.html'];
const check = process.argv.includes('--check');

// Text is hashed with newlines normalised: git stores LF but checks out CRLF on
// Windows, so hashing raw bytes would give a developer and CI different stamps
// for identical content and --check could never pass on both. Binary assets are
// hashed byte for byte.
const TEXT = new Set(['.css', '.js', '.mjs', '.json', '.svg', '.webmanifest']);

const hashes = new Map();
function hashOf(asset) {
  if (!hashes.has(asset)) {
    const file = join(ROOT, asset);
    if (!existsSync(file)) return null;
    const raw = readFileSync(file);
    const data = TEXT.has(extname(asset).toLowerCase())
      ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
      : raw;
    hashes.set(asset, createHash('sha256').update(data).digest('hex').slice(0, 8));
  }
  return hashes.get(asset);
}

const local = (ref) => ref.replace(/^\.?\//, '').split('?')[0];
const stale = [];
const gone = [];
const writes = new Map();

function update(name, next) {
  const file = join(ROOT, name);
  if (next === readFileSync(file, 'utf8')) return;
  stale.push(name);
  // Queued, not written: a run that later fails a check must not leave a
  // half-rewritten tree behind.
  writes.set(file, next);
}

// One source of truth for both the stamping patterns and the audit. When these
// drifted apart, the audit flagged references the stamper could not reach and
// turned them into deploy blocks with no in-repo workaround - which is how
// srcset failed. Deriving the patterns removes the possibility.
const EXT = 'css|js|mjs|json|webmanifest|ico|png|svg|webp|jpe?g|gif|avif';
const STAMPABLE = new RegExp(`\\.(?:${EXT})$`, 'i');
const EXTERNAL = /^(?:https?:|data:|\/\/|#|mailto:|\/cdn-cgi\/)/i;
const REF = new RegExp(`((?:href|src)=")([^"\\s]+\\.(?:${EXT})(?:\\?[^"\\s]*)?)(")`, 'gi');
const STAMPED = /[?&]v=[a-f0-9]{8}(?:&|$)/;

// Returns the URL unchanged when it is not ours to stamp, so callers can tell
// whether anything actually happened and leave untouched markup byte-identical.
function stampOne(url, where) {
  if (EXTERNAL.test(url)) return url;
  const path = url.split('?')[0];
  if (!STAMPABLE.test(path)) return url;
  const hash = hashOf(local(path));
  if (!hash) {
    // A reference to a file that isn't there is a broken link, and since this
    // gates the deploy it must block rather than warn.
    gone.push(`${where}: ${path}`);
    return url;
  }
  // Preserve any other query parameters rather than dropping them, so a ref
  // carrying one is stampable instead of being an unfixable deploy block.
  const rest = url
    .slice(path.length + 1)
    .split('&')
    .filter((p) => p && !p.startsWith('v='));
  return `${path}?${[...rest, `v=${hash}`].join('&')}`;
}

function stampRefs(text, where) {
  return text.replace(REF, (match, open, url, close) => {
    const next = stampOne(url, where);
    return next === url ? match : `${open}${next}${close}`;
  });
}

// srcset holds a comma-separated candidate list, each "url [descriptor]", so it
// cannot be stamped by a single-URL pattern. Retina markup would otherwise be
// unstampable and, thanks to the audit below, an outright deploy blocker.
function stampSrcset(text, where) {
  return text.replace(/(srcset=")([^"]*)(")/gi, (match, open, value, close) => {
    // A data: URI may itself contain commas, so splitting would corrupt it.
    if (/data:/i.test(value)) return match;
    let changed = false;
    const next = value.split(',').map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const url = parts[0];
      if (!url) return candidate.trim();
      const stamped = stampOne(url, where);
      if (stamped === url) return candidate.trim();
      changed = true;
      return [stamped, ...parts.slice(1)].join(' ');
    });
    // Rewriting only when a candidate changed keeps this gate from reformatting
    // markup it has no reason to touch.
    return changed ? `${open}${next.join(', ')}${close}` : match;
  });
}

// 1. Icon URLs inside the manifest, so a changed icon reaches installed PWAs.
if (existsSync(join(ROOT, MANIFEST))) {
  const icons = /("src"\s*:\s*")([^"]+)(")/g;
  const text = readFileSync(join(ROOT, MANIFEST), 'utf8');
  update(
    MANIFEST,
    text.replace(icons, (match, open, url, close) => {
      const next = stampOne(url, MANIFEST);
      return next === url ? match : `${open}${next}${close}`;
    }),
  );
  // The manifest's own hash must reflect the icon stamps just written.
  hashes.delete(MANIFEST);
}

// 2. Safety net. An unstamped local asset silently falls back to the long
//    immutable cache rule - srcset was missed exactly that way - so a reference
//    the patterns above do not reach must fail loudly rather than ship.
const ATTR = /(?:href|src|srcset)="([^"]+)"/gi;
const missed = [];

for (const page of PAGES) {
  if (!existsSync(join(ROOT, page))) continue;
  const stamped = stampSrcset(stampRefs(readFileSync(join(ROOT, page), 'utf8'), page), page);
  update(page, stamped);

  // Audit the text we just produced, not the file on disk: under --check
  // nothing was written, so re-reading would flag ordinary staleness as an
  // unreachable reference and send you hunting the wrong bug.
  for (const [, value] of stamped.matchAll(ATTR)) {
    if (/data:/i.test(value)) continue;
    for (const candidate of value.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (!url || STAMPED.test(url) || EXTERNAL.test(url)) continue;
      if (STAMPABLE.test(url.split('?')[0])) missed.push(`${page}: ${url}`);
    }
  }
}

for (const [asset, hash] of [...hashes].sort()) console.log(`    ${asset} -> ?v=${hash}`);

if (gone.length) {
  console.error('\nReferenced assets are missing from disk:');
  for (const g of gone) console.error(`  - ${g}`);
  console.error('These would deploy as broken links.');
  process.exit(1);
}

if (missed.length) {
  console.error('\nLocal asset references left unstamped:');
  for (const m of missed) console.error(`  - ${m}`);
  console.error('They would be served from the long immutable cache rule.');
  process.exit(1);
}

// Every check passed, so the queued rewrites are safe to land.
if (!check) for (const [file, text] of writes) writeFileSync(file, text);

if (!stale.length) {
  console.log('  = all asset references current');
} else {
  console.log(`  ${check ? 'x' : '+'} ${stale.join(', ')}`);
  if (check) {
    console.error('\nAsset references are unstamped or outdated.');
    console.error('Run `npm run stamp` and commit the result.');
    process.exit(1);
  }
}
