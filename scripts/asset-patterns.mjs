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
 * Splits an attribute value into the URLs it references.
 *
 * srcset is a comma-separated list of "url [descriptor]"; every other attribute
 * holds a single URL whose query may legitimately contain a comma. Getting this
 * wrong breaks both ways, and both were live: splitting a plain href on commas
 * hard-blocked the deploy on `style.css?a=1,2`, while splitting srcset on
 * whitespace alone let `images/x.webp,data:image/gif;base64,...` hide a real
 * asset inside one token. Splitting on either separator is what surfaces it.
 */
export function candidates(value, srcset) {
  const raw = srcset ? value.split(/[\s,]+/) : [value];
  return raw.map((c) => c.trim()).filter(Boolean);
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
