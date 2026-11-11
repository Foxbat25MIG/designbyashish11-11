/* Entrance animations.
   headings : a solid block grows in line by line, then wipes away and the text is revealed
   labels   : typed out with scrambled letters and a block cursor
   images   : expand from the top-left corner as you scroll, with a live X / Y readout
   They are switched off automatically for visitors who prefer reduced motion (no "js" class on <html>). */
import { $, $$, clamp, esc } from "./utils.js";
import { fitName } from "./fitName.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>";

function blockReveal(el, delay, isInline) {
  const saved = el.innerHTML;
  const words = el.textContent.replace(/\s+/g, " ").trim().split(" ");
  el.innerHTML = words.map((w) => '<span class="bw">' + esc(w) + "</span>").join(" ");
  const lines = [];
  let lastTop = null;
  $$(".bw", el).forEach((w) => {
    const t = Math.round(w.getBoundingClientRect().top);
    if (lastTop === null || Math.abs(t - lastTop) > 4) {
      lines.push([]);
      lastTop = t;
    }
    lines[lines.length - 1].push(w.textContent);
  });
  el.innerHTML = lines
    .map((l) => '<span class="ln' + (isInline ? " ln-inline" : "") + '"><span class="ln-t">' + esc(l.join(" ")) + '</span><i class="ln-b" aria-hidden="true"></i></span>')
    .join("");
  el.classList.add("is-ready");
  const dur = 1050, cut = 0.42, step = 110;
  let end = 0;
  $$(".ln", el).forEach((ln, i) => {
    const d = delay * 1000 + i * step;
    end = Math.max(end, d + dur);
    ln.querySelector(".ln-b").animate(
      [
        { clipPath: "inset(0 100% 0 0)", easing: "cubic-bezier(.7,0,.2,1)" },
        { clipPath: "inset(0 0% 0 0)", offset: cut, easing: "cubic-bezier(.6,0,.3,1)" },
        { clipPath: "inset(0 0 0 100%)" },
      ],
      { duration: dur, delay: d, fill: "both" }
    );
    ln.querySelector(".ln-t").animate(
      [{ opacity: 0 }, { opacity: 0, offset: cut }, { opacity: 1, offset: cut + 0.0001 }, { opacity: 1 }],
      { duration: dur, delay: d, fill: "both", easing: "linear" }
    );
  });
  setTimeout(() => {
    el.innerHTML = saved;
    el.classList.add("is-done");
  }, end + 80);
}

function textOf(el) {
  let s = "";
  Array.prototype.forEach.call(el.childNodes, (n) => {
    s += n.nodeType === 3 ? n.nodeValue : n.tagName === "BR" ? "\n" : n.textContent;
  });
  return s.replace(/[ \t]+/g, " ").replace(/^\s+|\s+$/g, "");
}

function typeIn(el, delay) {
  const saved = el.innerHTML;
  const final = textOf(el);
  const len = final.length;
  const box = el.getBoundingClientRect();
  const wasInline = getComputedStyle(el).display === "inline";
  const total = clamp(260 + len * 16, 380, 1000);
  const cur = document.createElement("span");
  cur.className = "cur";
  cur.setAttribute("aria-hidden", "true");
  let t0 = null;
  function frame(now) {
    if (t0 === null) t0 = now;
    const k = Math.floor(clamp((now - t0) / total, 0, 1) * (len + 1));
    if (k > len) {
      el.innerHTML = saved;
      el.style.minWidth = el.style.minHeight = el.style.whiteSpace = el.style.display = "";
      el.removeAttribute("aria-label");
      el.classList.add("is-done");
      return;
    }
    let junk = "";
    for (let i = k; i < Math.min(len, k + 2); i++) junk += /\s/.test(final[i]) ? final[i] : CHARS[Math.floor(Math.random() * CHARS.length)];
    el.textContent = final.slice(0, k) + (k < len ? junk.slice(0, 1) : "");
    el.appendChild(cur);
    requestAnimationFrame(frame);
  }
  setTimeout(() => {
    el.style.minWidth = box.width + "px";
    el.style.minHeight = box.height + "px";
    el.style.whiteSpace = "pre-line";
    if (wasInline) el.style.display = "inline-block";
    el.setAttribute("aria-label", final);
    el.classList.add("is-ready");
    requestAnimationFrame(frame);
  }, delay * 1000);
}

