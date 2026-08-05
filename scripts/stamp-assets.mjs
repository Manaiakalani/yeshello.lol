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
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ATTR,
  EXTERNAL,
  LIST_VALUED,
  STAMPABLE,
  UNQUOTED,
  candidates,
  isStamped,
  malformed,
  parts,
  srcsetCandidates,
  srcsetText,
} from './asset-patterns.mjs';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const MANIFEST = 'manifest.json';

// Discovered, not listed, and recursively: a hard-coded page list means a new
// HTML file is neither stamped nor audited while the gate still exits 0.
const SKIP = new Set(['node_modules', '.git', 'test-results', 'playwright-report']);
function pagesIn(dir, prefix = '') {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) return SKIP.has(e.name) || e.name.startsWith('.') ? [] : pagesIn(rel, rel);
    return /\.x?html?$/i.test(e.name) ? [rel] : [];
  });
}
const PAGES = pagesIn('.');
const check = process.argv.includes('--check');

// Text is hashed with newlines normalised: git stores LF but checks out CRLF on
// Windows, so hashing raw bytes would give a developer and CI different stamps
// for identical content and --check could never pass on both. Binary assets are
// hashed byte for byte.
const TEXT = new Set(['.css', '.js', '.mjs', '.json', '.svg', '.webmanifest']);

const stale = [];
const gone = [];
const missed = [];
const writes = new Map();

const hashes = new Map();
function hashOf(asset) {
  if (!hashes.has(asset)) {
    const file = join(ROOT, asset);
    // Pending rewrites have to be visible here: the manifest is hashed straight
    // after its icons are stamped, and reading the unmodified file from disk
    // would stamp the HTML with the manifest's pre-stamp hash. That made an
    // icon-only change need two `npm run stamp` runs, the first --check after
    // the correct action failing with advice the developer had just followed.
    const pending = writes.get(file);
    if (pending === undefined && !existsSync(file)) return null;
    const raw = pending === undefined ? readFileSync(file) : Buffer.from(pending, 'utf8');
    const data = TEXT.has(extname(asset).toLowerCase())
      ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
      : raw;
    hashes.set(asset, createHash('sha256').update(data).digest('hex').slice(0, 8));
  }
  return hashes.get(asset);
}

// A reference resolves against the page that carries it, not the site root, so
// a page in a subdirectory hashes the file the browser would actually fetch.
// Getting this wrong would turn every relative ref on such a page into a
// "missing asset" block with no in-repo workaround.
function local(ref, page) {
  const path = parts(ref).path;
  const base = path.startsWith('/') ? '' : page.slice(0, page.lastIndexOf('/') + 1);
  const segs = [];
  for (const s of `${base}${path}`.split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') segs.pop();
    else segs.push(s);
  }
  return segs.join('/');
}

function update(name, next) {
  const file = join(ROOT, name);
  if (next === readFileSync(file, 'utf8')) return;
  stale.push(name);
  // Queued, not written: a run that later fails a check must not leave a
  // half-rewritten tree behind.
  writes.set(file, next);
}

// Returns the URL unchanged when it is not ours to stamp, so callers can tell
// whether anything actually happened and leave untouched markup byte-identical.
function stampOne(url, where) {
  if (EXTERNAL.test(url)) return url;
  const { path, query, frag } = parts(url);
  if (!STAMPABLE.test(path)) return url;
  const hash = hashOf(local(path, where));
  if (!hash) {
    // A reference to a file that isn't there is a broken link, and since this
    // gates the deploy it must block rather than warn.
    gone.push(`${where}: ${path}`);
    return url;
  }
  // Preserve any other query parameters rather than dropping them, so a ref
  // carrying one is stampable instead of being an unfixable deploy block. The
  // fragment is re-appended last: appending after it would put the stamp in a
  // part the browser never sends, leaving the request unversioned.
  const rest = query.split('&').filter((p) => p && !p.startsWith('v='));
  return `${path}?${[...rest, `v=${hash}`].join('&')}${frag}`;
}

// A single pass over every reference-bearing attribute. Stamping used to run
// two regexes of its own and the audit a third, each with its own idea of which
// attributes and which quote style counted; single-quoted attributes and
// `poster` were reachable by none of them.
function stampAttrs(text, where) {
  return text.replace(ATTR(), (match, name, quote, value) => {
    let next;
    if (LIST_VALUED.test(name)) {
      const list = srcsetCandidates(value);
      const stamped = list.map((c) => ({ ...c, url: stampOne(c.url, where) }));
      next = stamped.some((c, i) => c.url !== list[i].url) ? srcsetText(stamped) : value;
    } else {
      // Surrounding whitespace is preserved rather than trimmed: browsers strip
      // it, so reformatting it would be a change this gate has no reason to make.
      const [, lead, core, trail] = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
      next = core ? lead + stampOne(core, where) + trail : value;
    }
    return next === value ? match : `${name}=${quote}${next}${quote}`;
  });
}

// 1. Icon URLs inside the manifest, so a changed icon reaches installed PWAs.
//    stampOne skips absolute icon URLs, so no second exclusion list is needed.
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
  // The manifest's own hash must reflect the icon stamps just queued.
  hashes.delete(MANIFEST);
}

// 2. Safety net. An unstamped local asset silently falls back to the long
//    immutable cache rule - srcset was missed exactly that way - so a reference
//    the patterns above do not reach must fail loudly rather than ship.
const ATTR_NAMES = LIST_VALUED;

for (const page of PAGES) {
  const stamped = stampAttrs(readFileSync(join(ROOT, page), 'utf8'), page);
  update(page, stamped);

  // Audit the text we just produced, not the file on disk: under --check
  // nothing was written, so re-reading would flag ordinary staleness as an
  // unreachable reference and send you hunting the wrong bug.
  for (const [, name, , value] of stamped.matchAll(ATTR())) {
    for (const url of candidates(value, ATTR_NAMES.test(name))) {
      if (isStamped(url) || EXTERNAL.test(url)) continue;
      if (STAMPABLE.test(parts(url).path)) missed.push(`${page}: ${url}`);
      // A malformed candidate would otherwise be skipped in silence.
      else if (malformed(url)) missed.push(`${page}: ${url} (malformed reference)`);
    }
  }
  for (const [m] of stamped.matchAll(UNQUOTED())) {
    missed.push(`${page}: ${m.trim()} (unquoted attribute - add quotes)`);
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
