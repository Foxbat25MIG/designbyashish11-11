/* Decrypt preloader: scrambled characters resolve line by line on first load and between pages. */
import { $, clamp, esc, routeLabel, routePath } from "./utils.js";

const HEX = "0123456789ABCDEF";
const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>=";
const curtain = $("#curtain");
const jsOn = () => document.documentElement.classList.contains("js");
const rnd = (n, set) => { let s = ""; while (n--) s += set[Math.floor(Math.random() * set.length)]; return s; };

export function curtainHide() {
  if (curtain) curtain.style.display = "none";
}

function preRun(path, dur, title, done) {
  const lines = [title, "DECRYPTING " + path, "KEY 0x" + rnd(8, HEX) + " // VERIFIED", "ACCESS GRANTED"];
  curtain.innerHTML = '<div class="pl"></div><div class="pn">000</div>';
  const box = curtain.firstChild, num = curtain.lastChild;
  const noise = [];
  let last = 0, finished = false;
  const t0 = performance.now();
  const rows = lines.map(() => {
    const d = document.createElement("div");
    d.className = "pr";
    box.appendChild(d);
    return d;
  });
  (function frame(now) {
    const redo = now - last > 50;
    if (redo) last = now;
    const q = clamp((now - t0) / dur, 0, 1);
    lines.forEach((t, i) => {
      const p = clamp((q - i * 0.14) / 0.55, 0, 1);
      const lock = Math.floor(p * t.length);
      if (redo || !noise[i]) noise[i] = t.replace(/\S/g, () => NOISE[Math.floor(Math.random() * NOISE.length)]);
      rows[i].innerHTML = esc(t.slice(0, lock)) + (lock < t.length ? "<i>" + esc(noise[i].slice(lock)) + "</i>" : "");
    });
    num.textContent = ("00" + Math.round(q * 100)).slice(-3);
    if (q < 1) requestAnimationFrame(frame);
    else if (!finished) {
      finished = true;
      num.textContent = "100";
      if (done) done();
    }
  })(t0);
}

/** Runs the first-load preloader. Returns a promise that resolves when it has finished, and an exit() to reveal the page. */
export function preIntro(title) {
  let fast = false;
  try { fast = !!sessionStorage.getItem("pre"); sessionStorage.removeItem("pre"); } catch (e) { /* ignore */ }
  if (!curtain || !jsOn()) return { ready: Promise.resolve(), exit: curtainHide };
  const ready = new Promise((res) => preRun(routeLabel(routePath()), fast ? 900 : 1500, title, () => setTimeout(res, 140)));
  return {
    ready,
    exit() {
      curtain.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], { duration: 800, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" }).onfinish = curtainHide;
    },
  };
}

function preLeave(u, title, go) {
  try { sessionStorage.setItem("pre", "1"); } catch (e) { /* ignore */ }
  curtain.style.display = "flex";
  curtain.animate([{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 480, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" }).onfinish = go;
  preRun(routeLabel(routePath(u.pathname)), 900, title);
}

/** Internal links play the preloader before navigating. */
export function initPageTransitions(title) {
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button || a.target === "_blank") return;
    let u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash)) return;
    if (!curtain || !jsOn()) return;
    e.preventDefault();
    preLeave(u, title, () => { location.href = u.href; });
  });
  // Coming back with the browser's back button: don't leave the cover stuck on screen.
  addEventListener("pageshow", (e) => { if (e.persisted) curtainHide(); });
}
