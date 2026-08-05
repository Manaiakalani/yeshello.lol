/**
 * The single definition of what counts as a stampable local asset.
 *
 * These lists lived in three hand-copied places - the stamping regex, the
 * audit, and the Playwright spec - and drift between them is one-directionally
 * fatal: the audit recognising a reference the stamper cannot reach turns into
 * a deploy block with no in-repo workaround. That is exactly how srcset, and
 * later .mjs, slipped through. Everything imports from here instead.
 */

// Extensions we hash and version. Anything served from a long-lived cache rule
// in staticwebapp.config.json belongs in this list.
export const EXT = 'css|js|mjs|json|webmanifest|ico|png|svg|webp|jpe?g|gif|avif';

// References that are not ours to version: other origins, inline payloads,
// in-page anchors, and Cloudflare's own edge-injected paths.
export const EXTERNAL = /^(?:https?:|data:|\/\/|#|mailto:|\/cdn-cgi\/)/i;

export const STAMPABLE = new RegExp(`\\.(?:${EXT})$`, 'i');

// A stamp only counts when it is a real query parameter. This is tested against
// parts(url).query, never the whole URL: "style.css#top&v=abcdef12" carries the
// text but lives in the fragment, which the browser never sends, so the request
// is still for the unversioned URL.
export const STAMPED = /(?:^|&)v=[a-f0-9]{8}(?:&|$)/;

/** True when a reference already carries a usable stamp. */
export function isStamped(url) {
  return STAMPED.test(parts(url).query);
}

/**
 * Every place a reference can live. Kept here so the stamper, the audit and the
 * spec cannot disagree about where to look - `poster` and single-quoted
 * attributes were both invisible to all three at once, which is the silent half
 * of this bug class: unstamped and unflagged, under a 30-day immutable rule.
 *
 * A factory, because a /g regex carries lastIndex between uses.
 */
export const ATTR = () =>
  /(?<![-\w:])(xlink:href|href|src|srcset|imagesrcset|poster)\s*=\s*(["'])(.*?)\2/gis;

/** The attributes whose value is a candidate list rather than a single URL. */
export const LIST_VALUED = /^(?:image)?srcset$/i;

/**
 * A reference-bearing attribute with an unquoted value. Legal HTML, and the
 * browser fetches it, but ATTR() cannot reach it - so without this it would
 * ship unstamped in silence. Blocking is right: adding quotes is an obvious
 * in-repo remedy, unlike the alternative of a second rewrite path.
 */
export const UNQUOTED = () =>
  /(?<![-\w:])(?:xlink:href|href|src|srcset|imagesrcset|poster)\s*=\s*[^\s"'=<>`]+/gi;

/**
 * Splits a srcset value the way the HTML parser does.
 *
 * The rule is positional, and the asymmetry is the entire point. In URL
 * position a comma is part of the URL unless it trails it, so
 * `images/x.webp?a=1,2` is one URL - splitting on every comma corrupted it into
 * two bogus candidates. In descriptor position the first comma ends the
 * candidate, so `a.webp 1x,b.webp 2x` is two candidates - treating only a
 * trailing comma as a terminator swallowed the second one entirely, which is
 * the compact form every minifier emits.
 *
 * Both readings were confirmed against Chromium rather than inferred: it
 * fetches `/images/x.webp?a=1,2` whole, and at DPR 2 it fetches `/b.webp`.
 */
export function srcsetCandidates(value) {
  const out = [];
  let cur = null;
  for (let token of value.split(/\s+/)) {
    while (token) {
      if (!cur) {
        // Leading commas are separators the browser skips over.
        token = token.replace(/^,+/, '');
        if (!token) break;
        const url = token.replace(/,+$/, '');
        cur = { url, desc: [] };
        if (url !== token) {
          out.push(cur);
          cur = null;
        }
        token = '';
      } else {
        const comma = token.indexOf(',');
        const head = comma === -1 ? token : token.slice(0, comma);
        if (head) cur.desc.push(head);
        if (comma === -1) {
          token = '';
        } else {
          out.push(cur);
          cur = null;
          token = token.slice(comma + 1);
        }
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Rebuilds a srcset value from the candidate list above. */
export const srcsetText = (list) => list.map((c) => [c.url, ...c.desc].join(' ')).join(', ');

/**
 * The URLs an attribute value resolves to, exactly as the browser would fetch
 * them. srcset carries a candidate list; every other attribute holds a single
 * URL whose query may legitimately contain a comma.
 */
export function candidates(value, srcset) {
  return srcset ? srcsetCandidates(value).map((c) => c.url) : [value.trim()].filter(Boolean);
}

/**
 * True when a reference is not stampable yet still looks like it was meant to
 * point at a stampable asset - a stampable extension buried mid-URL rather than
 * ending it. `a.webp,data:image/gif;base64,X` is one such: the browser requests
 * that whole string and 404s. Without this the malformed candidate is skipped
 * in silence, which is the failure mode this gate exists to prevent.
 */
export function malformed(url) {
  const { path } = parts(url);
  return !STAMPABLE.test(path) && new RegExp(`\\.(?:${EXT})[^/]`, 'i').test(path);
}

/** Splits a reference into its path, query and fragment. */
export function parts(url) {
  const hash = url.indexOf('#');
  const frag = hash === -1 ? '' : url.slice(hash);
  const bare = hash === -1 ? url : url.slice(0, hash);
  const q = bare.indexOf('?');
  return {
    path: q === -1 ? bare : bare.slice(0, q),
    query: q === -1 ? '' : bare.slice(q + 1),
    frag,
  };
}
