/* Page "chrome": clocks, theme toggle, smooth scrolling, footer. */
import Lenis from "lenis";
import { $, esc } from "./utils.js";
import { placeMedia } from "./media.js";

export function startClocks(tz) {
  const f24 = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const f12 = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
  const tick = () => {
    const now = new Date();
    const a = $("#clock");
    const b = $("#clock2");
    if (a) a.textContent = f24.format(now);
    if (b) b.textContent = f12.format(now);
  };
  tick();
  setInterval(tick, 1000);
}

export function initTheme() {
  const btn = $("#themeBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked: ignore */ }
  });
}

let lenis = null;
export const getLenis = () => lenis;

export function initSmoothScroll() {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  if (location.hash) {
    setTimeout(() => {
      let el = null;
      try { el = $(location.hash); } catch (e) { /* invalid hash */ }
      if (el) lenis.scrollTo(el, { immediate: true });
    }, 80);
  }
}

export function renderFooter(site, extraHtml) {
  const f = $("#foot");
  if (!f) return;
  f.innerHTML =
    (extraHtml || "") +
    '<div class="art"></div>' +
    '<div class="contact"><span>' + esc(site.contact_heading) + '</span><div class="pills">' +
    site.socials
      .map((s) => '<a class="pill" target="_blank" rel="noopener" href="' + esc(s.url) + '">' + esc(s.label) + "</a>")
      .join("") +
    '</div><time id="clock2"></time></div>';
  placeMedia($(".art", f), site.footer_image, "image", "");
}
