/**
 * Portfolio build helpers (you normally never need to touch this file).
 *
 *  - Generates one real page per project (/<slug>/index.html) from project.html, because
 *    GitHub Pages has no URL rewrite rules. Each page gets its own title + social-share tags.
 *  - A project with  "custom_page": "custom-pages/xyz.html"  in projects.json opens that hand-made
 *    HTML page instead of the template (the page is published as-is; %BASE_URL% inside it becomes the site root,
 *    and <!--project-nav--> becomes the same previous / next project links the template pages have).
 *  - Writes the <title>, description and social-share tags of the home page from src/content/site.json.
 *  - Emits sitemap.xml, robots.txt and .nojekyll.
 *  - In `npm run dev`, serves project.html for /<slug> so project pages work locally.
 */
import fs from "node:fs";
import path from "node:path";

const readJson = (file) => JSON.parse(fs.readFileSync(path.resolve("src/content", file), "utf8"));
const escAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

export default function portfolio() {
  let base = "/";

  // Previous / next links for a project, same wording as the template pages (src/js/pages/project.js).
  const projectNav = (slug) => {
    const list = readJson("projects.json").projects;
    const i = list.findIndex((p) => p.slug === slug);
    const prev = list[i - 1], next = list[i + 1];
    return (
      '<div class="back-next">' +
      (prev ? `<a href="${base}${prev.slug}/">← PREVIOUS PROJECT</a>` : `<a href="${base}">← BACK TO HOME</a>`) +
      (next ? `<a href="${base}${next.slug}/">NEXT PROJECT →</a>` : `<a href="${base}">HOME →</a>`) +
      "</div>"
    );
  };

  const readCustomPage = (file, slug) =>
    fs.readFileSync(path.resolve(file), "utf8").replaceAll("%BASE_URL%", base).replace("<!--project-nav-->", projectNav(slug));

  const abs = (site, p = "") => site.site_url.replace(/\/+$/, "") + base + String(p).replace(/^\/+/, "");

  function seo(site, { title, description, pagePath, image }) {
    const img = image ? abs(site, image) : "";
    return [
      `<title>${escText(title)}</title>`,
      `<meta name="description" content="${escAttr(description)}">`,
      `<link rel="canonical" href="${escAttr(abs(site, pagePath))}">`,
      `<meta property="og:title" content="${escAttr(title)}">`,
      `<meta property="og:description" content="${escAttr(description)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:url" content="${escAttr(abs(site, pagePath))}">`,
      img && `<meta property="og:image" content="${escAttr(img)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return {
    name: "portfolio",
    enforce: "post", // run after Vite has emitted the HTML files

    configResolved(config) {
      base = config.base.endsWith("/") ? config.base : config.base + "/";
    },

    // Dev server only: /hud and /hud/ open the project template (or the project's custom page).
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || "").split("?")[0];
        const rel = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "");
        const slug = rel.replace(/\/+$/, "");
        if (slug && !slug.includes("/") && !slug.includes(".")) {
          try {
            const project = readJson("projects.json").projects.find((p) => p.slug === slug);
            if (project && project.custom_page) {
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(readCustomPage(project.custom_page, slug));
              return;
            }
            if (project) req.url = base + "project.html";
          } catch { /* ignore invalid JSON / missing file while editing */ }
        }
        next();
      });
    },

    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!/(^|[\\/])index\.html$/.test(ctx.filename)) return html;
        const site = readJson("site.json");
        return html.replace(
          /<title>[\s\S]*?<\/title>/,
          seo(site, { title: site.seo_title, description: site.seo_description, pagePath: "", image: site.og_image })
        );
      },
    },

    generateBundle(_options, bundle) {
      const site = readJson("site.json");
      const { projects } = readJson("projects.json");

      const tpl = bundle["project.html"];
      if (tpl) {
        const html = String(tpl.source);
        for (const p of projects) {
          if (p.custom_page) {
            this.emitFile({ type: "asset", fileName: `${p.slug}/index.html`, source: readCustomPage(p.custom_page, p.slug) });
            continue;
          }
          const title = `${p.title} | ${site.site_name}`;
          const description = (p.overview || site.seo_description).replace(/\s+/g, " ").slice(0, 200);
          const tags = seo(site, { title, description, pagePath: `${p.slug}/`, image: p.cover || site.og_image });
          const page = html.replace(/<!--seo-->\s*/, "").replace(/<title>[\s\S]*?<\/title>/, tags);
          this.emitFile({ type: "asset", fileName: `${p.slug}/index.html`, source: page });
        }
        delete bundle["project.html"]; // only the generated /<slug>/ pages are published
      }

      const urls = ["", ...projects.map((p) => `${p.slug}/`)];
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.map((u) => `  <url><loc>${escText(abs(site, u))}</loc></url>`).join("\n") +
          "\n</urlset>\n",
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\nSitemap: ${abs(site, "sitemap.xml")}\n`,
      });
      this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" });
    },
  };
}