export function initReveals() {
  const root = document.documentElement;
  if (!root.classList.contains("js") || !("IntersectionObserver" in window)) return;
  const isHome = document.body.classList.contains("home");

  const jobs = new WeakMap();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const job = jobs.get(e.target);
        if (job) job();
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0 }
  );
  // Text reveals only run on the home page (project pages only use the image expand below).
  const queue = (el, fn) => {
    if (!el || !isHome) return;
    jobs.set(el, fn);
    io.observe(el);
  };

  /* hero */
  queue($("#email"), () => typeIn($("#email"), 0.2));
  queue($("#roleText"), () => typeIn($("#roleText"), 0.35));
  queue($("#clock"), () => $("#clock").classList.add("is-in"));
  queue($("#nameWrap"), () => blockReveal($("#nameWrap"), 0.45, true));
  /* intro */
  queue($("#introHeading"), () => blockReveal($("#introHeading"), 0));
  queue($("#introText"), () => $("#introText").classList.add("is-in"));
  /* works */
  queue($("#worksHeading"), () => blockReveal($("#worksHeading"), 0));
  queue($("#worksYears"), () => typeIn($("#worksYears"), 0.4));
  $$("#grid .card .meta span").forEach((s, i) => queue(s, () => typeIn(s, 0.2 + (i % 2) * 0.1)));
  /* experiences */
  queue($(".exp h2"), () => blockReveal($(".exp h2"), 0));
  $$(".exp-cols > div").forEach((col, ci) => {
    Array.prototype.forEach.call(col.children, (c, k) => queue(c, () => typeIn(c, 0.3 + ci * 0.18 + k * 0.12)));
  });
  /* footer */
  queue($(".contact > span"), () => typeIn($(".contact > span"), 0.1));
  $$(".contact .pills a").forEach((a, i) =>
    queue(a, () => {
      a.classList.add("is-in");
      a.style.transitionDelay = 0.15 + i * 0.08 + "s";
    })
  );
  queue($(".contact time"), () => $(".contact time").classList.add("is-in"));

  /* images: scroll-scrubbed expansion from the top-left corner */
  const imgs = $$("[data-img]").map((el) => {
    const host = el.parentElement;
    const mk = (c) => {
      const s = document.createElement("span");
      s.className = "dim " + c;
      s.setAttribute("aria-hidden", "true");
      host.appendChild(s);
      return s;
    };
    return { el, x: mk("dim-x"), y: mk("dim-y"), done: false };
  });
  const ease = (t) => t * t * (3 - 2 * t);
  function scrub() {
    const vh = innerHeight;
    const maxScroll = Math.max(0, root.scrollHeight - vh);
    imgs.forEach((o) => {
      if (o.done) return;
      const r = o.el.getBoundingClientRect();
      const w = o.el.offsetWidth, h = o.el.offsetHeight;
      const startTop = vh * 0.99;
      const endTop = Math.max(vh * 0.58, r.top + scrollY - maxScroll + 18);
      const t = clamp((startTop - r.top) / Math.max(1, startTop - endTop), 0, 1);
      const e = ease(t);
      const pw = 0.22 + 0.78 * e, ph = 0.3 + 0.7 * e;
      if (t >= 1 && !isHome) o.done = true;
      o.el.style.clipPath = t >= 1 ? "none" : "inset(0 " + ((1 - pw) * 100).toFixed(2) + "% " + ((1 - ph) * 100).toFixed(2) + "% 0)";
      const show = t > 0.02 && t < 0.995;
      o.x.style.opacity = o.y.style.opacity = show ? 1 : 0;
      if (show) {
        o.x.textContent = "X: " + Math.round(w * pw);
        o.y.textContent = "Y: " + Math.round(h * ph);
        o.x.style.left = o.el.offsetLeft + w * pw + 8 + "px";
        o.x.style.top = o.el.offsetTop + h * ph - 14 + "px";
        o.y.style.left = o.el.offsetLeft + 4 + "px";
        o.y.style.top = o.el.offsetTop + h * ph + 6 + "px";
      }
    });
  }
  scrub();
  addEventListener("scroll", scrub, { passive: true });
  addEventListener("resize", scrub);
  setTimeout(scrub, 400);
  fitName();
}
