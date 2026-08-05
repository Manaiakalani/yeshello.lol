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

// A stamp only counts when it is a real query parameter. Terminating on & or #
// matters: "style.css#top&v=abc" carries the text but the browser never sends
// it, so the request is still for the unversioned URL.
export const STAMPED = /[?&]v=[a-f0-9]{8}(?:[&#]|$)/;

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
