/* Project (case study) page. The project is picked from the URL: /<slug>/ . Content: src/content/projects.json */
import { $, esc, md, url, routePath } from "../utils.js";
import { placeMedia } from "../media.js";
import { renderFooter } from "../chrome.js";
import { initReveals } from "../reveals.js";

const kindOf = (m) => m.type || (/\.(mp4|webm|mov|m4v)$/i.test(m.src || "") ? "video" : "image");

export function renderProject(site, data) {
  const crumbHome = $("#crumbHome"), crumbWorks = $("#crumbWorks");
  if (crumbHome) crumbHome.href = url("");
  if (crumbWorks) crumbWorks.href = url("#works");

  const slug = (new URLSearchParams(location.search).get("slug") || routePath())
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.html$/, "");
  const idx = data.projects.findIndex((p) => p.slug === slug);
  const page = $("#page");

  if (idx < 0) {
    document.title = "Page not found";
    $("#crumb").textContent = "404";
    page.innerHTML = '<div class="nf"><h1>404</h1><p>This page does not exist.</p><a class="pill" href="' + url("") + '">← Back to home</a></div>';
    renderFooter(site);
    return;
  }

  const p = data.projects[idx];
  const prev = data.projects[idx - 1];
  const next = data.projects[idx + 1];
  document.title = p.title + " - Projects";
  $("#crumb").textContent = p.title;

  const hasIntro = p.intro_title || p.intro_text || p.intro_video;
  page.innerHTML =
    '<section class="p-head"><div class="p-title"><div id="logo"></div><h1>' + esc(p.title) + "</h1></div>" +
    (p.overview ? '<div class="p-over"><small>Overview</small>' + md(p.overview) + "</div>" : "") + "</section>" +
    ((p.top_images || []).length ? '<section class="p-top" id="top" style="--n:' + Math.min(2, p.top_images.length) + '"></section>' : "") +
    (p.about_text
      ? '<section class="about"><h2>About the project</h2><div class="body">' + md(p.about_text) + "</div></section>"
      : '<div style="height:clamp(60px,8vw,120px)"></div>') +
    (hasIntro
      ? '<section class="pax">' + (p.intro_title ? "<h2>" + esc(p.intro_title) + "</h2>" : "") + md(p.intro_text) + '<div class="pax-v"></div></section>'
      : "") +
    '<section class="shots" id="shots"></section>';

  const logo = $("#logo");
  if (p.logo) {
    logo.style.display = "contents";
    placeMedia(logo, p.logo, "image", "");
    logo.firstChild.style.cssText = "width:clamp(48px,6vw,86px);aspect-ratio:1;background:none";
  } else logo.remove();

  (p.top_images || []).slice(0, 2).forEach((s) => placeMedia($("#top"), s, "image", p.title));

  const paxV = $(".pax-v");
  if (p.intro_video) placeMedia(paxV, p.intro_video, "video", p.intro_title);
  else if (paxV) paxV.remove();

  (p.media || []).forEach((m) => {
    const t = kindOf(m);
    const heading = m.heading || m.caption;
    const fig = document.createElement("figure");
    fig.className = "shot" + (t === "image" ? " is-image" : "");
    if (heading) {
      const h = document.createElement("h3");
      h.textContent = heading;
      fig.appendChild(h);
    }
    placeMedia(fig, m.src, t, heading);
    $("#shots").appendChild(fig);
  });

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() =>
    setTimeout(() => {
      try { initReveals(); } catch (e) { console.error(e); }
    }, 700)
  );

  renderFooter(
    site,
    '<div class="back-next">' +
      (prev ? '<a href="' + url(prev.slug + "/") + '">← PREVIOUS PROJECT</a>' : '<a href="' + url("") + '">← BACK TO HOME</a>') +
      (next ? '<a href="' + url(next.slug + "/") + '">NEXT PROJECT →</a>' : '<a href="' + url("") + '">HOME →</a>') +
      "</div>"
  );
}
