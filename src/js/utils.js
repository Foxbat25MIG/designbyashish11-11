/* Small helpers shared by every module. */

/** Site root, e.g. "/" locally or "/my-repo/" on GitHub Pages. Set by Vite's `base` option. */
export const BASE = import.meta.env.BASE_URL;

export const $ = (selector, root) => (root || document).querySelector(selector);
export const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Escape text, then turn **bold** into <strong>. */
export const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/**
 * Turn a path from the content files ("/media/hud/cover.png") into a real URL
 * that also works when the site lives in a sub-folder (GitHub Pages project sites).
 * Full http(s) URLs are returned untouched.
 */
export function url(path = "") {
  const p = String(path);
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(p)) return p;
  return BASE + p.replace(/^\/+/, "");
}

/** The current page path relative to the site root, always starting with "/" (e.g. "/", "/hud/"). */
export function routePath(pathname = location.pathname) {
  return pathname.startsWith(BASE) ? "/" + pathname.slice(BASE.length) : pathname;
}

/** The upper-case label shown in the preloader for a path. */
export function routeLabel(path) {
  return path === "/" || path === "" ? "/INDEX" : path.replace(/\/$/, "").toUpperCase();
}

/** Tiny markdown: paragraphs, "- " bullet lists and **bold**. Used for project text. */
export function md(text) {
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      out.push("<ul>" + list.map((i) => "<li>" + inline(i) + "</li>").join("") + "</ul>");
      list = [];
    }
  };
  String(text || "")
    .split(/\n\s*\n/)
    .forEach((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const bullets = lines.filter((l) => /^[-*] /.test(l));
      if (lines.length && bullets.length === lines.length) {
        lines.forEach((l) => list.push(l.slice(2)));
        flush();
      } else {
        flush();
        if (lines.length) out.push("<p>" + lines.map(inline).join("<br>") + "</p>");
      }
    });
  flush();
  return out.join("");
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
