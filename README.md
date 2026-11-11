# designbyashish.com — portfolio

Static portfolio site built with [Vite](https://vite.dev). Smooth scrolling ([Lenis](https://lenis.darkroom.engineering)), fonts (Space Grotesk / Space Mono) and the optional physics tags ([Matter.js](https://brm.io/matter-js/)) all come from npm packages listed in `package.json`.

## Quick start

```bash
npm install        # once
npm run dev        # live preview at http://localhost:5173 (updates as you save)
npm run build      # production build into /dist
npm run preview    # serve the /dist build locally
npm run check      # verify content files + list images/videos that are still missing
```
Needs Node 20.19+ (or 22+).

## Editing the site (no code needed)

| I want to change… | Edit this |
|---|---|
| Name, email, intro text, hero images, experiences, social links, SEO title/description | `src/content/site.json` |
| Works list, project text, project images and videos | `src/content/projects.json` |
| Images and videos | put files in `public/media/<project>/` |
| Colours, spacing, fonts | `src/styles/base.css` (shared), `home.css`, `project.css` |

Text supports **bold** with `**double asterisks**`, and project text supports paragraphs (blank line) and `- ` bullet lists.

### Add a new project
1. Add an entry to the `projects` list in `src/content/projects.json` (copy an existing one). The `slug` becomes the address: `slug: "bmw"` → `yoursite.com/bmw/`. Use lowercase letters, numbers and dashes.
2. Drop its cover, images and videos into `public/media/bmw/` and reference them as `/media/bmw/cover.jpg`, etc.
3. Run `npm run check` — it lists any file you referenced but haven't added yet (the site shows a grey placeholder for those).

The order in the list is the order on the home page and the "Previous project" / "Next project" order. The first project shows "Back to home" instead of "Previous project", and the last one shows "Home" instead of "Next project". A project's `media` list accepts `"type": "video"` or `"image"`.

> **File names are case-sensitive on GitHub** (`Cover.JPG` ≠ `cover.jpg`). `npm run check` catches this.
> GitHub rejects files over 100 MB. Keep videos compressed (MP4/H.264, ideally under ~15 MB each) — or host big videos elsewhere and paste the full `https://…` link as the `src`.

### Use your own hand-made HTML page for a project
Airbus HMI opens `custom-pages/airbus-hmi.html` instead of the standard project template. To do the same for another project, put the HTML file in `custom-pages/` and add `"custom_page": "custom-pages/your-file.html"` to that project in `projects.json`. The page is published as-is. In links back to the portfolio use `%BASE_URL%` (e.g. `href="%BASE_URL%#works"`) so they work on GitHub Pages too. Put `<!--project-nav-->` where the "Previous project / Next project" links should appear; the build fills it in from the project order. Remove the `custom_page` line to go back to the template.
Note: that page loads three.js and the Jost, Space Grotesk and Space Mono fonts from CDNs and live data from open-meteo / OpenSky, so it needs an internet connection.

### Optional features (in `site.json`)
- `"floating_tags": true` brings back the draggable physics tags in the hero (words come from `"tags"`).
- `"og_image"`: the picture shown when your link is shared on social media (ideally 1200×630). Currently set to a hero image — replace it with a proper share image in `public/media/`.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to it (branch `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` now builds and publishes automatically (see the *Actions* tab). To update the portfolio later: edit, commit, push.

**Address.** Without a custom domain the site is at `https://<username>.github.io/<repo-name>/`. The workflow detects this and sets the right base path by itself. If you name the repo `<username>.github.io` it is served from the root.

**Custom domain (designbyashish.com).**
1. Create a file `public/CNAME` containing just `designbyashish.com`.
2. Set your DNS as described in GitHub's [custom domain guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site) and enter the domain under *Settings → Pages*.
3. Make sure `"site_url"` in `src/content/site.json` matches your real address (used for share links, canonical URLs and `sitemap.xml`). If you use the github.io address instead, put `https://<username>.github.io` there.

## How it is organised

```
src/content/        site.json, projects.json   ← the things you edit
src/styles/         base.css, home.css, project.css
src/js/             main.js (entry) · pages/home.js · pages/project.js
                    reveals.js (entrance animations) · curtain.js (preloader)
                    media.js · chrome.js (clock, theme, scrolling, footer) · heroTags.js (optional)
custom-pages/      hand-made HTML pages for individual projects
public/             media/ (your images + videos), favicon.svg — copied as-is
vite-plugins/       builds a real page per project (/<slug>/), sitemap, SEO tags
scripts/            check-content.mjs
.github/workflows/  deploy.yml (GitHub Pages)
index.html, project.html, 404.html
```
`project.html` is a template: the build turns it into one page per project (GitHub Pages cannot rewrite URLs, so each project needs a real page). The old Netlify `_redirects` file is therefore no longer needed.

## Behaviour notes
- Selected text turns blue (#1522FF) and all text is selectable.
- Entrance animations switch off for visitors with "reduce motion" enabled.
- The project pages' light/dark toggle remembers the visitor's choice.
