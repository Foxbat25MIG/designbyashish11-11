/**
 * Checks src/content/*.json before a build:
 *   - the JSON is valid and has the required fields
 *   - every image/video it points to exists in /public (case-sensitive, like GitHub's servers)
 * Missing media only produces warnings (the site shows a grey placeholder box for them).
 * Real mistakes (bad JSON, duplicate slugs, missing title) stop the build.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const errors = [];
const missing = new Map(); // file -> where it is used

function load(name) {
  const file = path.join(root, "src/content", name);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    return null;
  }
}

/** Case-sensitive file check, even on macOS/Windows where the file system is case-insensitive. */
function existsExact(rel) {
  let dir = path.join(root, "public");
  for (const part of rel.split("/").filter(Boolean)) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return false; }
    if (!entries.includes(part)) return false;
    dir = path.join(dir, part);
  }
  return fs.existsSync(dir) && fs.statSync(dir).isFile();
}

function checkFile(p, where) {
  if (!p || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(p)) return;
  if (!existsExact(p.replace(/^\/+/, ""))) missing.set(p, where);
}

const site = load("site.json");
const data = load("projects.json");

if (site) {
  for (const k of ["name_first", "name_last", "email", "seo_title", "seo_description", "site_name", "site_url", "socials", "experiences"])
    if (!site[k]) errors.push(`site.json: missing "${k}"`);
  (site.hero_images || []).forEach((p) => checkFile(p, "site.json hero_images"));
  checkFile(site.footer_image, "site.json footer_image");
  checkFile(site.og_image, "site.json og_image");
}

if (data) {
  if (!Array.isArray(data.projects)) errors.push('projects.json: "projects" must be a list');
  const slugs = new Set();
  (data.projects || []).forEach((p, i) => {
    const label = `projects.json project #${i + 1} (${p.slug || p.title || "?"})`;
    if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) errors.push(`${label}: "slug" must be lowercase letters, numbers and dashes`);
    if (slugs.has(p.slug)) errors.push(`${label}: duplicate slug "${p.slug}"`);
    slugs.add(p.slug);
    if (!p.title) errors.push(`${label}: missing "title"`);
    if (p.custom_page && !fs.existsSync(path.join(root, p.custom_page))) errors.push(`${label}: custom_page "${p.custom_page}" not found`);
    checkFile(p.cover, label + " cover");
    checkFile(p.logo, label + " logo");
    (p.top_images || []).forEach((m) => checkFile(m, label + " top_images"));
    checkFile(p.intro_video, label + " intro_video");
    (p.media || []).forEach((m) => checkFile(m.src, label + " media"));
  });
}

if (missing.size) {
  console.warn(`\n⚠  ${missing.size} file(s) referenced in the content are not in /public yet (placeholders will show):`);
  for (const [file, where] of missing) console.warn(`   public${file.startsWith("/") ? "" : "/"}${file}   <- ${where}`);
  console.warn("");
}
if (errors.length) {
  console.error("✖ Content problems:\n" + errors.map((e) => "  - " + e).join("\n") + "\n");
  process.exit(1);
}
console.log("✔ Content check passed.");
