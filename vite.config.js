import { defineConfig } from "vite";
import portfolio from "./vite-plugins/portfolio.js";

/*
 * BASE_PATH is where the site lives:
 *   "/"          custom domain (designbyashish.com) or a  <username>.github.io  repo   -> default
 *   "/repo-name/" a normal GitHub Pages project site (https://<username>.github.io/repo-name/)
 * The GitHub Actions workflow sets this for you automatically (see .github/workflows/deploy.yml).
 */
let base = process.env.BASE_PATH || "/";
if (!base.startsWith("/")) base = "/" + base;
if (!base.endsWith("/")) base += "/";

export default defineConfig({
  base,
  plugins: [portfolio()],
  build: {
    rollupOptions: {
      input: { main: "index.html", project: "project.html", notFound: "404.html" },
    },
  },
});
