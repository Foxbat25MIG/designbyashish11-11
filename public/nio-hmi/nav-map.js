/* NIO ET9 HMI study · heading-up navigation map
   Renders window.LUXMAP (OpenStreetMap data, 1 px = 3.4 m) into a map pane,
   keeps the car fixed in the lower third and turns the map under it.
   Drives the next-turn card, trip bar and status bar from the same route. */
(function () {
  const M = window.LUXMAP;
  if (!M) return;

  const CX = 250, CY = 540;               // car position on screen (px in the 1440×900 frame's map pane)
  const K = M.k;                          // metres per px
  const R = M.route, S = [0];
  for (let i = 1; i < R.length; i++) S.push(S[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
  const TOTAL = S[S.length - 1];
  const S0 = M.s0, RUN = 262;             // animate ~890 m: Route d'Esch → Marie-Thérèse → Boulevard Joseph II

  const at = s => {
    s = Math.max(0, Math.min(TOTAL, s));
    let i = 1; while (i < S.length - 1 && S[i] < s) i++;
    const t = (s - S[i - 1]) / ((S[i] - S[i - 1]) || 1);
    return [R[i - 1][0] + t * (R[i][0] - R[i - 1][0]), R[i - 1][1] + t * (R[i][1] - R[i - 1][1])];
  };
  const bearing = s => { const a = at(s - 25), b = at(s + 70); return Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI; };

  /* ---------- build layers ---------- */
  const X0 = -560, Y0 = -940, W = 1360, H = 1300;
  const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${X0} ${Y0} ${W} ${H}" style="position:absolute;left:${X0}px;top:${Y0}px;overflow:visible">`;
  const L = M.L;
  const routeD = 'M' + R.map(p => p[0] + ' ' + p[1]).join('L');
  const base = svgOpen + `
    <path d="${L.g}" fill="var(--map-green)"/>
    <path d="${L.park}" fill="var(--map-park)"/>
    <path d="${L.pitch}" fill="var(--map-park)"/>
    <path d="${L.w}" fill="var(--map-water)"/>
    <path d="${L.wl}" fill="none" stroke="var(--map-water)" stroke-width="3" stroke-linecap="round"/>
    <path d="${L.b}" fill="var(--map-bldg)"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${L.rail}" stroke="var(--map-rail)" stroke-width="1.6" stroke-dasharray="5 4"/>
      <path d="${L.r6}" stroke="var(--map-road2)" stroke-width="2.2"/>
      <path d="${L.r5}" stroke="var(--map-road2)" stroke-width="2.6"/>
      <g stroke="var(--map-edge)">
        <path d="${L.r4}" stroke-width="5.6"/><path d="${L.r3}" stroke-width="7.6"/>
        <path d="${L.r2}" stroke-width="9.2"/><path d="${L.r1}" stroke-width="11"/>
      </g>
      <g stroke="var(--map-road)">
        <path d="${L.r4}" stroke-width="4"/><path d="${L.r3}" stroke-width="6"/>
        <path d="${L.r2}" stroke-width="7.6"/><path d="${L.r1}" stroke-width="9.2"/>
      </g>
    </g></svg>`;
  const routeSvg = svgOpen + `
    <path d="${routeD}" fill="none" stroke="var(--route-done)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="ahead halo" d="${routeD}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="ahead" d="${routeD}" fill="none" stroke="var(--route)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  document.querySelectorAll('[data-navmap]').forEach(initPane);
  function initPane(pane) {
  const root = pane.closest('.frame') || document;
  const OFF = +(pane.dataset.offset || 0);
  const DEST = pane.dataset.dest || 'Trois Glands';
  const DESTXY = DEST === 'Mudam' ? [436, -455] : M.dest;
  const ETA = pane.dataset.eta || '13:55';
  const vp = document.createElement('div'); vp.className = 'nm-vp';
  const world = document.createElement('div'); world.className = 'nm-world';
  world.innerHTML = base + routeSvg;
  vp.appendChild(world);
  const labels = document.createElement('div'); labels.className = 'nm-labels';
  vp.appendChild(labels);
  const car = document.createElement('div'); car.className = 'nm-car';
  car.innerHTML = '<svg width="64" height="64" viewBox="-32 -32 64 64"><circle r="30" fill="var(--route)" opacity=".14"/><path d="M0 -17 l-13 28 l13 -7 l13 7z" fill="var(--ink)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
  vp.appendChild(car);
  pane.prepend(vp);

  const ahead = world.querySelectorAll('.ahead');
  ahead.forEach(p => { p.style.strokeDasharray = `${TOTAL} ${TOTAL}`; });

  const lab = [];
  const pinFirst = [];
  M.districts.forEach(([t, x, y]) => { const e = document.createElement('div'); e.className = 'nm-d'; e.textContent = t; labels.appendChild(e); lab.push({ e, x, y, a: null }); });
  M.labels.forEach(([t, x, y, a]) => { const e = document.createElement('div'); e.className = 'nm-s'; e.textContent = t; labels.appendChild(e); lab.push({ e, x, y, a }); });
  const pin = document.createElement('div'); pin.className = 'nm-pin';
  pin.innerHTML = `<span class="nm-pin-dot">${DEST === 'Mudam' ? '<span class="ms f" style="font-size:18px;color:#fff">museum</span>' : 'P'}</span><span class="nm-pin-t">${DEST}<small>${ETA}</small></span>`;
  labels.appendChild(pin); lab.push({ e: pin, x: DESTXY[0], y: DESTXY[1], a: null, pin: true });

  /* ---------- UI hooks ---------- */
  const $ = s => root.querySelector(s);
  const ui = {
    dist: $('[data-nav="dist"]'), street: $('[data-nav="street"]'), icon: $('[data-nav="icon"]'),
    lanes: $('[data-nav="lanes"]'), then: $('[data-nav="then"]'),
    eta: $('[data-nav="eta"]'), rem: $('[data-nav="rem"]'), km: $('[data-nav="km"]'),
    driven: $('[data-nav="driven"]'), dtime: $('[data-nav="dtime"]'),
    clock: $('[data-nav="clock"]'), speed: $('[data-nav="speed"]')
  };
  const steps = M.steps.filter(s => ['turn', 'fork', 'arrive', 'end of road', 'roundabout'].includes(s.t));
  const ICON = { 'right': 'turn_right', 'left': 'turn_left', 'slight right': 'turn_slight_right', 'slight left': 'fork_left', 'straight': 'straight' };
  const LANES = {
    'Avenue Marie-Thérèse': ['straight', 'straight', 'turn_right*'],
    'Boulevard Joseph II': ['turn_left*', 'straight', 'straight'],
    'Boulevard de la Foire': ['fork_left*', 'straight'],
  };
  const short = n => n.replace('Boulevard', 'Bd').replace('Avenue', 'Av.');
  const fmtD = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : (m >= 100 ? Math.round(m / 10) * 10 : Math.max(10, Math.round(m / 5) * 5)) + ' m';
  let lastStep = null;
  function setTurn(s) {
    if (pane.classList.contains('dash-car')) { lastStep = null; return; }   // Car view drives the card itself
    const i = steps.findIndex(st => st.s > s + 2);
    const st = steps[i]; if (!st) return;
    const d = (st.s - s) * K;
    if (ui.dist) ui.dist.textContent = fmtD(d);
    if (st !== lastStep) {
      lastStep = st;
      if (ui.icon) ui.icon.textContent = st.t === 'arrive' ? 'local_parking' : (ICON[st.m] || 'straight');
      if (ui.street) ui.street.textContent = st.n || 'Continue';
      if (ui.lanes) {
        const ln = LANES[st.n];
        ui.lanes.style.visibility = ln ? 'visible' : 'hidden';
        if (ln) ui.lanes.innerHTML = ln.map(x => x.endsWith('*') ? `<span class="ms go f">${x.slice(0, -1)}</span>` : `<span class="ms">${x}</span>`).join('');
      }
      const nx = steps[i + 1];
      if (ui.then) ui.then.textContent = nx ? `then ${nx.t === 'fork' ? 'keep ' + nx.m.replace('slight ', '') : nx.m} onto ${short(nx.n)}` : '';
    }
  }
  const startClock = 13 * 3600 + 48 * 60 + 10, startDriven = 1.7, startMin = 6;
  function setTrip(s, simSec) {
    const remM = (TOTAL - s) * K;
    if (ui.km) ui.km.textContent = (remM / 1000).toFixed(1) + ' km';
    // remaining time from OSRM pace on the rest of the route (~7.3 m/s average incl. lights)
    if (ui.rem) ui.rem.textContent = Math.max(1, Math.round(remM / 7.3 / 60)) + ' min';
    const now = startClock + simSec;
    if (ui.clock) ui.clock.textContent = Math.floor(now / 3600) + ':' + String(Math.floor(now / 60) % 60).padStart(2, '0');
    if (ui.driven) ui.driven.textContent = (startDriven + (s - S0) * K / 1000).toFixed(1) + ' km';
    if (ui.dtime) ui.dtime.textContent = (startMin + Math.floor(simSec / 60)) + ' min';
  }

  /* ---------- frame ---------- */
  let rot = bearing(S0);
  function draw(s, r) {
    const [px, py] = at(s);
    world.style.transform = `translate(${CX}px,${CY}px) rotate(${-r}deg) translate(${-px}px,${-py}px)`;
    ahead.forEach(p => { p.style.strokeDashoffset = -s; });
    const rad = -r * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
    const placed = [];
    for (const l of lab) {
      const dx = l.x - px, dy = l.y - py;
      const sx = CX + dx * c - dy * sn, sy = CY + dx * sn + dy * c;
      let off = sx < -160 || sx > 1080 || sy < -60 || sy > 760;
      if (!off && !l.pin) off = placed.some(([qx, qy]) => Math.abs(qx - sx) < 120 && Math.abs(qy - sy) < 34) || Math.hypot(sx - CX, sy - CY) < 46;
      l.e.style.display = off ? 'none' : '';
      if (off) continue;
      if (l.pin) {                         // dot sits on the place; label flips left near the edge
        const left = sx > 640;
        l.e.classList.toggle('left', left);
        l.e.style.transform = `translate(${sx}px,${sy}px) translate(${left ? 'calc(-100% + 20px)' : '-20px'},-50%)`;
        continue;
      }
      placed.push([sx, sy]);
      let a = 0;
      if (l.a !== null) { a = l.a - r; a = ((a + 540) % 360) - 180; if (a > 90) a -= 180; if (a < -90) a += 180; }
      l.e.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%) rotate(${a}deg)`;
    }
  }

  const reduce = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || pane.hasAttribute('data-static');
  if (OFF) { rot = bearing(S0 + OFF); draw(S0 + OFF, rot); }
  else { draw(S0, rot); setTurn(S0); setTrip(S0, 0); }
  if (reduce) return;

  const SPEED = 13.3 / K;               // 48 km/h in px per simulated second
  const PLAY = 2.5;                      // play back at 2.5× real time
  let s = S0, sim = 0, last = null, hold = 1.2, shown = 48;
  pane._navRestart = () => { s = S0; sim = 0; rot = bearing(S0); lastStep = null; hold = 0.8; draw(s, rot); setTurn(s); setTrip(s, 0); };
  function speedFactor(s) {               // slow down through the two turns
    let f = 1;
    for (const st of steps) { const d = Math.abs(st.s - s); if (d < 22) f = Math.min(f, 0.45 + 0.55 * d / 22); }
    return f;
  }
  const BST = steps.find(st => st.n === 'Avenue Marie-Thérèse');   /* the cyclist is only ever at the right turn onto Avenue Marie-Thérèse */
  function bsZone(s) { if (!BST) return; const d = (BST.s - s) * K; pane._bs = { sig: d > 0 && d < 300, on: d > 190 && d < 265 }; }
  pane._navSeek = m => { if (!BST) return; s = BST.s - m / K; sim = (s - S0) * K / 13.3; rot = bearing(s); lastStep = null; hold = 0; draw(s, rot); setTurn(s); setTrip(s, sim); bsZone(s); };   /* jump to m metres before that turn */
  bsZone(s);
  function tick(t) {
    const dt = last === null ? 0 : Math.min(0.05, (t - last) / 1000); last = t;
    if (hold > 0) { hold -= dt; requestAnimationFrame(tick); return; }
    const f = speedFactor(s);
    s += SPEED * f * dt * PLAY; sim += dt * PLAY;
    const target = bearing(s);
    let d = ((target - rot + 540) % 360) - 180;
    rot += d * Math.min(1, dt * 2.2);
    draw(s, rot); setTurn(s); setTrip(s, sim); bsZone(s);
    shown += (48 * (0.5 + 0.5 * f) - shown) * Math.min(1, dt * 1.5);   // speedometer eases, no jumps
    if (ui.speed && !pane.classList.contains('dash-car')) ui.speed.textContent = Math.round(shown);
    if (s - S0 > RUN) {                   // loop: fade, reset, fade back
      vp.classList.add('fade');
      setTimeout(() => { s = S0; sim = 0; rot = bearing(S0); lastStep = null; draw(s, rot); setTurn(s); setTrip(s, 0); bsZone(s); shown = 48; if (ui.speed && !pane.classList.contains('dash-car')) ui.speed.textContent = 48; vp.classList.remove('fade'); hold = 1.6; }, 700);
      last = null; setTimeout(() => requestAnimationFrame(tick), 720); return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  }
})();
