/* Home page. Everything it shows comes from src/content/site.json and src/content/projects.json. */
import { $, esc, inline, url } from "../utils.js";
import { mediaBox, placeMedia } from "../media.js";
import { renderFooter } from "../chrome.js";
import { fitName } from "../fitName.js";
import { initReveals, lockOn } from "../reveals.js";

/** Hero tiles stay hidden until you scroll, then grow to full size with a live X / Y readout and a corner crosshair. */
function growStrip(cells) {
  function update() {
    const vh = innerHeight;
    cells.forEach((o) => {
      const r = o.cell.getBoundingClientRect();
      // start once the page has moved, so nothing shows as a tiny thumbnail on arrival
      const start = Math.min(vh * 0.9, r.top + scrollY - 2);
      const p = Math.min(1, Math.max(0, (start - r.top) / (vh * 0.62)));
      const k = p * p * (3 - 2 * p);
      const w = o.cell.clientWidth * k, h = o.cell.clientHeight * k;
      const show = k > 0.01 && k < 0.995;
      o.m.style.visibility = k > 0.001 ? "visible" : "hidden";
      o.rx.style.opacity = o.ry.style.opacity = show ? 1 : 0;
      o.xh.classList.toggle("on", show);
      o.xh.style.left = w + "px";
      o.xh.style.top = h + "px";
      if (k >= 0.995 && o.k < 0.995) lockOn(o.xh);
      o.k = k;
      o.m.style.width = w + "px";
      o.m.style.height = h + "px";
      o.rx.textContent = "X: " + Math.round(w);
      o.ry.textContent = "Y: " + Math.round(h);
      o.rx.style.left = Math.max(w, 96) + "px";
      o.rx.style.top = h + 6 + "px";
      o.rx.style.transform = "translateX(-100%)";
      o.ry.style.left = "0px";
      o.ry.style.top = h + 6 + "px";
    });
  }
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

export function renderHome(site, data) {
  document.title = site.seo_title;
  const email = $("#email");
  email.href = "mailto:" + site.email;
  email.textContent = site.email;
  $("#roleText").innerHTML = esc(site.role_line).replace(/\n/g, "<br>");
  $("#nameFirst").textContent = site.name_first;
  $("#nameLast").textContent = site.name_last;

  const strip = $("#heroImages");
  const cells = [];
  (site.hero_images || []).forEach((src) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    const m = mediaBox(src, "image", "");
    const rx = document.createElement("span");
    const ry = document.createElement("span");
    rx.className = ry.className = "rd";
    const xh = document.createElement("span");
    xh.className = "xh";
    xh.setAttribute("aria-hidden", "true");
    cell.append(m, rx, ry, xh);
    strip.appendChild(cell);
    cells.push({ cell, m, rx, ry, xh, k: 0 });
  });
  growStrip(cells);

  $("#introHeading").textContent = site.intro_heading;
  $("#introText").innerHTML = inline(site.intro_text);
  $("#worksHeading").textContent = site.works_heading;
  $("#worksYears").textContent = site.works_years;

  const grid = $("#grid");
  data.projects.forEach((p) => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = url(p.slug + "/");
    placeMedia(a, p.cover, "image", p.title);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = "<span>" + esc(p.card_label || p.title) + "</span><span>" + esc(p.year) + "</span>";
    a.appendChild(meta);
    grid.appendChild(a);
  });

  $("#exp").innerHTML = site.experiences
    .map((e) => "<div><small>" + esc(e.years) + "</small><p>" + esc(e.company) + "</p><p>" + esc(e.role) + "</p></div>")
    .join("");

  renderFooter(site);
  fitName();
  addEventListener("resize", fitName);

  if (site.floating_tags) {
    const tags = document.createElement("div");
    tags.className = "tags";
    tags.id = "tags";
    $("#hero").appendChild(tags);
    import("../heroTags.js").then((m) => m.heroTags(site));
  }

  // Start the entrance animations once fonts are ready (the layout depends on them).
  const go = () => {
    try {
      fitName();
      initReveals();
    } catch (e) {
      console.error(e);
      document.documentElement.classList.remove("js");
    }
  };
  let started = false;
  const once = () => {
    if (started) return;
    started = true;
    setTimeout(go, 650);
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(once);
  else once();
  setTimeout(once, 2500);
}
