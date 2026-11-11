/* Entry point (loaded by index.html and project.html). */
import "@fontsource-variable/space-grotesk/index.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "lenis/dist/lenis.css";
import "../styles/base.css";
import "../styles/home.css";
import "../styles/project.css";

import site from "../content/site.json";
import projects from "../content/projects.json";
import { startClocks, initTheme, initSmoothScroll } from "./chrome.js";
import { preIntro, initPageTransitions } from "./curtain.js";
import { renderHome } from "./pages/home.js";
import { renderProject } from "./pages/project.js";

function start() {
  const isHome = document.body.classList.contains("home");
  initTheme();
  initSmoothScroll();
  initPageTransitions(site.preloader_title);
  const pre = preIntro(site.preloader_title);
  pre.ready.then(() => {
    try {
      (isHome ? renderHome : renderProject)(site, projects);
    } catch (e) {
      console.error(e);
    }
    startClocks(site.timezone || "Europe/Rome");
    pre.exit();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
