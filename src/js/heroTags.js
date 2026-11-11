/* OPTIONAL: floating physics tags in the hero (Matter.js). Switched off by default.
   Turn on with  "floating_tags": true  in src/content/site.json  (the tag words come from "tags"). */
import { $, esc } from "./utils.js";
import { getLenis } from "./chrome.js";

export async function heroTags(site) {
  const hero = $("#hero"), box = $("#tags"), name = $("#bigname");
  if (!hero || !box) return;
  const M = (await import("matter-js")).default;

  const els = [];
  site.tags.forEach((w) => {
    const e = document.createElement("div");
    e.className = "tag";
    e.innerHTML = esc(w) + (w === "HMI" ? "<i></i>" : "");
    box.appendChild(e);
    els.push({ el: e, round: false });
  });
  const star = document.createElement("div");
  star.className = "tag round";
  star.textContent = "✱";
  box.appendChild(star);
  els.push({ el: star, round: true });
  const down = document.createElement("button");
  down.className = "tag round";
  down.textContent = "↓";
  down.setAttribute("aria-label", "Scroll down");
  down.addEventListener("click", () => {
    const t = $("#heroImages"), lenis = getLenis();
    if (lenis) lenis.scrollTo(t); else t.scrollIntoView({ behavior: "smooth" });
  });
  box.appendChild(down);
  els.push({ el: down, round: true });

  let engine, rafId, bodies = [], built = false;
  function build() {
    if (built) {
      cancelAnimationFrame(rafId);
      M.World.clear(engine.world);
      M.Engine.clear(engine);
    }
    built = true;
    const W = hero.clientWidth, H = hero.clientHeight;
    const fs = parseFloat(getComputedStyle(name).fontSize);
    const floorY = H - name.offsetHeight + fs * 0.2;
    engine = M.Engine.create({ gravity: { y: 0.9 } });
    const t = 80;
    M.World.add(engine.world, [
      M.Bodies.rectangle(W / 2, floorY + t / 2, W * 2, t, { isStatic: true }),
      M.Bodies.rectangle(-t / 2, H / 2, t, H * 4, { isStatic: true }),
      M.Bodies.rectangle(W + t / 2, H / 2, t, H * 4, { isStatic: true }),
    ]);
    bodies = els.map((o, i) => {
      const w = o.el.offsetWidth, h = o.el.offsetHeight;
      const x = w / 2 + Math.random() * Math.max(10, W - w), y = -60 - i * 90;
      const opts = { restitution: 0.45, friction: 0.25, frictionAir: 0.01, angle: (Math.random() - 0.5) * 0.7 };
      o.w = w;
      o.h = h;
      return o.round ? M.Bodies.circle(x, y, w / 2, opts) : M.Bodies.rectangle(x, y, w, h, Object.assign({ chamfer: { radius: h / 2 } }, opts));
    });
    M.World.add(engine.world, bodies);
    const mouse = M.Mouse.create(hero);
    // let the page scroll normally with wheel/touch
    ["mousewheel", "DOMMouseScroll"].forEach((n) => hero.removeEventListener(n, mouse.mousewheel));
    hero.removeEventListener("touchmove", mouse.mousemove);
    hero.removeEventListener("touchstart", mouse.mousedown);
    hero.removeEventListener("touchend", mouse.mouseup);
    M.World.add(engine.world, M.MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } }));
    let last = performance.now();
    (function loop(now) {
      M.Engine.update(engine, Math.min(32, now - last));
      last = now;
      bodies.forEach((b, i) => {
        const o = els[i];
        o.el.style.transform = "translate(" + (b.position.x - o.w / 2) + "px," + (b.position.y - o.h / 2) + "px) rotate(" + b.angle + "rad)";
      });
      rafId = requestAnimationFrame(loop);
    })(last);
  }

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach((o, i) => { o.el.style.transform = "translate(" + (20 + i * 150) + "px," + (80 + (i % 2) * 70) + "px)"; });
    return;
  }
  await (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());
  build();
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 250); });
}
