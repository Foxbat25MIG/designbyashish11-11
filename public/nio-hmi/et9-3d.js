/* ET9 3D car for Mark 2 — one model, many views.
   Built on three.js r170 (MIT). The model file is Adi's own purchased ET9 exterior.
   Usage: const v = await ET9.mount(el, { view: 'qc' | 'ty' | 'side' | 'hero', orbit: true, onPick })
          v.set({ open: {dfl, dfr, drl, drr, frunk, boot}, port, wins: {fl, fr, rl, rr}, mir: 'fold'|'out',
                  shade: {l, r}, lights: 'on'|'auto'|'off', lift: mm, spin: true, warn: 'fl'|null }) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = new URL('.', import.meta.url).href;
const EASE = t => 1 - Math.pow(1 - t, 3);          // close to the HMI's cubic-bezier(.2,.8,.2,1)

export const PAINTS = {
  // e: how strongly the sky reflects in the paint (dark paints need less, or they go milky)
  ceramic:  { name: 'Midnight Ceramic Blue', c: '#1d2540', m: .45, r: .2,  e: .5 },
  lavender: { name: 'Lavender silver',       c: '#b8b1d2', m: .7,  r: .26, e: .7 },
  cloud:    { name: 'Cloud White',           c: '#e8e7ec', m: .05, r: .26, e: .6 },
  black:    { name: 'Deep Black',            c: '#18171d', m: .45, r: .2,  e: .55 },
  moon:     { name: 'New Moon Silver',       c: '#a3a5ac', m: .85, r: .26, e: .65 },
  southern: { name: 'Southern Star Blue',    c: '#33548c', m: .55, r: .22, e: .6 },
  gold:     { name: 'Sunlight Gold',         c: '#b89c6c', m: .8,  r: .26, e: .75 },
};
const storedPaint = () => { try { return localStorage.getItem('nio-paint'); } catch (e) { return null; } };
let paintKey = PAINTS[storedPaint()] ? storedPaint() : 'lavender';

/* ---------- shared materials ---------- */
const M = {
  paint: new THREE.MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.15 }),   // glossy clear coat over a smooth, subdivided body
  glass: new THREE.MeshPhysicalMaterial({ color: '#191722', metalness: .1, roughness: .05, envMapIntensity: 1.4, transparent: true, opacity: .9 }),
  roof: new THREE.MeshPhysicalMaterial({ color: '#1d1a28', metalness: .1, roughness: .04, envMapIntensity: 1.5, transparent: true, opacity: .62, depthWrite: false }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .05, transparent: true, opacity: .18, depthWrite: false }),
  redLens: new THREE.MeshPhysicalMaterial({ color: '#5a1018', roughness: .1, transparent: true, opacity: .85 }),
  head: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1 }),
  tail: new THREE.MeshStandardMaterial({ color: '#3a0a10', emissive: '#ff2236', emissiveIntensity: 1 }),
  cabin: new THREE.MeshStandardMaterial({ color: '#7d7690', roughness: .95 }),
  trim: new THREE.MeshStandardMaterial({ color: '#4a4556', roughness: .8 }),
  trimHi: new THREE.MeshStandardMaterial({ color: '#cfc7dd', roughness: .5 }),   // lighter: with a window down you see a soft interior, not a black hole
  fabric: new THREE.MeshStandardMaterial({ color: '#cfc9dc', roughness: .95, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ color: '#7fcf96', transparent: true, opacity: 0, depthWrite: false }),
};
M.paintD = M.paint.clone(); M.paintD.side = THREE.DoubleSide;
function applyPaint() { const p = PAINTS[paintKey]; [M.paint, M.paintD].forEach(m => { m.color.set(p.c); m.metalness = p.m; m.roughness = p.r; m.envMapIntensity = p.e; m.needsUpdate = true; }); }
applyPaint();

/* ---------- geometry helpers ---------- */
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
// split a mesh's triangles (by world-space centroid) into new meshes; returns {key: Mesh}; triangles that match no key stay
function splitMesh(mesh, keyOf) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index ? g.index.array : [...Array(pos.count).keys()];
  const mw = mesh.matrixWorld, buckets = {}, rest = [];
  for (let i = 0; i < idx.length; i += 3) {
    tmp.fromBufferAttribute(pos, idx[i]).applyMatrix4(mw); tmp2.fromBufferAttribute(pos, idx[i + 1]).applyMatrix4(mw); tmp3.fromBufferAttribute(pos, idx[i + 2]).applyMatrix4(mw);
    const zmin = Math.min(tmp.z, tmp2.z, tmp3.z), c = tmp.add(tmp2).add(tmp3).multiplyScalar(1 / 3); c.zmin = zmin; const k = keyOf(c);
    (k ? (buckets[k] = buckets[k] || []) : rest).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const out = {};
  Object.entries(buckets).forEach(([k, arr]) => {
    const ng = new THREE.BufferGeometry(); Object.entries(g.attributes).forEach(([n, a]) => ng.setAttribute(n, a)); ng.setIndex(arr);
    const m = new THREE.Mesh(ng, mesh.material); m.matrix.copy(mw); m.matrixAutoUpdate = false; m.matrix.decompose(m.position, m.quaternion, m.scale); m.matrixAutoUpdate = true;
    out[k] = m;
  });
  if (Object.keys(out).length) { const ng = new THREE.BufferGeometry(); Object.entries(g.attributes).forEach(([n, a]) => ng.setAttribute(n, a)); ng.setIndex(rest); mesh.geometry = ng; }
  return out;
}
const SMOOTH = new WeakMap();
function smoothGeo(g) { return g; }   // the painted panels are refined once, when the file loads (refinePaint)
/* weld a triangle soup into shared points */
function weld(P) {
  const map = new Map(), pos = [], idx = new Uint32Array(P.length / 3);
  for (let i = 0; i < idx.length; i++) { const k = Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5);
    let v = map.get(k); if (v === undefined) { v = pos.length / 3; map.set(k, v); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } idx[i] = v; }
  return { pos: new Float32Array(pos), idx };
}
/* Fair the surface: Taubin smoothing (a shrink step then an inflate step, repeated) evens out bumps and facets without
   shrinking the car. Points on open panel edges and on real creases stay pinned, so shut lines and character lines keep. */
function fair(pos, idx, iters, creaseDeg) {
  const n = pos.length / 3, T = idx.length / 3, fnx = new Float32Array(T * 3), edges = new Map();
  for (let t = 0; t < T; t++) { const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const d = Math.hypot(x, y, z) || 1; fnx[t * 3] = x / d; fnx[t * 3 + 1] = y / d; fnx[t * 3 + 2] = z / d;
    for (let e = 0; e < 3; e++) { const i = idx[t * 3 + e], j = idx[t * 3 + (e + 1) % 3], k = i < j ? i * n + j : j * n + i; const l = edges.get(k); if (l) l.push(t); else edges.set(k, [t]); } }
  const fixed = new Uint8Array(n), nb = Array.from({ length: n }, () => []), cosC = Math.cos(creaseDeg * Math.PI / 180);
  edges.forEach((fs, k) => { const i = Math.floor(k / n), j = k % n; nb[i].push(j); nb[j].push(i);
    if (fs.length !== 2) { fixed[i] = fixed[j] = 1; return; }
    const a = fs[0] * 3, b = fs[1] * 3; if (fnx[a] * fnx[b] + fnx[a + 1] * fnx[b + 1] + fnx[a + 2] * fnx[b + 2] < cosC) fixed[i] = fixed[j] = 1; });
  const tmp = new Float32Array(pos.length);
  const step = f => { tmp.set(pos); for (let v = 0; v < n; v++) { if (fixed[v] || !nb[v].length) continue; let x = 0, y = 0, z = 0; const L = nb[v];
      for (let q = 0; q < L.length; q++) { const o = L[q] * 3; x += tmp[o]; y += tmp[o + 1]; z += tmp[o + 2]; } const o = v * 3, m = 1 / L.length;
      pos[o] += f * (x * m - tmp[o]); pos[o + 1] += f * (y * m - tmp[o + 1]); pos[o + 2] += f * (z * m - tmp[o + 2]); } };
  for (let it = 0; it < iters; it++) { step(.5); step(-.53); }
}
/* the whole treatment for one painted panel mesh */
function refinePaint(geo, r = .13) {   /* r: how far each smoothing patch reaches, in metres */
  let g = geo.index ? geo.toNonIndexed() : geo;
  g = pnSubdivide(toCreasedNormals(g, Math.PI / 3), 2);            // finer, curved facets
  const c = Math.cos(32 * Math.PI / 180); return mlsSurface(mlsSurface(g, r, c), r, c);
}
/* Rebuild the surface from the points themselves rather than the triangles: around every point, fit a smooth curved patch
   (a quadric) to everything within a few centimetres that faces the same way, then put the point on it and take its normal.
   Long thin source triangles stop showing, because the patch doesn't care how the points were joined. Panel edges and
   creases keep their place (normals still refine there), so panels still meet cleanly. */
function mlsSurface(g, r, cosC) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, C = P.length / 3, K = q => Math.round(P[q * 3] * 1e5) + ',' + Math.round(P[q * 3 + 1] * 1e5) + ',' + Math.round(P[q * 3 + 2] * 1e5);
  const vid = new Int32Array(C), ids = new Map();
  for (let c = 0; c < C; c++) { const k = K(c); let v = ids.get(k); if (v === undefined) { v = ids.size; ids.set(k, v); } vid[c] = v; }
  const V = ids.size, pin = new Uint8Array(V), nrm = new Float32Array(V * 3).fill(NaN), ec = new Map();
  for (let c = 0; c < C; c++) { const v = vid[c], o = v * 3;                                   // a point with two different normals sits on a crease
    if (isNaN(nrm[o])) { nrm[o] = N[c * 3]; nrm[o + 1] = N[c * 3 + 1]; nrm[o + 2] = N[c * 3 + 2]; }
    else if (nrm[o] * N[c * 3] + nrm[o + 1] * N[c * 3 + 1] + nrm[o + 2] * N[c * 3 + 2] < .999) pin[v] = 1; }
  for (let t = 0; t < C / 3; t++) for (let e = 0; e < 3; e++) { const a = vid[t * 3 + e], b = vid[t * 3 + (e + 1) % 3], k = a < b ? a * V + b : b * V + a; ec.set(k, (ec.get(k) || 0) + 1); }
  ec.forEach((n, k) => { if (n !== 2) { pin[Math.floor(k / V)] = 1; pin[k % V] = 1; } });         // open edges stay put
  // samples: one per point and normal, hashed into a grid of cells r wide
  const S = [], seen = new Set(), grid = new Map(), cell = (x, y, z) => Math.floor(x / r) + ',' + Math.floor(y / r) + ',' + Math.floor(z / r);
  for (let c = 0; c < C; c++) { const k = vid[c] + ':' + Math.round(N[c * 3] * 50) + Math.round(N[c * 3 + 1] * 50) * 101 + Math.round(N[c * 3 + 2] * 50) * 10201; if (seen.has(k)) continue; seen.add(k);
    const i = S.length; S.push(c); const h = cell(P[c * 3], P[c * 3 + 1], P[c * 3 + 2]); const L = grid.get(h); if (L) L.push(i); else grid.set(h, [i]); }
  const outP = new Float32Array(P), outN = new Float32Array(N), A = new Float64Array(36), B = new Float64Array(6), cache = new Map(), r2 = r * r;
  for (let c = 0; c < C; c++) {
    const o = c * 3, px = P[o], py = P[o + 1], pz = P[o + 2], nx = N[o], ny = N[o + 1], nz = N[o + 2];
    const ck = vid[c] + ':' + nx.toFixed(4) + ny.toFixed(4) + nz.toFixed(4), hit = cache.get(ck);
    if (hit) { outP.set(hit[0], o); outN.set(hit[1], o); continue; }
    // local frame
    let tx = Math.abs(nx) < .9 ? 1 : 0, ty = tx ? 0 : 1, tz = 0; let d = tx * nx + ty * ny; tx -= d * nx; ty -= d * ny; tz -= d * nz; let l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    A.fill(0); B.fill(0); let cnt = 0;
    const gx = Math.floor(px / r), gy = Math.floor(py / r), gz = Math.floor(pz / r);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const L = grid.get((gx + i) + ',' + (gy + j) + ',' + (gz + k)); if (!L) continue;
      for (let q = 0; q < L.length; q++) { const s = S[L[q]] * 3, dx = P[s] - px, dy = P[s + 1] - py, dz = P[s + 2] - pz, dd = dx * dx + dy * dy + dz * dz;
        if (dd > r2 || N[s] * nx + N[s + 1] * ny + N[s + 2] * nz < cosC) continue;
        const u = (dx * tx + dy * ty + dz * tz) / r, v = (dx * bx + dy * by + dz * bz) / r, h = (dx * nx + dy * ny + dz * nz) / r, w = Math.pow(1 - dd / r2, 3);
        const f = [u * u, u * v, v * v, u, v, 1]; for (let a = 0; a < 6; a++) { const fa = f[a] * w; B[a] += fa * h; for (let b2 = a; b2 < 6; b2++) A[a * 6 + b2] += fa * f[b2]; } cnt++; } }
    let res = null;
    if (cnt >= 24) { for (let a = 0; a < 6; a++) { A[a * 6 + a] += 1e-7; for (let b2 = 0; b2 < a; b2++) A[a * 6 + b2] = A[b2 * 6 + a]; } res = solve6(A, B); }
    let fp = [px, py, pz], fn = [nx, ny, nz];
    if (res) { const [,,, du, dv, h0] = res; const vx = pin[vid[c]] ? 0 : h0 * r;
      fp = [px + nx * vx, py + ny * vx, pz + nz * vx];
      let mx = nx - du * tx - dv * bx, my = ny - du * ty - dv * by, mz = nz - du * tz - dv * bz; l = Math.hypot(mx, my, mz); if (l && (mx * nx + my * ny + mz * nz) / l > .85) fn = [mx / l, my / l, mz / l]; }
    cache.set(ck, [fp, fn]); outP.set(fp, o); outN.set(fn, o);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(outP, 3)); out.setAttribute('normal', new THREE.BufferAttribute(outN, 3)); return out;
}
function solve6(A, B) {   // small Gaussian elimination with pivoting
  const M = Array.from({ length: 6 }, (_, i) => [...A.slice(i * 6, i * 6 + 6), B[i]]);
  for (let i = 0; i < 6; i++) { let p = i; for (let j = i + 1; j < 6; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) return null;
    for (let j = i + 1; j < 6; j++) { const f = M[j][i] / M[i][i]; for (let k = i; k < 7; k++) M[j][k] -= f * M[i][k]; } }
  const x = new Array(6); for (let i = 5; i >= 0; i--) { let s = M[i][6]; for (let k = i + 1; k < 6; k++) s -= M[i][k] * x[k]; x[i] = s / M[i][i]; } return x;
}
function calmNormals(g, n, idx, iters, cosC) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, C = P.length / 3, vid = new Int32Array(C), at = Array.from({ length: n }, () => []), nb = Array.from({ length: n }, () => new Set());
  const key = new Map();
  for (let c = 0; c < C; c++) { const k = Math.round(P[c * 3] * 1e5) + ',' + Math.round(P[c * 3 + 1] * 1e5) + ',' + Math.round(P[c * 3 + 2] * 1e5);
    let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); if (v >= n) { at.push([]); nb.push(new Set()); } } vid[c] = v; at[v].push(c); }
  for (let t = 0; t < C / 3; t++) for (let e = 0; e < 3; e++) { const a = vid[t * 3 + e], b = vid[t * 3 + (e + 1) % 3]; nb[a].add(b); nb[b].add(a); }
  const ring = at.map((_, v) => [v, ...nb[v]]), tmp = new Float32Array(N.length);
  for (let it = 0; it < iters; it++) { tmp.set(N);
    for (let c = 0; c < C; c++) { const o = c * 3, nx = tmp[o], ny = tmp[o + 1], nz = tmp[o + 2]; let x = 0, y = 0, z = 0; const R0 = ring[vid[c]];
      for (let r = 0; r < R0.length; r++) { const L = at[R0[r]]; for (let q = 0; q < L.length; q++) { const p = L[q] * 3, d = tmp[p] * nx + tmp[p + 1] * ny + tmp[p + 2] * nz; if (d > cosC) { x += tmp[p] * d; y += tmp[p + 1] * d; z += tmp[p + 2] * d; } } }
      const l = Math.hypot(x, y, z) || 1; N[o] = x / l; N[o + 1] = y / l; N[o + 2] = z / l; } }
  g.attributes.normal.needsUpdate = true; return g;
}
/* Make the painted panels genuinely smooth: every triangle is split into four, and the new points are pushed out onto a
   curved surface (PN triangles) worked out from the normals, twice over. Flat facets become a continuous curve, so the
   reflections flow along the body instead of breaking at every facet. Positions use one smooth normal per point, so
   neighbouring panels still meet without gaps; shading keeps the crisp creases. */
function pnSubdivide(geo, levels) {
  let P = geo.attributes.position.array, N = geo.attributes.normal.array;
  const key = (a, i) => Math.round(a[i] * 2e4) + ',' + Math.round(a[i + 1] * 2e4) + ',' + Math.round(a[i + 2] * 2e4);
  for (let l = 0; l < levels; l++) {
    const sm = new Map();
    for (let i = 0; i < P.length; i += 9) {
      const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
      const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
      for (let k = 0; k < 9; k += 3) { const id = key(P, i + k), v = sm.get(id) || [0, 0, 0]; v[0] += fx; v[1] += fy; v[2] += fz; sm.set(id, v); } }
    sm.forEach(v => { const d = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= d; v[1] /= d; v[2] /= d; });
    const np = new Float32Array(P.length * 4), nn = new Float32Array(N.length * 4); let o = 0;
    const mid = (i, j, out, on) => {
      const si = sm.get(key(P, i)), sj = sm.get(key(P, j)), dx = P[j] - P[i], dy = P[j + 1] - P[i + 1], dz = P[j + 2] - P[i + 2];
      const wi = dx * si[0] + dy * si[1] + dz * si[2], wj = -(dx * sj[0] + dy * sj[1] + dz * sj[2]);
      for (let c = 0; c < 3; c++) { const c1 = (2 * P[i + c] + P[j + c] - wi * si[c]) / 3, c2 = (2 * P[j + c] + P[i + c] - wj * sj[c]) / 3; out[c] = (P[i + c] + 3 * c1 + 3 * c2 + P[j + c]) / 8; }
      const ax = N[i] + N[j], ay = N[i + 1] + N[j + 1], az = N[i + 2] + N[j + 2], d = Math.hypot(ax, ay, az) || 1; on[0] = ax / d; on[1] = ay / d; on[2] = az / d; };
    const m01 = [0, 0, 0], m12 = [0, 0, 0], m20 = [0, 0, 0], n01 = [0, 0, 0], n12 = [0, 0, 0], n20 = [0, 0, 0];
    const put = (p, n) => { np[o] = p[0]; np[o + 1] = p[1]; np[o + 2] = p[2]; nn[o] = n[0]; nn[o + 1] = n[1]; nn[o + 2] = n[2]; o += 3; };
    for (let i = 0; i < P.length; i += 9) {
      const v0 = [P[i], P[i + 1], P[i + 2]], v1 = [P[i + 3], P[i + 4], P[i + 5]], v2 = [P[i + 6], P[i + 7], P[i + 8]];
      const w0 = [N[i], N[i + 1], N[i + 2]], w1 = [N[i + 3], N[i + 4], N[i + 5]], w2 = [N[i + 6], N[i + 7], N[i + 8]];
      mid(i, i + 3, m01, n01); mid(i + 3, i + 6, m12, n12); mid(i + 6, i, m20, n20);
      put(v0, w0); put(m01, n01); put(m20, n20);  put(m01, n01); put(v1, w1); put(m12, n12);
      put(m20, n20); put(m12, n12); put(v2, w2);  put(m01, n01); put(m12, n12); put(m20, n20); }
    P = np; N = nn; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return out;
}
function pivot(name, x, y, z) { const p = new THREE.Group(); p.name = name; p.position.set(x, y, z); return p; }

/* ---------- build one prepared car from the loaded file ---------- */
const DOOR_SRC = new Set([27, 39, 40, 41, 72, 44, 56]), MIRROR = new Set([0, 45, 46]), HOOD = new Set([22]), BOOT = new Set([30, 50]);
const ROOFG = 29, GLASS_SIDE = 40;
const WZ = 1.62;                               // wheel centres, ±z
function doorKey(c) {
  if (Math.abs(c.x) < .5 || c.y < .3) return null; const s = c.x > 0 ? 'l' : 'r';
  if (c.z > -.165 && c.z < 1.05) return 'df' + s;
  if (c.z > -1.31 && c.z <= -.165) return 'dr' + s;
  return null;
}
function cornerOf(b) {
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  if (Math.abs(c.x) < .7 || s.y > .9 || b.max.y > .82 || Math.abs(Math.abs(c.z) - WZ) > .45) return null;
  return (c.z > 0 ? 'f' : 'r') + (c.x > 0 ? 'l' : 'r');
}

let rawP;
const PAINT_R = { 22: .28, 24: .2, 31: .18 };   // hood gets a wider smoothing patch: it is one big gentle dome
function loadRaw() { if (!rawP) (window.__et9t = window.__et9t || []).push(['load:start', Math.round(performance.now())]); return rawP || (rawP = Promise.all([new GLTFLoader().loadAsync(BASE + 'model/et9.glb'), window.ET9_BAKE ? null : fetch(BASE + 'model/paint.bin').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)]).then(([g, bin]) => {
  g.scene.traverse(o => { if (!o.isMesh) return; const a = g.parser.associations.get(o) || g.parser.associations.get(o.parent); o.userData.mi = a && a.meshes != null ? a.meshes : -1; });
  { const plates = []; g.scene.traverse(o => { if (o.isMesh && (o.userData.mi === 70 || o.userData.mi === 71)) plates.push(o); }); plates.forEach(o => o.parent.remove(o)); }   // no number plates
  const baked = bin ? readPaint(bin) : null, done = new Map(), out = [];
  g.scene.traverse(o => { if (!o.isMesh) return; const n = (o.material.name || '').toLowerCase(); if (n !== 'car paint' && n !== 'car_paint') return; const mi = o.userData.mi;
    if (!done.has(o.geometry)) { const ng = baked && baked.get(mi) || toIndexed(refinePaint(o.geometry, PAINT_R[mi])); done.set(o.geometry, ng); out.push([mi, ng]); } o.geometry = done.get(o.geometry); });
  if (window.ET9_BAKE) window.__bake = writePaint(out);
  window.__et9t.push(['load:done', Math.round(performance.now())]);
  return g; })); }
/* The refined paint surface is worked out once, offline, and shipped as model/paint.bin (points, normals, triangles per panel)
   so phones don't spend seconds on it. Without the file the same work runs live. */
function toIndexed(g) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, map = new Map(), pos = [], nor = [], idx = new Uint32Array(P.length / 3);
  for (let c = 0; c < idx.length; c++) { const o = c * 3, k = P[o].toFixed(5) + ',' + P[o + 1].toFixed(5) + ',' + P[o + 2].toFixed(5) + ',' + Math.round(N[o] * 3e3) + ',' + Math.round(N[o + 1] * 3e3) + ',' + Math.round(N[o + 2] * 3e3);
    let v = map.get(k); if (v === undefined) { v = pos.length / 3; map.set(k, v); pos.push(P[o], P[o + 1], P[o + 2]); nor.push(N[o], N[o + 1], N[o + 2]); } idx[c] = v; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); out.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); return out;
}
function writePaint(list) {
  const al = x => Math.ceil(x / 4) * 4; let size = 4; list.forEach(([, g]) => { size += 12 + al(g.attributes.position.count * 12) + al(g.index.count * 2); });
  const buf = new ArrayBuffer(size), dv = new DataView(buf); let o = 0; dv.setUint32(o, list.length, true); o += 4;
  list.forEach(([mi, g]) => { const nv = g.attributes.position.count, ni = g.index.count; dv.setUint32(o, mi, true); dv.setUint32(o + 4, nv, true); dv.setUint32(o + 8, ni, true); o += 12;
    const q = new Int16Array(buf, o, nv * 6), P = g.attributes.position.array, N = g.attributes.normal.array; for (let i = 0; i < nv * 3; i++) { q[i] = Math.round(P[i] / 3 * 32767); q[nv * 3 + i] = Math.round(N[i] * 32767); } o += nv * 12;
    new Uint16Array(buf, o, ni).set(g.index.array); o += al(ni * 2); });
  return buf;
}
function readPaint(buf) {
  const dv = new DataView(buf), m = new Map(); let o = 4; const n = dv.getUint32(0, true);
  for (let k = 0; k < n; k++) { const mi = dv.getUint32(o, true), nv = dv.getUint32(o + 4, true), ni = dv.getUint32(o + 8, true); o += 12;
    const q = new Int16Array(buf, o, nv * 6), P = new Float32Array(nv * 3); for (let i = 0; i < nv * 3; i++) P[i] = q[i] / 32767 * 3;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buf.slice(o + nv * 6, o + nv * 12)), 3, true)); o += nv * 12;
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf.slice(o, o + ni * 2)), 1)); o += Math.ceil(ni * 2 / 4) * 4; m.set(mi, g); }
  return m;
}

async function buildCar() {
  const g = await loadRaw();
  const src = g.scene.clone(true); src.position.set(0, -.012740254402160645, -.016318082809448242); src.updateMatrixWorld(true);
  const list = [];
  src.traverse(o => { if (o.isMesh) list.push({ o, mi: o.userData.mi }); });
  // materials
  list.forEach(({ o }) => {
    const n = (o.material.name || '').toLowerCase();
    if (n === 'car paint' || n === 'car_paint') o.material = M.paint;
    else if (n.startsWith('glassblack.001')) o.material = M.roof;
    else if (n.startsWith('glassblack')) o.material = M.glass;
    else if (n === 'glassred') o.material = M.redLens;
    else if (n === 'glass_headlight77') o.material = M.lens;
    else if (n === 'front_white_light') o.material = M.head;
    else if (n === 'back_red_light') o.material = M.tail;
  });
  const car = new THREE.Group(), body = new THREE.Group(); car.add(body); body.name = 'body';
  const P = { wheels: {}, doors: {}, panes: {}, mirrors: {} };
  // wheels: hub (moves with nothing; body moves over it) + spin
  ['fl', 'fr', 'rl', 'rr'].forEach(k => { const x = k[1] === 'l' ? .88 : -.88, z = k[0] === 'f' ? WZ : -WZ;
    const hub = pivot('hub-' + k, x, .4, z), spin = new THREE.Group(); hub.add(spin); car.add(hub); P.wheels[k] = { hub, spin }; });
  // doors and mirrors
  ['dfl', 'dfr', 'drl', 'drr'].forEach(k => { const s = k[2] === 'l' ? 1 : -1, z = k[1] === 'f' ? 1.02 : -.17;
    const d = pivot(k, s * .99, .8, z); body.add(d); P.doors[k] = d;
    const pane = new THREE.Group(); pane.name = 'pane-' + k; d.add(pane); P.panes[k] = pane;
    // an inner door trim, so an open door shows a full panel with depth, not a paper-thin shell
    const len = k[1] === 'f' ? 1.1 : 1.02, tg = new THREE.BoxGeometry(.07, .56, len, 1, 1, 1); tg.translate(-s * .1, -.12, -len / 2 - .05);
    const trim = new THREE.Mesh(tg, M.trim); trim.name = 'trim'; d.add(trim);
    const arm = new THREE.BoxGeometry(.09, .05, len * .55); arm.translate(-s * .15, -.03, -len * .5 - .05); d.add(new THREE.Mesh(arm, M.trimHi)); });
  ['l', 'r'].forEach(s => { const m = pivot('mir-' + s, (s === 'l' ? 1 : -1) * .962, 1.16, .875); P.doors['df' + s].attach(m); P.mirrors[s] = m; });
  P.frunk = pivot('frunk', 0, 1.1, 1.28); body.add(P.frunk);
  P.boot = pivot('boot', 0, 1.31, -2.2); body.add(P.boot);
  const box = new THREE.Box3();
  list.forEach(({ o, mi }) => {
    box.setFromObject(o); const corner = cornerOf(box);
    if (corner) { const w = P.wheels[corner], brake = [3, 16, 17, 18].includes(mi); (brake ? w.hub : w.spin).attach(o); return; }
    if (MIRROR.has(mi)) { Object.entries(splitMesh(o, c => c.x > 0 ? 'l' : 'r')).forEach(([s, m]) => P.mirrors[s].attach(m)); o.removeFromParent(); return; }
    if (HOOD.has(mi)) { P.frunk.attach(o); return; }
    if (BOOT.has(mi)) { P.boot.attach(o); return; }
    if (DOOR_SRC.has(mi)) {
      // the black panel behind the side glass (mesh 56) goes down with the glass, or the window still looks shut
      const glassKey = c => { const k = doorKey(c); return k && k[1] === 'r' && (c.zmin ?? c.z) < -1.17 && c.y > 1.0 ? null : k; /* glass reaching behind the rear door frame stays put */ };   // the fixed rear quarter glass stays with the body
      const parts = splitMesh(o, mi === 56 ? (c => { const k = glassKey(c); return k && c.y > 1.12 && Math.abs(c.x) < .93 ? 'p' + k : null; }) : mi === GLASS_SIDE ? glassKey : doorKey);
      Object.entries(parts).forEach(([k, m]) => { if (mi !== GLASS_SIDE && k[0] === 'p') m.userData.frit = true; (mi === GLASS_SIDE ? P.panes[k] : k[0] === 'p' ? P.panes[k.slice(1)] : P.doors[k]).attach(m); });
      if (mi === 27 || mi === 39) { o.removeFromParent(); return; }
    }
    if (mi === ROOFG) P.roofGlass = o;
    body.attach(o);
  });
  // window glass stays clean below the belt line: clip each pane at the door's sill
  P.paneMat = M.glass.clone(); P.paneMat.side = THREE.DoubleSide; P.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.115); P.paneMat.clippingPlanes = [P.clip];
  P.aclip = new THREE.Plane(); P.paneMatF = P.paneMat.clone(); P.paneMatF.clippingPlanes = [P.clip, P.aclip];   // front windows: also cut along the A-pillar line, so the dropping glass never shows in front of the window opening
  const fritM = new THREE.MeshStandardMaterial({ color: '#141318', roughness: .5, side: THREE.DoubleSide }), fritF = fritM.clone(); fritM.clippingPlanes = [P.clip]; fritF.clippingPlanes = [P.clip, P.aclip];   // the dark edge band of each glass, moving with it
  Object.entries(P.panes).forEach(([k, p]) => p.traverse(o => { if (o.isMesh) o.material = o.userData.frit ? (k[1] === 'f' ? fritF : fritM) : k[1] === 'f' ? P.paneMatF : P.paneMat; }));
  // dark cabin, so open windows and the glass roof show an interior, not the far side of the car
  // a soft, frosted-glass volume for the cabin: reads as an interior through the roof and windows, never as a box,
  // and sits high enough that it never shows in the wheel arches
  /* The file's own interior (seats, console, dash: one mesh) was drawn in shiny black metal, which mirrored the sky as white
     blotches. It gets a soft matte leather instead; nothing extra is layered on top, so no two surfaces fight. */
  { const leather = new THREE.MeshStandardMaterial({ color: '#57525b', roughness: .78, metalness: 0 }); let cab = null;
    body.traverse(o => { if (o.isMesh && o.userData.mi === 19) { o.material = leather; cab = cab || o; } });
    P.cabin = cab || new THREE.Group(); P.cabinMats = [leather]; }
  // two sunshades under the roof glass (left / right), they roll back towards the rear
  P.shades = {};
  ['l', 'r'].forEach(s => { const g2 = new THREE.PlaneGeometry(.6, 1.72, 12, 32); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, -.86);
    const mat = M.fabric.clone(); mat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    const sh = new THREE.Mesh(g2, mat); sh.position.set((s === 'l' ? 1 : -1) * .31, 1.47, .22); body.add(sh); P.shades[s] = sh;
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .6, 20), M.fabric); roll.rotation.z = Math.PI / 2; body.add(roll); sh.userData.roll = roll; });
  P.curveShades = true;
  // dark matte liners in the wheel arches, so no light inner panels show around the tyres
  { const linM = new THREE.MeshStandardMaterial({ color: '#141218', roughness: .95, side: THREE.DoubleSide });
    Object.values(P.wheels).forEach(w => { const g = new THREE.CylinderGeometry(.47, .47, .3, 40, 1, true, Math.PI * .04, Math.PI * .92); g.rotateZ(Math.PI / 2);   // top half only: never shows under the tyre
      const m = new THREE.Mesh(g, linM); m.position.copy(w.hub.position); m.position.x *= .93; body.add(m); }); }
  // charge port flap on the left rear quarter (green glow when open)
  const flapG = new THREE.BoxGeometry(.014, .17, .2); flapG.translate(0, 0, -.1);
  P.port = pivot('port', .975, 1.0, -2.06); const flap = new THREE.Mesh(flapG, M.paint); P.port.add(flap); body.add(P.port);
  P.portGlow = new THREE.Mesh(new THREE.CircleGeometry(.16, 32), M.glow.clone()); P.portGlow.rotation.y = Math.PI / 2; P.portGlow.position.set(.99, 1.0, -2.14); body.add(P.portGlow);
  P.portHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex([[0, .9], [.3, .45], [1, 0]]), color: '#4bdc8c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); P.portHalo.position.set(1.12, 1.02, -2.16); P.portHalo.scale.set(.9, .9, 1); P.portHalo.name = 'fx'; body.add(P.portHalo);
  // a soft red pool under a tyre that is losing pressure (tyres are hidden when seen from straight above)
  P.wglow = {};
  { const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const x2 = c2.getContext('2d'), g3 = x2.createRadialGradient(64, 64, 2, 64, 64, 64);
    g3.addColorStop(0, 'rgba(255,60,80,1)'); g3.addColorStop(1, 'rgba(255,60,80,0)'); x2.fillStyle = g3; x2.fillRect(0, 0, 128, 128); const tex = new THREE.CanvasTexture(c2);
    Object.entries(P.wheels).forEach(([k, w]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(w.hub.position.x * 1.12, .004, w.hub.position.z); m.name = 'wglow'; car.add(m); P.wglow[k] = m; }); }
  // soft contact shadow
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const cx = sc.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(40,30,70,.5)'); gr.addColorStop(1, 'rgba(40,30,70,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 6.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = .002; sh.name = 'shadow'; car.add(sh);
  // lights you can see: halos at the lamps, a pool of light on the road ahead / behind, amber hazard flashers
  const soft = softTex(), poolT = softTex([[0, 1], [.5, .45], [1, 0]]);
  const halo = (c, x, y, z, sc, parent = body) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: c, transparent: true, opacity: 0, depthWrite: false })); sp.position.set(x, y, z); sp.scale.set(sc, sc, 1); sp.name = 'fx'; parent.add(sp); return sp; };
  const pool = (c, x, z, w, l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: poolT, color: c, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .006, z); m.name = 'fx'; car.add(m); return m; };
  const bt = barTex(), btSoft = barTex(.11, .28, .55), bar = (c, y, z, w, h, bend) => {   // a flat ribbon along the curve of the nose or tail (seen from above it follows the car's outline)
    const N = 48, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const u = i / N, x = (u - .5) * w, zc = z + bend * (1 - Math.pow(x / (w / 2), 2));
      const dz = -2 * bend * x / Math.pow(w / 2, 2), l = Math.hypot(1, dz), nx = -dz / l, nz = 1 / l;
      pos.push(x - nx * h / 2, y, zc - nz * h / 2, x + nx * h / 2, y, zc + nz * h / 2); uv.push(u, 0, u, 1); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: c === '#ff2f48' ? btSoft : bt, color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.userData.b = [1, 1]; m.name = 'fx'; body.add(m); return m; };
  P.fx = { head: [bar('#fff5e0', .84, 2.3, 1.86, .3, .22)], tail: [bar('#ff2f48', 1.08, -2.55, 1.96, .4, -.16)],   // full-width light bars front and rear, not round dots
    haz: [halo('#ffa524', .88, .78, 2.44, .9), halo('#ffa524', -.88, .78, 2.44, .9), halo('#ffa524', .9, 1.04, -2.66, .9), halo('#ffa524', -.9, 1.04, -2.66, .9)],
    hazPool: [pool('#ffa524', .9, 2.5, 1.6, 1.6), pool('#ffa524', -.9, 2.5, 1.6, 1.6), pool('#ffa524', .9, -2.75, 1.6, 1.6), pool('#ffa524', -.9, -2.75, 1.6, 1.6)],
    headPool: pool('#fff0c4', 0, 4.9, 3.6, 4.8), tailPool: pool('#ff3048', 0, -3.35, 2.8, 1.5) };
  /* Charging: a cable plugged into the left-rear port with soft pulses of light running along it into the car, and a glowing
     battery outline in the floor whose cells fill as it charges. All hidden until charging starts. */
  { const chU = { uT: { value: 0 }, uA: { value: 0 }, uL: { value: .78 } }; P.chgU = chU; const grp = new THREE.Group(); grp.visible = false; car.add(grp); P.chg = grp;
    const path = new THREE.CatmullRomCurve3([[1.0, 1.0, -2.14], [1.22, .97, -2.2], [1.42, .74, -2.42], [1.52, .36, -2.78], [1.5, .08, -3.25], [1.42, .04, -3.9], [1.3, .04, -5], [1.2, .04, -7]].reverse().map(a => new THREE.Vector3(...a)), false, 'centripetal');   // runs from behind the car to the port
    const cable = new THREE.Mesh(new THREE.TubeGeometry(path, 260, .03, 16), new THREE.MeshStandardMaterial({ color: '#2b2833', roughness: .45 })); cable.castShadow = true; cable.name = 'chg'; grp.add(cable); P.chgCable = cable; P.chgPath = path;
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .16, 20), new THREE.MeshStandardMaterial({ color: '#3a3644', roughness: .35, metalness: .3 })); plug.name = 'chg'; grp.add(plug); P.chgPlug = plug;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.068, .012, 10, 32), new THREE.MeshBasicMaterial({ color: '#58e39a' })); ring.rotation.y = Math.PI / 2; ring.position.set(1.155, 1.0, -2.15); ring.name = 'chg'; grp.add(ring); P.chgRing = ring;
    const flowM = new THREE.ShaderMaterial({ uniforms: chU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uT, uA; varying vec2 vUv;
        void main() { float u = vUv.x, ph = fract(u * 7. - uT * .9); float p = smoothstep(0., .35, ph) * smoothstep(1., .55, ph);
          float edge = smoothstep(1., .94, u) * smoothstep(.0, .45, u); float a = (p * .85 + .12) * edge * uA;
          gl_FragColor = vec4(vec3(.35, .95, .62) * a, a); }` });
    const flow = new THREE.Mesh(new THREE.TubeGeometry(path, 260, .055, 16), flowM); flow.name = 'chg'; flow.renderOrder = 3; grp.add(flow);
    // battery pack outline in the floor, seen through the body like an x-ray: rounded outline, 2 × 8 cells filling from the rear
    const packM = new THREE.ShaderMaterial({ uniforms: chU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uT, uA, uL; varying vec2 vUv;
        float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
        void main() { vec2 p = (vUv - .5) * vec2(1.6, 3.4); float d = rbox(p, vec2(.78, 1.68), .2);
          float line = exp(-pow(d / .018, 2.)) * .9 + exp(-pow(max(d, 0.) / .12, 2.)) * .18 * step(0., d);
          vec2 c = vec2(floor(vUv.x * 2.), floor(vUv.y * 8.)), f = fract(vUv * vec2(2., 8.)) - .5;
          float cell = smoothstep(.5, .42, max(abs(f.x) * 1.02, abs(f.y) * 1.08)) * step(d, -.04);
          float idx = (c.y + .5) / 8., lit = smoothstep(uL + .02, uL - .02, idx);
          float wave = .5 + .5 * sin((vUv.y - uT * .35) * 18.);
          float a = (line * .8 + cell * (lit * (.32 + .22 * wave) + .05)) * uA;
          gl_FragColor = vec4(vec3(.36, .93, .63) * a, a); }` });
    const baseM = new THREE.ShaderMaterial({ uniforms: chU, transparent: true, depthWrite: false, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uA; varying vec2 vUv; float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
        void main() { vec2 p = (vUv - .5) * vec2(1.6, 3.4); float d = rbox(p, vec2(.78, 1.68), .2); float a = smoothstep(.06, -.04, d) * .88 * uA; gl_FragColor = vec4(.05, .07, .1, a); }` });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.4), baseM); base.rotation.x = -Math.PI / 2; base.position.set(0, .36, -.3); base.renderOrder = 3; base.name = 'chg'; grp.add(base);
    const pack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.4), packM); pack.rotation.x = -Math.PI / 2; pack.position.set(0, .36, -.3); pack.renderOrder = 4; pack.name = 'chg'; grp.add(pack); }
  { car.updateMatrixWorld(true); const roof = []; body.traverse(o => { if (o.isMesh && o.userData.mi === 29) roof.push(o); });
    if (roof.length) { const rc = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3(); rc.firstHitOnly = true;
      const sides = roof.map(m => m.material.side); roof.forEach(m => m.material.side = THREE.DoubleSide);
      Object.values(P.shades).forEach(sh => { const a = sh.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { o.set(a.getX(i) + sh.position.x, .9, a.getZ(i) + sh.position.z); rc.set(o, up); const h = rc.intersectObjects(roof, false)[0];
          a.setY(i, (h ? h.point.y - .035 : 1.47) - sh.position.y); }
        a.needsUpdate = true; sh.geometry.computeVertexNormals();
        const prof = []; for (let i = 0; i < a.count; i++) if (Math.abs(a.getX(i)) < .03) prof.push([a.getZ(i), a.getY(i)]); prof.sort((p, q) => q[0] - p[0]); sh.userData.prof = prof; });
      roof.forEach((m, i) => m.material.side = sides[i]); } }
  car.traverse(o => { if (o.isMesh && o.name !== 'shadow' && o.name !== 'wglow' && o.name !== 'fx' && !o.material.transparent) o.castShadow = true;
    if (o.isMesh && o.material === M.paint && !o.userData.creased) { o.geometry = smoothGeo(o.geometry); o.userData.creased = true; } });
  return { car, body, P };
}

/* ---------- scenes: a lavender Japanese garden (Home, lock screen) and five drive-mode worlds (Driving) ---------- */
const C = c => new THREE.Color(c);
// mix two colours the way the eye sees it (in sRGB, not linear light)
const mixS = (a, b, t) => { const x = {}, y = {}; a.getRGB(x, THREE.SRGBColorSpace); b.getRGB(y, THREE.SRGBColorSpace); return new THREE.Color().setRGB(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t, THREE.SRGBColorSpace); };
const lerpPal = (cur, tar, k) => { let moving = false; Object.keys(tar).forEach(n => { if (!(tar[n] instanceof THREE.Color)) return; const a = cur[n]; const d = Math.abs(a.r - tar[n].r) + Math.abs(a.g - tar[n].g) + Math.abs(a.b - tar[n].b); if (d > .002) { a.lerp(tar[n], k); moving = true; } else a.copy(tar[n]); }); return moving; };
const palOf = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && v[0] === '#' ? C(v) : v]));
/* ---------- shared helpers for the scenes: noise, a dithered sky with a sun glow, soft sprites ---------- */
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = c => '#' + c.getHexString();
const rgba = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
let NOISE = null;
function noiseTile() { if (NOISE) return NOISE; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const n = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 7; } x.putImageData(d, 0, 0); return (NOISE = c); }
function gradCanvas() { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; }
// vertical gradient, optional sun glow (sun: {x, y, r, c, a} in 0..1 of the view), then a faint grain so the gradient never bands
function paintGrad(G, top, mid, bot, sun) { const x = G.c.getContext('2d'), W = 1024, H = 512, g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, hex(top)); g.addColorStop(.58, hex(mid)); g.addColorStop(1, hex(bot)); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (sun && sun.a > .01) { const r = x.createRadialGradient(sun.x * W, sun.y * H, 0, sun.x * W, sun.y * H, sun.r * W);
    r.addColorStop(0, rgba(sun.c, sun.a)); r.addColorStop(.35, rgba(sun.c, sun.a * .45)); r.addColorStop(1, rgba(sun.c, 0)); x.fillStyle = r; x.fillRect(0, 0, W, H); }
  x.fillStyle = x.createPattern(noiseTile(), 'repeat'); x.fillRect(0, 0, W, H); G.t.needsUpdate = true; }
function softTex(stops = [[0, 1], [.45, .55], [1, 0]], size = 128) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`)); x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
/* a light bar, the way the ET9's full-width lamps glow: a thin bright line with a soft halo, fading out at both ends */
function barTex(core = .045, gl = .2, ca = .95) { const W = 256, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const u = i / (W - 1), v = j / (H - 1), ends = smooth(0, .14, u) * smooth(1, .86, u), d = Math.abs(v - .5);
    const a = (Math.exp(-Math.pow(d / core, 2)) * ca + Math.exp(-Math.pow(d / gl, 2)) * .32) * ends, o = (j * W + i) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = Math.min(255, a * 255); }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function puffTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const px = 30 + Math.random() * 68, py = 34 + Math.random() * 60, r = 14 + Math.random() * 28, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function sunLight(color, pos, span = 32) { const s = new THREE.DirectionalLight(color, 2); s.position.set(...pos); s.castShadow = true;
  s.shadow.mapSize.set(2048, 2048); Object.assign(s.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 140 }); s.shadow.bias = -.0004; s.shadow.normalBias = .03; s.shadow.radius = 4; return s; }
// a grass blade: thin triangle, dark at the root, light at the tip
function bladeGeo(w = .022, h = 1, seg = 4, bend = .22) {   // a real-looking blade: tapers to a point and curves over, dark at the root, light at the tip
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, ww = w * Math.pow(1 - t, .7), z = bend * t * t, c = .42 + .62 * Math.pow(t, .8);
    if (i < seg) { pos.push(-ww, t * h, z, ww, t * h, z); col.push(c, c, c, c, c, c); } else { pos.push(0, h, z); col.push(c, c, c); } }
  for (let i = 0; i < seg - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); } const l = (seg - 1) * 2; idx.push(l, l + 1, l + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }

/* ---------- Lock and Home: green rolling hills (Adi's two references), with a lavender haze, and a dusk version for dark mode ----------
   The hills are lit once, ahead of time: every point knows how much sun it gets and whether a hill in front of it casts a
   shadow, so the long soft shadows across the valleys cost nothing per frame. Only the car's own shadow is live. */
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
function daisyTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.translate(32, 32); x.fillStyle = '#fff';
  for (let i = 0; i < 14; i++) { x.save(); x.rotate(i / 14 * Math.PI * 2); x.beginPath(); x.ellipse(0, -17, 4.2, 13, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  x.fillStyle = '#f3c63a'; x.beginPath(); x.arc(0, 0, 7.5, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function hillsScene(scene, K) {
  const T0 = performance.now(), mk = n => (window.__et9t = window.__et9t || []).push([K.seed + ':' + n, Math.round(performance.now() - T0)]);
  const PAL = { day: palOf(K.day), night: palOf(K.night) };
  const cur = Object.fromEntries(Object.entries(PAL.day).map(([k, v]) => [k, v.clone()]));
  let tar = PAL.day, L = 1, LT = 1;
  const G = gradCanvas(); scene.background = G.t; scene.fog = new THREE.Fog(cur.fog, K.fogNear, K.fogFar);
  const S = new THREE.Vector3(...K.sun).normalize();
  const hemi = new THREE.HemisphereLight(cur.sky, cur.gnd, 1.1); scene.add(hemi);
  const sun = sunLight(cur.sun, S.clone().multiplyScalar(40).toArray(), 13); sun.shadow.radius = 6; scene.add(sun); scene.add(sun.target);
  const hgt = K.height;
  // height grids, so the many lookups below are cheap: fine (0.5 m) round the car, coarse (4.5 m) out to the horizon
  const grid = (N, S, fn) => { const O = N * S / 2, H = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = fn(i * S - O, j * S - O);
    return (x, z) => { const fx = (x + O) / S, fz = (z + O) / S, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return -1e3;
      const u = fx - i, v = fz - j, a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; };
  const hCoarse = grid(240, 4.5, hgt), hFine = grid(132, .5, hgt);
  const hAt = (x, z) => Math.abs(x) < 32 && Math.abs(z) < 32 ? hFine(x, z) : hCoarse(x, z);
  // terrain as rings: fine near the car, coarse at the horizon
  const ringR = []; for (let r = 0; r < 520; r = r < 1 ? 1 : r * 1.034 + .25) ringR.push(r);
  const SEG = 240, NV = 1 + (ringR.length - 1) * SEG, P = new Float32Array(NV * 3), idx = [];
  P[1] = hgt(0, 0);
  for (let k = 1; k < ringR.length; k++) for (let s = 0; s < SEG; s++) { const a = s / SEG * Math.PI * 2, r = ringR[k], v = 1 + (k - 1) * SEG + s, x = Math.cos(a) * r, z = Math.sin(a) * r; P[v * 3] = x; P[v * 3 + 1] = r < 30 ? hgt(x, z) : hAt(x, z); P[v * 3 + 2] = z; }
  for (let s = 0; s < SEG; s++) idx.push(0, 1 + (s + 1) % SEG, 1 + s);
  for (let k = 1; k < ringR.length - 1; k++) for (let s = 0; s < SEG; s++) { const a = 1 + (k - 1) * SEG + s, b = 1 + (k - 1) * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG; idx.push(a, b, d, a, d, c); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(P, 3)); tg.setIndex(idx); tg.computeVertexNormals();
  const NR = tg.attributes.normal.array, cols = new Float32Array(NV * 3); tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  // how much sun each point gets: soft wrap light on the slope, times a soft shadow from any hill toward the sun
  const shadeOf = (x, y, z, nx, ny, nz) => { const lit = Math.max(0, (nx * S.x + ny * S.y + nz * S.z + .25) / 1.25);
    let occ = 0; const hz = Math.hypot(S.x, S.z), sx = S.x / hz, sz = S.z / hz, tanE = S.y / hz;
    for (let d = 2; d < 260; d *= 1.14) { const over = hAt(x + sx * d, z + sz * d) - (y + .3 + d * tanE); if (over > 0) occ = Math.max(occ, Math.min(1, over / (1.2 + d * .045))); if (occ >= 1) break; }
    return lit * (1 - occ); };
  const SH = new Float32Array(NV), NZ = new Float32Array(NV), NY = new Float32Array(NV);
  for (let v = 0; v < NV; v++) { const o = v * 3; SH[v] = shadeOf(P[o], P[o + 1], P[o + 2], NR[o], NR[o + 1], NR[o + 2]); NZ[v] = fbm(P[o] * .05, P[o + 2] * .05, 3); NY[v] = NR[o + 1]; }
  mk('shade-terrain');
  const tc = new THREE.Color(), grassCol = (out, sh, n, ny) => { const t = Math.min(1, sh * 1.15);
    if (t < .5) out.copy(cur.gs).lerp(cur.gm, t * 2); else out.copy(cur.gm).lerp(cur.gl, (t - .5) * 2);
    out.multiplyScalar(.86 + .28 * n).multiplyScalar(.82 + .18 * ny); return out; };
  const paintTerrain = () => { for (let v = 0; v < NV; v++) { grassCol(tc, SH[v], NZ[v], NY[v]); cols[v * 3] = tc.r; cols[v * 3 + 1] = tc.g; cols[v * 3 + 2] = tc.b; } tg.attributes.color.needsUpdate = true; };
  // a fine, soft stroke texture so close grass reads as grass, not plastic
  const strokes = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#f1f1f1'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = 222 + Math.random() * 33 | 0; x.strokeStyle = `rgba(${v},${v},${v},.5)`; x.lineWidth = .8 + Math.random() * 1.4; x.lineCap = 'round';
      const px = Math.random() * 256, py = Math.random() * 256, l = 5 + Math.random() * 9, a = -Math.PI / 2 + (Math.random() - .5) * .7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260, 260); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const terrainM = new THREE.MeshBasicMaterial({ vertexColors: true, map: strokes });
  terrainM.onBeforeCompile = sh => { sh.uniforms.uT = wind; sh.vertexShader = 'varying vec2 vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = WIND_GLSL.replace('varying float vG;\n', '') + 'varying vec2 vW;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.rgb *= 1.0 + gust(vW) * .07;'); };
  const terrain = new THREE.Mesh(tg, terrainM); scene.add(terrain);
  // the car's own shadow, live, on a clear catcher over the flat ground round the car
  const catcher = new THREE.Mesh(new THREE.CircleGeometry(K.flat, 64), new THREE.ShadowMaterial({ color: cur.shadow, opacity: .42, depthWrite: false }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = K.podium ? .004 : hgt(0, 0) + .004; catcher.receiveShadow = true; catcher.renderOrder = 1; scene.add(catcher);
  // the white podium (lock screen)
  let podM = null;
  if (K.podium) { podM = new THREE.MeshPhysicalMaterial({ color: cur.podium, roughness: .32, clearcoat: .6, clearcoatRoughness: .25 });
    const pg = new THREE.CylinderGeometry(K.podium, K.podium, .34, 160, 1); pg.translate(0, -.17, 0); const pd = new THREE.Mesh(pg, podM); pd.receiveShadow = true; pd.castShadow = true; scene.add(pd);
    const bev = new THREE.Mesh(new THREE.TorusGeometry(K.podium - .02, .03, 12, 160), podM); bev.rotation.x = Math.PI / 2; bev.position.y = -.03; scene.add(bev); }
  // grass blades: their colour comes from the lit ground under them; they sway in the shader, so it costs nothing on the CPU
  const rnd = rng(K.seed || 7), wind = { value: 0 };
  /* Wind: soft gusts roll across the field in long waves (like wind over a meadow in a film). The same field bends the
     grass, bobs the daisies and brightens the ground where a gust passes, all in the shader. */
  const WIND_GLSL = 'uniform float uT;\nvarying float vG;\nfloat gust(vec2 p) { float a = sin(dot(p, vec2(.38, .92)) * .23 - uT * 1.25) * .5 + .5; float b = sin(dot(p, vec2(-.6, .8)) * .11 - uT * .7 + 1.7) * .5 + .5; float g = a * (.55 + .45 * b); return g * g * (3. - 2. * g); }\n';
  const swayMat = (m, kind) => { m.onBeforeCompile = sh => { sh.uniforms.uT = wind;
    sh.vertexShader = WIND_GLSL + sh.vertexShader.replace('#include <project_vertex>', `
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  float g = gust(mvPosition.xz), hf = ${kind === 'flower' ? '1.0' : 'transformed.y'}, bh = ${kind === 'flower' ? '.5' : 'length(instanceMatrix[1].xyz)'};
  float flick = sin(uT * 3.1 + mvPosition.x * 1.7 + mvPosition.z * 1.3) * .5;
  mvPosition.xz += vec2(.38, .92) * (.12 + .55 * g + .08 * flick) * hf * hf * bh;
  mvPosition.y -= (.1 + .3 * g) * hf * hf * bh * .35;
  vG = g * hf;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = 'varying float vG;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.rgb *= 1.0 + vG * .16;'); }; return m; };
  const blades = [], flowers = [];
  K.grass.forEach(([cx, cz, rad, n, hmin, hmax, flw]) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(x) < 1.25 && Math.abs(z) < 2.85) continue; if (K.podium && Math.hypot(x, z) < K.podium + .05) continue;
      const edge = 1 - (r / rad) ** 2; blades.push({ x, z, y: hAt(x, z), h: (hmin + rnd() * (hmax - hmin)) * (.45 + .55 * edge), c: rnd() });
      if (flw && rnd() < flw * (.25 + .75 * edge)) flowers.push({ x: x + (rnd() - .5) * .3, z: z + (rnd() - .5) * .3, h: blades[blades.length - 1].h * (.75 + rnd() * .35), s: .045 + rnd() * .04 }); } });
  const bm = swayMat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'blade'), grass = new THREE.InstancedMesh(bladeGeo(.0075, 1), bm, blades.length), d = new THREE.Object3D();
  blades.forEach((b, i) => { d.position.set(b.x, b.y - .02, b.z); d.rotation.set((rnd() - .5) * .35, rnd() * 6.3, (rnd() - .5) * .25); d.scale.set(1, b.h, 1); d.updateMatrix(); grass.setMatrixAt(i, d.matrix); });
  grass.frustumCulled = false; scene.add(grass);
  const lightAt = (x, z) => { const y = hAt(x, z), e = .6, nx = hAt(x - e, z) - hAt(x + e, z), nz = hAt(x, z - e) - hAt(x, z + e), l = Math.hypot(nx, 2 * e, nz); return shadeOf(x, y, z, nx / l, 2 * e / l, nz / l); };
  mk('blades-placed');
  // light the blades from a 0.5 m light grid (worked out once) instead of one shadow test per blade: same look, far faster
  const LN = 125, LS = .5, LO = LN * LS / 2, LG = new Float32Array(LN * LN);
  for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) LG[j * LN + i] = lightAt(i * LS - LO, j * LS - LO);
  const lightG = (x, z) => { const fx = (x + LO) / LS, fz = (z + LO) / LS, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= LN - 1 || j >= LN - 1) return lightAt(x, z);
    const u = fx - i, v = fz - j, a = LG[j * LN + i], b = LG[j * LN + i + 1], c = LG[(j + 1) * LN + i], d = LG[(j + 1) * LN + i + 1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  blades.forEach(b => { b.sh = lightG(b.x, b.z); b.n = fbm(b.x * .05, b.z * .05, 3); });
  mk('blades-lit');
  const yel = C('#c9c35a'), blu = C('#2f6e5a'), dry = C('#c8b77e');
  const paintGrass = () => { blades.forEach((b, i) => { grassCol(tc, Math.min(1, b.sh + .08), b.n, 1).multiplyScalar(.85 + b.c * .35);
      const v2 = (b.c * 7.31) % 1; if (v2 < .18) tc.lerp(yel, .25 * L); else if (v2 > .8) tc.lerp(blu, .22); if (b.c > .975) tc.lerp(dry, .5 * L); grass.setColorAt(i, tc); }); grass.instanceColor.needsUpdate = true; };
  const hgtB = (x, z) => hAt(x, z);
  let daisies = null;
  if (flowers.length) { const fm = swayMat(new THREE.MeshBasicMaterial({ map: daisyTex(), alphaTest: .5, side: THREE.DoubleSide }), 'flower'), fg = new THREE.PlaneGeometry(1, 1); fg.rotateX(-Math.PI / 2);
    daisies = new THREE.InstancedMesh(fg, fm, flowers.length);
    flowers.forEach((f, i) => { d.position.set(f.x, hAt(f.x, f.z) + f.h, f.z); d.rotation.set((rnd() - .5) * .9, rnd() * 6.3, (rnd() - .5) * .9); d.scale.set(f.s, 1, f.s); d.updateMatrix(); daisies.setMatrixAt(i, d.matrix); f.sh = lightG(f.x, f.z); });
    daisies.frustumCulled = false; scene.add(daisies); }
  const paintFlowers = () => { if (!daisies) return; flowers.forEach((f, i) => { tc.copy(cur.daisyS).lerp(cur.daisy, Math.min(1, f.sh * 1.3)); daisies.setColorAt(i, tc); }); daisies.instanceColor.needsUpdate = true; };
  mk('flowers');
  // fluffy cumulus, film-style: each puff is shaded, bright on top and a soft lavender-grey underneath
  const pt = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.62, 'rgba(255,255,255,.96)'); g.addColorStop(.82, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.globalCompositeOperation = 'source-atop';
    const s2 = x.createLinearGradient(0, 18, 0, 118); s2.addColorStop(0, 'rgba(255,255,255,0)'); s2.addColorStop(.55, 'rgba(150,150,175,.12)'); s2.addColorStop(1, 'rgba(110,110,150,.5)'); x.fillStyle = s2; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const puffs = [], clouds = new THREE.Group(); scene.add(clouds);
  (K.clouds || []).forEach(([ang, dist, y, w]) => { const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist, tx = -Math.sin(ang), tz = Math.cos(ang);
    for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false, fog: false })), u = rnd() * 2 - 1, h = Math.pow(rnd(), .9) * (1 - u * u * .7);
      const sz = (9 + rnd() * 9) * w * (1.15 - h * .35); sp.scale.set(sz, sz * .92, 1);
      sp.position.set(cx + u * 24 * w * tx, y + h * 11 * w, cz + u * 24 * w * tz); sp.userData.h = h; sp.renderOrder = -10 + Math.round(h * 20); clouds.add(sp); puffs.push(sp); }
    for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false, fog: false })), u = rnd() * 2 - 1;   // flat base
      const sz = (12 + rnd() * 8) * w; sp.scale.set(sz * 1.8, sz * .5, 1); sp.position.set(cx + u * 26 * w * tx, y - 2 * w, cz + u * 26 * w * tz); sp.userData.h = 0; sp.renderOrder = -11; clouds.add(sp); puffs.push(sp); } });
  // sun glow in the sky, and a warm haze where the sun sits
  const glowSun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex([[0, 1], [.2, .55], [.55, .14], [1, 0]]), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glowSun.scale.set(260, 260, 1); glowSun.position.copy(S).multiplyScalar(380); glowSun.renderOrder = -12; scene.add(glowSun);
  // floating pollen by day, fireflies at dusk: soft specks drifting round the car
  const NP = 260, pp = new Float32Array(NP * 3), ps = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { const a = rnd() * 6.283, r = 2.5 + rnd() * 13; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = .2 + rnd() * 2.6; pp[i * 3 + 2] = Math.sin(a) * r; ps[i] = rnd() * 100; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(ps, 1));
  const pm = new THREE.PointsMaterial({ map: softTex([[0, 1], [.3, .6], [1, 0]], 64), size: .07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 });
  const pU = { value: 1 };
  pm.onBeforeCompile = sh => { sh.uniforms.uT = wind; sh.uniforms.uN = pU; sh.vertexShader = 'uniform float uT, uN;\nattribute float seed;\nvarying float vA;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n  transformed += vec3(sin(uT * .21 + seed) * 1.6 + uT * .12, sin(uT * .37 + seed * 1.7) * .45, cos(uT * .17 + seed * .7) * 1.4);\n  transformed.x = mod(transformed.x + 16., 32.) - 16.;\n  vA = .35 + .65 * (sin(uT * (1.2 + uN * 1.8) + seed * 3.) * .5 + .5);')
    .replace('gl_PointSize = size;', 'gl_PointSize = size * (1. + uN * 1.4);');
    sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\n  gl_FragColor.a *= vA;'); };
  const pollen = new THREE.Points(pg, pm); pollen.frustumCulled = false; scene.add(pollen);
  // butterflies near the car (by day)
  const wingT = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(30, 22, 26, 18, -.35, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(24, 46, 17, 13, .4, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, 8, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const BF = (K.butterflies || ['#c9b2f2', '#ffffff', '#fbe6a2', '#b7d6ff', '#f6c3dc']).map((col, i) => {
    const g = new THREE.Group(), wg = new THREE.PlaneGeometry(.16, .16); wg.translate(.08, 0, 0); wg.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: wingT, color: col, transparent: true, alphaTest: .3, side: THREE.DoubleSide });
    const L1 = new THREE.Mesh(wg, mat), R1 = new THREE.Mesh(wg, mat); R1.scale.x = -1; g.add(L1, R1); scene.add(g);
    return { g, L1, R1, ph: rnd() * 100, cx: (rnd() - .5) * 10, cz: (rnd() - .5) * 10, r: 2.4 + rnd() * 3, sp: .25 + rnd() * .2, prev: new THREE.Vector3() }; });
  // a few birds far off now and then
  const birdG = new THREE.BufferGeometry(); birdG.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 0, -.12, .25, 0, 0, 0, 0, 0, 0, 0, -.12, .25, 1, 0, 0], 3));
  const birdM = new THREE.MeshBasicMaterial({ color: '#4d4a5e', side: THREE.DoubleSide, transparent: true, opacity: .8 }), flock = new THREE.Group(); scene.add(flock);
  const birds = [0, 1, 2, 3, 4].map(i => { const m = new THREE.Mesh(birdG, birdM); m.position.set(-i * 2.2 + (i % 2) * .6, (i % 2) * 1.2 - i * .3, i * 1.4); m.scale.setScalar(.9); flock.add(m); return m; });
  const flight = { t0: -1e9, a: 0 };
  const paintClouds = () => puffs.forEach(p => { p.material.color.copy(cur.cloudB).lerp(cur.cloud, .35 + p.userData.h * .65); p.material.opacity = .9; });
  return {
    shadows: true,
    theme(dark) { tar = dark ? PAL.night : PAL.day; LT = dark ? 0 : 1; },
    update(dt, now) {
      let moving = lerpPal(cur, tar, Math.min(1, dt * 2.5));
      if (Math.abs(LT - L) > .002) { L += (LT - L) * Math.min(1, dt * 2.5); moving = true; } else L = LT;
      if (moving || !G.done) { G.done = true; paintGrad(G, cur.top, cur.mid, cur.bot, { x: K.glow[0], y: K.glow[1], r: K.glow[2], c: cur.glow, a: .35 + .3 * (1 - L) });
        scene.fog.color.copy(cur.fog); scene.fog.far = K.fogFar * (.6 + .4 * L); hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd); sun.color.copy(cur.sun); sun.intensity = .5 + 1.9 * L; hemi.intensity = .45 + .7 * L;
        catcher.material.color.copy(cur.shadow); if (podM) podM.color.copy(cur.podium);
        paintTerrain(); paintGrass(); paintFlowers(); paintClouds(); scene.environmentIntensity = .3 + .3 * L; }
      const t = now / 1000; wind.value = t; clouds.position.x = Math.sin(now / 90000) * 14; pU.value = 1 - L;
      pm.color.copy(cur.pollen); pm.opacity = .35 + .45 * (1 - L); glowSun.material.color.copy(cur.glow).multiplyScalar(.28 + .2 * (1 - L));
      BF.forEach(b => { const vis = L > .45; b.g.visible = vis; if (!vis) return; const q = t * b.sp + b.ph;
        b.g.position.set(b.cx + Math.cos(q) * b.r + Math.sin(q * 2.3) * .8, hgtB(b.cx, b.cz) + .5 + Math.sin(q * 1.7) * .35 + Math.sin(t * 6 + b.ph) * .05, b.cz + Math.sin(q * 1.3) * b.r);
        if (b.g.position.distanceToSquared(b.prev) > 1e-6) b.g.rotation.y = Math.atan2(b.g.position.x - b.prev.x, b.g.position.z - b.prev.z) + Math.PI / 2; b.prev.copy(b.g.position);
        const f = Math.sin(t * 17 + b.ph) * .95; b.L1.rotation.z = f; b.R1.rotation.z = -f; });
      if (t - flight.t0 > 34) { flight.t0 = t; flight.a = K.birdsAt + (rnd() - .5) * .8; }
      { const k = (t - flight.t0) / 26, vis = k < 1; flock.visible = vis; if (vis) { const d = 170, a = flight.a, x0 = Math.cos(a) * d, z0 = Math.sin(a) * d, tx = -Math.sin(a), tz = Math.cos(a);
          flock.position.set(x0 + tx * (k - .5) * 260, 26 + Math.sin(k * 3) * 3, z0 + tz * (k - .5) * 260); flock.rotation.y = Math.atan2(tx, tz) - Math.PI / 2;
          birds.forEach((m, i) => { m.scale.y = .9 * Math.sin(t * 7 + i * 1.3); }); birdM.color.copy(cur.bird); } }
      return true;
    },
  };
}
const bump = (x, z, cx, cz, r, h) => { const q = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r); return q >= 1 ? 0 : h * (1 - q) * (1 - q); };
/* Lock screen (reference 1): a white podium on a flat green, daisy-covered mounds around it, rounded hills behind, blue ridges far off */
const LOCK = (() => { const R = rng(11), H = [];
  for (let i = 0; i < 60; i++) { const a = R() * 6.283, d = 70 + R() * 260, r = 16 + R() * 14 + d * .12; H.push([Math.cos(a) * d, Math.sin(a) * d, r, d * (.03 + R() * .05)]); }
  [[-70, -66, 22, 6], [-22, -100, 24, 6.5], [-110, -14, 26, 7], [36, -110, 24, 4.5], [-150, -115, 34, 10], [80, -170, 36, 8]].forEach(h => H.push(h));
  const mounds = [[-6.5, -1.5, 4.8, 1.1], [-3.5, 6.8, 4.2, .8], [5.5, -6, 5.5, 1.2], [9, 3, 4, .6]];
  return {
    seed: 5, birdsAt: -2.3, podium: 3.6, flat: 20, fogNear: 25, fogFar: 430, sun: [-.79, .5, .2], glow: [.25, .62, .6],
    height: (x, z) => { const r = Math.hypot(x, z); let h = (fbm(x * .012, z * .012, 3) - .5) * 3 * smooth(12, 50, r) - .3;
      for (const [cx, cz, rr, hh] of H) h += bump(x, z, cx, cz, rr, hh) * smooth(20, 60, r);
      for (const [cx, cz, rr, hh] of mounds) h += bump(x, z, cx, cz, rr, hh);
      return h + smooth(300, 480, r) * 26 * fbm(Math.atan2(z, x) * 4, 1, 3); },
    grass: [[0, 0, 14, 40000, .09, .22, 0], [-6.5, -1.5, 4.6, 9000, .24, .46, .9], [-3.5, 6.8, 4, 7000, .22, .42, .9], [5.5, -6, 5.2, 9500, .24, .46, .9], [9, 3, 3.8, 5000, .2, .38, .8], [0, 0, 28, 20000, .12, .3, .03]],
    clouds: [[-2.05, 280, 40, 1.1], [-1.55, 310, 48, .9], [-2.75, 260, 32, .8], [-.9, 290, 44, .9], [.8, 300, 40, 1]],
    day:   { top: '#9db7df', mid: '#cbd6ee', bot: '#ecebf4', fog: '#d9dbee', glow: '#fff3e2', sky: '#dfe8ff', gnd: '#6b8f45', sun: '#fff4e0', shadow: '#24452c',
             gs: '#3b7656', gm: '#6daa3f', gl: '#b5dc62', daisy: '#ffffff', daisyS: '#d4dbe6', podium: '#f3f2f7', cloud: '#ffffff', cloudB: '#d3d1ea', pollen: '#fff3c4', bird: '#5a5870' },
    night: { top: '#1a1d4a', mid: '#5b4f8e', bot: '#e6a9ae', fog: '#7c6d9e', glow: '#ffb59a', sky: '#7d83c4', gnd: '#1e2a26', sun: '#ffb38c', shadow: '#0d1220',
             gs: '#152c35', gm: '#213b35', gl: '#4f5546', daisy: '#ece3fb', daisyS: '#8780b4', podium: '#cbc4e2', cloud: '#f6c6c6', cloudB: '#6b5f9a', pollen: '#ffd27a', bird: '#2b2840' },
  }; })();
/* Home (reference 2): long smooth rolling dunes of grass, a low sun throwing long shadows across the valleys, a pale sky */
const HOME = (() => { const R = rng(23), H = [];
  for (let i = 0; i < 70; i++) { const a = R() * 6.283, d = 80 + R() * 260, r = 30 + R() * 40 + d * .1; H.push([Math.cos(a) * d, Math.sin(a) * d, r, .6 + d * (.009 + R() * .022)]); }
  return {
    seed: 9, birdsAt: -1.05, flat: 20, fogNear: 30, fogFar: 480, sun: [.86, .19, -.36], glow: [.82, .62, .7],
    height: (x, z) => { const r = Math.hypot(x, z); let h = (Math.sin(x * .034 + 1) * Math.cos(z * .027) * 1.1 + (fbm(x * .011, z * .011, 3) - .5) * 2.8) * smooth(10, 45, r) - smooth(30, 110, r) * 3.2;
      for (const [cx, cz, rr, hh] of H) h += bump(x, z, cx, cz, rr, hh) * smooth(20, 60, r); return h; },
    grass: [[0, 0, 13, 52000, .08, .2, 0], [0, 0, 28, 26000, .11, .26, 0]],
    clouds: [[-1.25, 300, 34, 1.1], [-.55, 320, 40, .9], [-1.85, 290, 30, .8], [2.6, 300, 40, 1], [1.2, 280, 36, .8], [-2.6, 300, 42, 1]],
    day:   { top: '#a9bde6', mid: '#d9e2f1', bot: '#f2efe6', fog: '#dfdfee', glow: '#fff1d0', sky: '#e6efff', gnd: '#6f9a3e', sun: '#fff0d2', shadow: '#1f3d22',
             gs: '#3a7150', gm: '#72ad3a', gl: '#c0de63', cloud: '#ffffff', cloudB: '#d3d1ea', pollen: '#fff3c4', bird: '#5a5870' },
    night: { top: '#171b45', mid: '#4d4687', bot: '#d99aa6', fog: '#6e6394', glow: '#ffae8e', sky: '#757cbf', gnd: '#1a2622', sun: '#ffaa82', shadow: '#0b1020',
             gs: '#152c35', gm: '#223c35', gl: '#535546', cloud: '#f2bfc2', cloudB: '#615894', pollen: '#ffd27a', bird: '#26233a' },
  }; })();

/* no downloaded lighting any more: the car uses the soft built-in studio everywhere (Adi: no hard reflections) */
let ASSETS = {};
function loadAssets() { return Promise.resolve(ASSETS); }
export function ready() { return loadRaw(); }

/* ---------- Driving: one road through the same green film hills, in five moods ----------
   Comfort = soft afternoon, Eco = spring meadow with trees and flowers, Sport = golden sunset, Snow = snowy hills,
   Custom = lavender dusk. Dark mode turns each into its night. The hills, verge grass and flowers move in the shader
   (the whole world slides past the car), so it costs almost nothing per frame. */
const DRIVE = {   // sky top / middle / horizon, fog, grass shadow / mid / lit, road, flowers, sun, speed (m/s shown), trees, flower amount
  // Comfort: warm golden afternoon, honey light, long soft shadows
  Comfort: { top: '#ab97e0', mid: '#d6c6f1', bot: '#f4e9f8', fog: '#e6dbf3', gs: '#5d8a62', gm: '#8cbf63', gl: '#cfe596', road: '#6f6a7e', fl: '#ffffff', sun: '#fff2ec', glow: '#fff0f8', cloud: '#ffffff', cloudB: '#c9b8e6', v: 11, trees: .25, flowers: 1, field: 1, snow: 0, mist: 0, blossom: 0, sx: -.62, sy: .26 },
  // Eco: fresh spring morning, pale mint light, mist in the valleys, blossom trees
  Eco:     { top: '#c3ebd2', mid: '#e2f6e8', bot: '#f6fcf5', fog: '#e8f7ee', gs: '#5fa38f', gm: '#8fd07e', gl: '#d4f2b0', road: '#86828e', fl: '#ffffff', sun: '#ffffff', glow: '#f4fff8', cloud: '#ffffff', cloudB: '#d6eaf0', field: 0, v: 8, trees: 1, flowers: .8, snow: 0, mist: 1, blossom: 1, sx: .35, sy: .5 },
  Sport:   { top: '#5d5ea8', mid: '#e7a08e', bot: '#ffd29b', fog: '#efb59e', gs: '#5a6350', gm: '#86904c', gl: '#e0b862', road: '#564f60', fl: '#ffd9a0', sun: '#ffb070', glow: '#ffb27a', cloud: '#ffd2b4', cloudB: '#b77f9e', field: 0, v: 22, trees: .3, flowers: .08, snow: 0, mist: .25, blossom: 0, sx: -.85, sy: .12 },
  Snow:    { top: '#a6bde4', mid: '#dfe7f3', bot: '#f4f6fb', fog: '#e8edf6', gs: '#aebcda', gm: '#e1e8f4', gl: '#ffffff', road: '#8b90a1', fl: '#ffffff', sun: '#fff6ea', glow: '#ffffff', cloud: '#ffffff', cloudB: '#c9d2e6', field: 0, v: 6, trees: 1, flowers: 0, snow: 1, mist: .5, blossom: 0, sx: -.4, sy: .45 },
  Custom:  { top: '#5b58a4', mid: '#b49ad0', bot: '#f2c8d4', fog: '#c6aed2', gs: '#565c78', gm: '#738465', gl: '#c4ae78', road: '#5e5872', fl: '#a780e0', sun: '#ffc6a8', glow: '#ffb6c4', cloud: '#ffd7e2', cloudB: '#8f7ab8', field: 0, v: 11, trees: .35, flowers: 1, snow: 0, mist: .4, blossom: 0, sx: -.7, sy: .18 },
};
const DRIVE_GLSL = `
uniform float uOff, uT, uMount;
float hillH(vec2 p) {   // p = (x, z) in the moving world; the road runs along z at x = -1.6
  float far = smoothstep(10., 45., -p.x), farther = smoothstep(70., 260., -p.x);
  float h = sin(p.y * .021 + sin(p.y * .007) * 2.) * 3. + sin(p.y * .047 + 1.3) * 1.5 + sin(p.x * .031 + p.y * .013) * 2.4 + 3.2;
  float y = far * h * (1. + farther * 1.6) + smoothstep(5.8, 14., -p.x) * sin(p.y * .09) * .25;
  return mix(y, -.06, step(-5.75, p.x) * step(p.x, 2.45));   // tucked under the road
}`;
function driveScene(scene) {
  const P = Object.fromEntries(Object.entries(DRIVE).map(([k, o]) => [k, palOf(o)]));
  // night: each mood sinks into a deep blue dusk, keeping a little of its own colour on the horizon
  const NIGHT = C('#121433'), NG = C('#0f1c22');
  const NP = Object.fromEntries(Object.entries(P).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).map(([n, c]) => {
    if (!(c instanceof THREE.Color)) return [n, c];
    const t = { top: .86, mid: .78, bot: .62, fog: .72, gs: .8, gm: .8, gl: .76, road: .78, fl: .55, sun: .6, glow: .35, cloud: .7, cloudB: .8 }[n] ?? .7;
    return [n, mixS(c, n[0] === 'g' && n !== 'glow' ? NG : NIGHT, k === 'Snow' && n[0] === 'g' ? t * .8 : t)]; }))]));
  Object.assign(NP.Eco, palOf({ top: '#0d2338', mid: '#1f4a5e', bot: '#5f8f96', fog: '#3e6a74', gs: '#17353a', gm: '#24504a', gl: '#4f7d6e', glow: '#cfe9ff', cloud: '#a8c4d8', cloudB: '#2f4f66', sun: '#bcd9ff' }));
  Object.assign(NP.Comfort, palOf({ top: '#17153a', mid: '#3f3168', bot: '#a7799f', fog: '#5b4a75', glow: '#ffc0d8', sun: '#e8c4ff' }));
  Object.assign(NP.Eco, palOf({ top: '#0f2a2a', mid: '#244e46', bot: '#6c9a88' }));
  let dark = false, nf = 0;
  const cur = palOf(Object.fromEntries(Object.entries(P.Comfort).map(([k, v]) => [k, v instanceof THREE.Color ? v.clone() : v])));
  let mode = 'Comfort', v = P.Comfort.v, vT = v, off = 0, amt = { sport: 0, trees: P.Comfort.trees, flowers: P.Comfort.flowers, snow: 0, mist: 0, blossom: 0, field: 1, sx: P.Comfort.sx, sy: P.Comfort.sy };
  const G = gradCanvas(); scene.background = G.t; scene.fog = new THREE.Fog(cur.fog, 30, 330);
  const hemi = new THREE.HemisphereLight('#eef2ff', '#6f8a4a', 1.0); scene.add(hemi);
  const SUN = new THREE.Vector3(-.55, .5, -.65).normalize(), sun = sunLight('#fff0d2', SUN.clone().multiplyScalar(40).toArray(), 9); sun.shadow.radius = 6; scene.add(sun); scene.add(sun.target);
  const U = { uOff: { value: 0 }, uT: { value: 0 }, uGs: { value: cur.gs }, uGm: { value: cur.gm }, uGl: { value: cur.gl }, uFog: { value: cur.fog }, uFogN: { value: 30 }, uFogF: { value: 330 }, uSun: { value: SUN }, uFl: { value: cur.fl }, uFlA: { value: 0 }, uField: { value: 1 }, uDay: { value: 1 }, uMount: { value: 0 } };
  // hills: a big grid, fine near the road; height, light and colour all come from the shader
  const xs = []; for (let x = 30; x > -380; x -= x > -14 ? .8 : x > -60 ? 2.5 : 6) xs.push(x);
  const NZ = 240, zs = Array.from({ length: NZ + 1 }, (_, i) => -300 + i * 600 / NZ);
  const hp = new Float32Array(xs.length * zs.length * 3), hi = [];
  zs.forEach((z, j) => xs.forEach((x, i) => { const o = (j * xs.length + i) * 3; hp[o] = x; hp[o + 2] = z; }));
  for (let j = 0; j < NZ; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; hi.push(a, c, b, b, c, d); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setIndex(hi);
  const hillM = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, vertexShader: DRIVE_GLSL + `
    uniform vec3 uSun; varying float vS; varying float vD; varying vec2 vW; varying float vH;
    void main() { vec2 w = vec2(position.x, position.z + uOff); float h = hillH(w), e = .8; vH = h;
      vec3 n = normalize(vec3(hillH(w - vec2(e, 0.)) - hillH(w + vec2(e, 0.)), 2. * e, hillH(w - vec2(0., e)) - hillH(w + vec2(0., e))));
      vS = clamp((dot(n, uSun) + .25) / 1.25, 0., 1.); vW = w; vec4 mv = modelViewMatrix * vec4(position.x, h, position.z, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uGs, uGm, uGl, uFog; uniform float uFogN, uFogF, uT, uField, uDay, uMount; varying float vS; varying float vD; varying vec2 vW; varying float vH;
    float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() { float t = clamp(.18 + vS * 1.0, 0., 1.); vec3 c = t < .5 ? mix(uGs, uGm, t * 2.) : mix(uGm, uGl, (t - .5) * 2.);
      float n = sin(vW.x * .11 + sin(vW.y * .05) * 2.) * .5 + .5; c *= .9 + .16 * n;
      float g = sin(dot(vW, vec2(.38, .92)) * .23 - uT * 1.25) * .5 + .5; c *= 1. + g * g * .06;
      c *= .8 + .2 * smoothstep(7., 30., abs(vW.x + 1.6));
            if (uField > .01) {   // a flower field: dots of pink, white, lilac and butter yellow, melting into a soft pastel tint with distance
        vec2 cell = floor(vW * 3.2); float r = hsh(cell), r2 = hsh(cell + 17.3); vec2 f = fract(vW * 3.2) - .5;
        vec3 fc = r2 < .3 ? vec3(1., .72, .84) : r2 < .55 ? vec3(1.) : r2 < .8 ? vec3(.83, .72, 1.) : vec3(1., .93, .6);
        float dotA = smoothstep(.42, .2, length(f)) * step(.18, r);
        float near = 1. - smoothstep(30., 110., vD), band = .5 + .5 * sin(vW.y * .06 + vW.x * .09);
        vec3 tint = mix(vec3(.93, .8, .95), vec3(1., .9, .93), band);
        float dk = mix(.2, 1., uDay);
        c = mix(c, fc * (.75 + .3 * vS) * dk, dotA * near * .9 * uField * mix(.35, 1., uDay));
        c = mix(c, c * .4 + tint * .65 * (.75 + .35 * vS) * dk, (1. - near * .6) * .8 * uField * mix(.3, 1., uDay) * smoothstep(7., 16., -vW.x));
      }
      gl_FragColor = vec4(mix(c, uFog, smoothstep(uFogN, uFogF, vD)), 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
  const hills = new THREE.Mesh(hg, hillM); hills.frustumCulled = false; scene.add(hills);
  // road: soft asphalt with a dashed centre line and solid edges, scrolled to make the car drive
  const rc = document.createElement('canvas'); rc.width = 128; rc.height = 512; const rx = rc.getContext('2d');
  rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, 128, 512); for (let i = 0; i < 5000; i++) { const g = 120 + Math.random() * 70 | 0; rx.fillStyle = `rgba(${g},${g},${g},.25)`; rx.fillRect(Math.random() * 128, Math.random() * 512, 1.3, 1.3); }
  rx.fillStyle = '#f4f4f4'; rx.fillRect(62, 0, 5, 240); rx.fillRect(5, 0, 4, 512); rx.fillRect(119, 0, 4, 512);
  const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 20); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8;
  const roadM = new THREE.MeshStandardMaterial({ map: rt, color: cur.road, roughness: .78 }), road = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 400), roadM);
  road.rotation.x = -Math.PI / 2; road.position.set(-1.6, 0, 0); road.receiveShadow = true; scene.add(road);
  const kerbM = new THREE.MeshStandardMaterial({ color: '#cfcad8', roughness: .9 });
  [-5.5, 2.3].forEach(x => { const k = new THREE.Mesh(new THREE.BoxGeometry(.22, .06, 400), kerbM); k.position.set(x, .03, 0); k.receiveShadow = true; scene.add(k); });
  // Sport: soft red-and-white race kerbs along both edges
  const rumbleT = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f4f1f4'; x.fillRect(0, 0, 8, 64); x.fillStyle = '#e0465e'; x.fillRect(0, 0, 8, 32);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 100); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; return t; })();
  const rumbleM = new THREE.MeshStandardMaterial({ map: rumbleT, roughness: .6, transparent: true, opacity: 0 });
  [-5.3, 2.1].forEach(x => { const r = new THREE.Mesh(new THREE.PlaneGeometry(.55, 400), rumbleM); r.rotation.x = -Math.PI / 2; r.position.set(x, .065, 0); r.receiveShadow = true; scene.add(r); });
  // verge grass and flowers on both sides, moving with the world, swaying in the same gusts as Home
  const vergeMat = (flower) => { const m = flower ? new THREE.MeshBasicMaterial({ map: daisyTex(), alphaTest: .5, side: THREE.DoubleSide }) : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
      sh.vertexShader = DRIVE_GLSL + 'attribute vec2 rnd;\nvarying vec2 vR;\n' + sh.vertexShader.replace('#include <project_vertex>', `
  vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
  float per = instanceMatrix[3].x > 0. ? 26. : 80., zc = instanceMatrix[3].z;
  mvPosition.z += (mod(zc - uOff + per * .5, per) - per * .5) - zc;   // wrap whole blades, never split one across the seam
  mvPosition.y += hillH(vec2(mvPosition.x, mvPosition.z + uOff));
  float g = sin(dot(mvPosition.xz + vec2(0., uOff), vec2(.38, .92)) * .23 - uT * 1.25) * .5 + .5, hf = ${flower ? '1.' : 'transformed.y'}, bh = ${flower ? '.4' : 'length(instanceMatrix[1].xyz)'};
  mvPosition.z -= (.15 + .5 * g) * hf * hf * bh;
  vR = rnd;
  mvPosition = modelViewMatrix * mvPosition; gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = 'uniform vec3 uGs, uGm, uGl, uFl; uniform float uFlA, uField, uDay;\nvarying vec2 vR;\n' + sh.fragmentShader.replace('#include <color_fragment>', flower
        ? '#include <color_fragment>\n  if (vR.x > uFlA) discard; vec3 fcol = vR.y < .3 ? vec3(1., .66, .8) : vR.y < .55 ? vec3(1.) : vR.y < .8 ? vec3(.8, .66, 1.) : vec3(1., .9, .5); diffuseColor.rgb *= mix(uFl, fcol * mix(.25, 1., uDay), uField);'
        : '#include <color_fragment>\n  vec3 base = mix(uGm, uGl, vR.x); base = mix(base, uGs, vR.y * .55); diffuseColor.rgb *= base * 1.05;'); };
    return m; };
  const vergeSpots = (n, f) => { const out = []; for (let i = 0; i < n; i++) { const side = Math.random() < .55; const x = side ? 2.5 + Math.random() * 4.6 : -5.75 - Math.pow(Math.random(), 1.4) * 9; out.push([x, side ? -13 + Math.random() * 26 : -40 + Math.random() * 80]); } return out; };
  const d3 = new THREE.Object3D();
  const GBN = 45000, gGeo = bladeGeo(.008, 1), grassV = new THREE.InstancedMesh(gGeo, vergeMat(false), GBN), gr = new Float32Array(GBN * 2);
  vergeSpots(GBN).forEach(([x, z], i) => { d3.position.set(x, -.02, z); d3.rotation.set((Math.random() - .5) * .4, Math.random() * 6.3, (Math.random() - .5) * .3); d3.scale.set(1, (.06 + Math.random() * .14) * (x > 0 ? .8 : 1.3), 1); d3.updateMatrix(); grassV.setMatrixAt(i, d3.matrix); gr[i * 2] = Math.random(); gr[i * 2 + 1] = Math.random(); });
  gGeo.setAttribute('rnd', new THREE.InstancedBufferAttribute(gr, 2)); grassV.frustumCulled = false; scene.add(grassV);
  const FBN = 11000, fGeo = new THREE.PlaneGeometry(1, 1); fGeo.rotateX(-Math.PI / 2); const flowersV = new THREE.InstancedMesh(fGeo, vergeMat(true), FBN), fr = new Float32Array(FBN * 2);
  vergeSpots(FBN).forEach(([x, z], i) => { const s = .05 + Math.random() * .04; d3.position.set(x, .12 + Math.random() * .14, z); d3.rotation.set((Math.random() - .5) * .8, Math.random() * 6.3, (Math.random() - .5) * .8); d3.scale.set(s, 1, s); d3.updateMatrix(); flowersV.setMatrixAt(i, d3.matrix); fr[i * 2] = Math.random(); fr[i * 2 + 1] = Math.random(); });
  fGeo.setAttribute('rnd', new THREE.InstancedBufferAttribute(fr, 2)); flowersV.frustumCulled = false; scene.add(flowersV);
  // scenery that slides past and wraps around: round film-style trees, snowy pines with deer, street lamps
  const sets = {}, LZ = 160;
  const add = (kind, make, n, xr) => { const g = new THREE.Group(); g.userData = { items: [] }; scene.add(g); sets[kind] = g;
    for (let i = 0; i < n; i++) { const o = make(i); o.position.x = xr[0] + Math.random() * (xr[1] - xr[0]); o.position.z = -LZ / 2 + i / n * LZ + Math.random() * 3; o.userData.r = Math.random(); g.add(o); g.userData.items.push(o); } };
  const lamb = c => new THREE.MeshLambertMaterial({ color: c });
  const leafM = [lamb('#6fae4a'), lamb('#88c25a'), lamb('#5d9c45')], trunkM = lamb('#7a6150');
  add('trees', i => { const g = new THREE.Group(), s = .9 + Math.random() * .8; g.scale.setScalar(s);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, 1.8, 7), trunkM); t.position.y = .9; t.castShadow = true; g.add(t);
    for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.75 + (k % 3) * .22, 16, 12), leafM[(i + k) % 3]); b.position.set(Math.cos(k * 2.1) * .55, 2.2 + (k % 3) * .4, Math.sin(k * 2.1) * .55); b.castShadow = true; g.add(b); } return g; }, 34, [-70, -18]);
  const woolM = lamb('#f8f6f2'), faceM = lamb('#3a3340');
  add('sheep', i => { const g = new THREE.Group(), s = .8 + Math.random() * .3; g.scale.setScalar(s);
    for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.32 + (k % 3) * .06, 14, 10), woolM); b.position.set((k % 2 ? .14 : -.14) * (k % 3 ? 1 : .4), .72 + (k % 4) * .07, -.42 + k * .12); b.castShadow = true; g.add(b); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), faceM); head.scale.set(.85, 1, 1.25); head.position.set(0, .82, .62); g.add(head);
    [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), faceM); e.scale.set(1.6, .6, .8); e.position.set(sd * .16, .9, .58); g.add(e); });
    [[.15, .3], [-.15, .3], [.15, -.32], [-.15, -.32]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .5, 6), faceM); l.position.set(x, .25, z); g.add(l); });
    g.rotation.y = Math.random() * 6.28; return g; }, 24, [-34, -9]);
  const blM = [lamb('#f6b3cb'), lamb('#fde0ea'), lamb('#f19dbb')];
  add('blossom', i => { const g = new THREE.Group(), s = 1 + Math.random() * .9; g.scale.setScalar(s);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.11, .19, 1.7, 7), trunkM); t.position.y = .85; t.castShadow = true; g.add(t);
    for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.7 + (k % 3) * .2, 16, 12), blM[(i + k) % 3]); b.position.set(Math.cos(k * 1.9) * .6, 2.1 + (k % 3) * .38, Math.sin(k * 1.9) * .6); b.castShadow = true; g.add(b); } return g; }, 28, [-34, -9]);
  const ornM = ['#e0344b', '#ffc94d', '#6fa8ff', '#ffffff'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .9, roughness: .3 }));
  const starM = new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#ffd76a', emissiveIntensity: 1.6 }), deerM = lamb('#8a6a55'), antM = lamb('#d9cbb8');
  const deer = () => { const g = new THREE.Group(), b = (w, h, d, x, y, z, m = deerM) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); g.add(k); return k; };
    b(.28, .32, .95, 0, .78, 0); b(.14, .4, .14, 0, 1.08, .42).rotation.x = -.5; b(.16, .16, .3, 0, 1.3, .58);
    [[.09, .32], [-.09, .32], [.09, -.32], [-.09, -.32]].forEach(([x, z]) => b(.07, .62, .07, x, .31, z));
    [1, -1].forEach(sd => { b(.03, .3, .03, sd * .07, 1.5, .5, antM).rotation.z = -sd * .5; b(.03, .16, .03, sd * .14, 1.56, .54, antM).rotation.x = .6; }); g.rotation.y = Math.PI; return g; };
  const pineM = [lamb('#6f9488'), lamb('#7fa197')], snowCapM = lamb('#ffffff');
  add('pines', i => { if (i % 9 === 4) { const d = deer(); d.scale.setScalar(.9 + Math.random() * .25); return d; }
    const g = new THREE.Group(), s = 1 + Math.random() * 1.2; g.scale.setScalar(s);
    if (i % 4 === 1) { for (let k = 0; k < 9; k++) { const a = k * 2.3, y = .7 + (k % 3) * .62, r = (1.05 - (k % 3) * .3) * .82;
        const o = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), ornM[k % 4]); o.position.set(Math.cos(a) * r, y + .25, Math.sin(a) * r); g.add(o); }
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(.16), starM); st.position.y = 3.05; g.add(st); }
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .8, 6), trunkM); t.position.y = .4; g.add(t);
    [0, 1, 2].forEach(k => { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - k * .3, 1.3, 12), k === 2 ? snowCapM : pineM[k % 2]); c.position.y = 1.1 + k * .75; c.castShadow = true; g.add(c); }); return g; }, 30, [-34, -9]);
  // street lamps on the far verge; at night the bulbs glow and throw warm pools on the road
  const lampHaloM = new THREE.SpriteMaterial({ map: softTex([[0, .55], [.3, .2], [.7, .04], [1, 0]], 128), color: '#ffd9a6', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const lampPoolM = new THREE.MeshBasicMaterial({ map: softTex([[0, 1], [.5, .5], [1, 0]]), color: '#ffcf8f', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bulbM = new THREE.MeshStandardMaterial({ color: '#ffe9c9', emissive: '#ffe9c9', emissiveIntensity: 1 }), poleM = new THREE.MeshStandardMaterial({ color: '#8d84a3', roughness: .6 });
  add('lamps', () => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 3.4, 8), poleM); p.position.y = 1.7; g.add(p);
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.5, .07, .07), poleM); a.position.set(.72, 3.35, 0); g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .2), bulbM); b.position.set(1.42, 3.28, 0); g.add(b);
    const h = new THREE.Sprite(lampHaloM); h.position.set(1.42, 3.15, 0); h.scale.set(3.2, 3.2, 1); g.add(h);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), lampPoolM); pl.rotation.x = -Math.PI / 2; pl.position.set(2.6, .012, 0); g.add(pl); return g; }, 8, [-6.3, -6.2]);
  const sleigh = new THREE.Group(); sleigh.position.set(-40, 9, -40); scene.add(sleigh);
  { const red = new THREE.MeshStandardMaterial({ color: '#c8263c', roughness: .5 }), gold = new THREE.MeshStandardMaterial({ color: '#e8b64a', metalness: .6, roughness: .3 });
    const sb = new THREE.Mesh(new THREE.BoxGeometry(.7, .45, 1.2), red); sleigh.add(sb); const rn = new THREE.Mesh(new THREE.BoxGeometry(.75, .05, 1.5), gold); rn.position.y = -.3; sleigh.add(rn);
    const sa = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), red); sa.position.set(0, .45, -.1); sleigh.add(sa);
    for (let k = 0; k < 4; k++) { const d = deer(); d.scale.setScalar(.55); d.rotation.y = 0; d.position.set((k % 2 ? .22 : -.22), -.35, 1.3 + Math.floor(k / 2) * 1.0); sleigh.add(d); } }
  // fluffy clouds and the sun's glow
  const ct = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.62, 'rgba(255,255,255,.96)'); g.addColorStop(.82, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.globalCompositeOperation = 'source-atop';
    const s2 = x.createLinearGradient(0, 18, 0, 118); s2.addColorStop(0, 'rgba(255,255,255,0)'); s2.addColorStop(.55, 'rgba(150,150,175,.12)'); s2.addColorStop(1, 'rgba(110,110,150,.45)'); x.fillStyle = s2; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const puffs = [], clouds = new THREE.Group(); scene.add(clouds);
  [[-60, 300, 46, 1.1], [-160, 330, 52, .9], [40, 310, 40, 1], [140, 300, 50, .8]].forEach(([cz, dx, y, w]) => {
    for (let i = 0; i < 24; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false })), u = Math.random() * 2 - 1, h = Math.pow(Math.random(), .9) * (1 - u * u * .7);
      const sz = (10 + Math.random() * 10) * w * (1.15 - h * .35); sp.scale.set(sz, sz * .9, 1); sp.position.set(-dx, y + h * 12 * w, cz + u * 26 * w); sp.userData.h = h; sp.renderOrder = -10; clouds.add(sp); puffs.push(sp); } });
  const glowSun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex([[0, 1], [.2, .55], [.55, .14], [1, 0]]), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glowSun.position.set(-330, 30, -150); glowSun.scale.set(300, 300, 1); glowSun.renderOrder = -12; scene.add(glowSun);
  // Sport: a soft, hazy mountain range far behind the hills, with snowy tops
  const mN = 440, mpos = [], mcol = [], midx = [], mtop = new THREE.Color('#e9e3f1'), mmid = new THREE.Color('#b8b0d4'), mbot = new THREE.Color('#e3d3e2');
  for (let i = 0; i <= mN; i++) { const z = -900 + i * 1800 / mN, r = Math.abs(Math.sin(z * .006 + 1.3) + .6 * Math.sin(z * .015 + .4) + .3 * Math.sin(z * .041)), h = 22 + 38 * Math.pow(r * .55, 1.3);
    mpos.push(-420, -10, z, -420, h, z); const snow = smooth(45, 62, h) * .6; mcol.push(mbot.r, mbot.g, mbot.b); const tc2 = mmid.clone().lerp(mtop, snow); mcol.push(tc2.r, tc2.g, tc2.b);
    if (i < mN) { const a = i * 2; midx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const mg2 = new THREE.BufferGeometry(); mg2.setAttribute('position', new THREE.Float32BufferAttribute(mpos, 3)); mg2.setAttribute('color', new THREE.Float32BufferAttribute(mcol, 3)); mg2.setIndex(midx);
  const mountM = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false, side: THREE.DoubleSide });
  const mount = new THREE.Mesh(mg2, mountM); mount.renderOrder = -9; mount.frustumCulled = false; scene.add(mount);
  // Sport: soft streaks of light rushing past, like a long-exposure photo of a race track
  const streakT = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 16; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 16);
    x.globalCompositeOperation = 'destination-in'; const v2 = x.createLinearGradient(0, 0, 0, 16); v2.addColorStop(0, 'rgba(0,0,0,0)'); v2.addColorStop(.5, 'rgba(0,0,0,1)'); v2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v2; x.fillRect(0, 0, 256, 16);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const streakM = [new THREE.MeshBasicMaterial({ map: streakT, color: '#ff5a72', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    new THREE.MeshBasicMaterial({ map: streakT, color: '#fff1dc', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })];
  const streaks = Array.from({ length: 16 }, (_, i) => { const L = 6 + Math.random() * 10, m = new THREE.Mesh(new THREE.PlaneGeometry(L, .05 + Math.random() * .06), streakM[i % 2]);
    m.rotation.y = Math.PI / 2; m.position.set(-5.4 - Math.random() * 4, .25 + Math.random() * 1.3, (Math.random() - .5) * 60); m.userData.sp = .6 + Math.random() * .7; scene.add(m); return m; });
  // morning mist lying in the valleys (Eco), a hint of haze in the other moods
  const mistT = softTex([[0, .9], [.45, .5], [1, 0]], 128), mistM = new THREE.SpriteMaterial({ map: mistT, transparent: true, opacity: 0, depthWrite: false, fog: false });
  for (let i = 0; i < 34; i++) { const m = new THREE.Sprite(mistM), x = -14 - Math.pow(Math.random(), 1.5) * 150, z = (Math.random() - .5) * 300; m.position.set(x, .6 + Math.random() * 1.6 + (-x) * .012, z); const w = 26 + Math.random() * 50; m.scale.set(w, w * .14, 1); m.renderOrder = -5; scene.add(m); }
  // light in the air: drifting motes by day, fireflies at night
  const NMo = 220, mp = new Float32Array(NMo * 3), ms = new Float32Array(NMo);
  for (let i = 0; i < NMo; i++) { mp[i * 3] = -14 + Math.random() * 18; mp[i * 3 + 1] = .2 + Math.random() * 3; mp[i * 3 + 2] = (Math.random() - .5) * 40; ms[i] = Math.random() * 100; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('seed', new THREE.BufferAttribute(ms, 1));
  const motesU = { value: 0 }, mm = new THREE.PointsMaterial({ map: softTex([[0, 1], [.3, .6], [1, 0]], 64), size: .07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .4 });
  mm.onBeforeCompile = sh => { sh.uniforms.uT = U.uT; sh.uniforms.uOff = U.uOff; sh.uniforms.uN = motesU;
    sh.vertexShader = 'uniform float uT, uOff, uN;\nattribute float seed;\nvarying float vA;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  transformed += vec3(sin(uT * .3 + seed) * .8, sin(uT * .4 + seed * 1.7) * .3, 0.);\n  transformed.z = mod(transformed.z - uOff * .9 + 20., 40.) - 20.;\n  vA = .35 + .65 * (sin(uT * (1.1 + uN * 1.8) + seed * 3.) * .5 + .5);')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * (1. + uN * 1.3);');
    sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\n  gl_FragColor.a *= vA;'); };
  const motes = new THREE.Points(mg, mm); motes.frustumCulled = false; scene.add(motes);
  const moonM = new THREE.SpriteMaterial({ map: softTex([[0, 1], [.16, 1], [.2, .35], [.5, .08], [1, 0]], 128), color: '#eef6ff', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const moon = new THREE.Sprite(moonM); moon.position.set(-320, 70, 60); moon.scale.set(90, 90, 1); moon.renderOrder = -11; scene.add(moon);
  // falling snow
  const SN = 900, sg = new THREE.BufferGeometry(), sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = -18 + Math.random() * 24; sp[i * 3 + 1] = Math.random() * 7; sp[i * 3 + 2] = (Math.random() - .5) * 30; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ map: softTex([[0, 1], [.4, .7], [1, 0]], 32), color: '#ffffff', size: .08, transparent: true, opacity: 0, depthWrite: false })); scene.add(snow);
  return {
    shadows: true,
    mode(m) { if (!P[m]) return; mode = m; vT = P[m].v; },
    night: () => nf,
    sport: () => amt.sport,
    theme(d) { dark = d; },
    speed: () => v,
    update(dt, now) {
      const tar = (dark ? NP : P)[mode], k = Math.min(1, dt * 2.2), t = now / 1000;
      if (lerpPal(cur, tar, k) || !G.done) { G.done = true; paintGrad(G, cur.top, cur.mid, cur.bot, { x: .3, y: .62, r: .6, c: cur.glow, a: .4 }); }
      nf += ((dark ? 1 : 0) - nf) * k; const day = 1 - nf;
      ['trees', 'flowers', 'snow', 'mist', 'blossom', 'field', 'sx', 'sy'].forEach(n => { amt[n] += (P[mode][n] - amt[n]) * k; }); amt.sport += ((mode === 'Sport' ? 1 : 0) - amt.sport) * k;
      rumbleM.opacity = amt.sport; streakM[0].opacity = amt.sport * (.35 + .4 * nf); streakM[1].opacity = amt.sport * (.25 + .35 * nf); mountM.opacity = amt.sport * .6; mountM.color.setScalar(.45 + .55 * day);
      if (amt.sport > .01) streaks.forEach(m => { m.position.z -= v * m.userData.sp * dt * 1.6; if (m.position.z < -32) m.position.z += 64; }); rumbleT.offset.y = -(off / 400 * 100) % 1; rumbleM.color.setScalar(.35 + .65 * day);
      SUN.set(amt.sx, amt.sy, -.6).normalize(); sun.position.copy(SUN).multiplyScalar(40);
      mistM.opacity = amt.mist * (.8 - .3 * nf); mistM.color.copy(cur.fog).lerp(cur.cloud, .4);
      motes.material.opacity = (.35 + .35 * nf) * (mode === 'Snow' ? 0 : 1); motes.material.color.copy(nf > .5 ? C('#ffd27a') : cur.glow); motesU.value = nf;
      scene.fog.color.copy(cur.fog); U.uFogN.value = 20; U.uFogF.value = 280 - nf * 100; scene.fog.near = 20; scene.fog.far = U.uFogF.value;
      hemi.intensity = .35 + .65 * day; hemi.groundColor.copy(cur.gm); sun.color.copy(cur.sun); sun.intensity = .25 + 1.9 * day; scene.environmentIntensity = .25 + .5 * day;
      roadM.color.copy(cur.road); kerbM.color.setScalar(.35 + .5 * day);
      U.uFlA.value = amt.flowers * (mode === 'Snow' ? 0 : 1); U.uField.value = amt.field; U.uDay.value = day; U.uMount.value = amt.sport; U.uT.value = t;
      puffs.forEach(p => p.material.color.copy(cur.cloudB).lerp(cur.cloud, .35 + p.userData.h * .65)); glowSun.material.color.copy(cur.glow).multiplyScalar((.32 + .2 * (mode === 'Sport' || mode === 'Comfort' ? 1 : 0)) * (1 - nf * .6)); glowSun.position.set(-330, 18 + amt.sy * 80, -150 - amt.sx * 120);
      blM.forEach((m, i) => m.color.set(['#f6b3cb', '#fde0ea', '#f19dbb'][i]).lerp(C('#9fb8d8'), nf * .35).multiplyScalar(.5 + .5 * day));
      leafM.forEach((m, i) => m.color.set(['#6fae4a', '#88c25a', '#5d9c45'][i]).lerp(cur.gl, .18).lerp(C(['#f6b3cb', '#a9d77e', '#fdd6e3'][i]), amt.blossom * (i === 1 ? .5 : .95)).multiplyScalar(.3 + .7 * day));
      v += (vT - v) * k; off += v * dt; U.uOff.value = off;
      rt.offset.y = -(off / 400 * 20) % 1;
      snow.material.opacity = amt.snow * .9;
      { const tt = t % 26; sleigh.visible = mode === 'Snow' && tt < 11; sleigh.position.z = -50 + tt * 9; sleigh.position.y = 9 + Math.sin(tt * 2.2) * .3; }
      if (snow.material.opacity > .01) { for (let i = 0; i < SN; i++) { sp[i * 3 + 1] -= dt * 1.1; sp[i * 3 + 2] -= dt * v * .85; if (sp[i * 3 + 1] < 0) sp[i * 3 + 1] += 7; if (sp[i * 3 + 2] < -15) sp[i * 3 + 2] += 30; } sg.attributes.position.needsUpdate = true; }
      moonM.opacity = nf * amt.mist * .95; lampHaloM.opacity = nf * .6; lampPoolM.opacity = nf * .5; bulbM.emissiveIntensity = .3 + nf * 1.2;
      const show = { trees: mode !== 'Snow' && mode !== 'Eco', blossom: mode === 'Eco', pines: mode === 'Snow', lamps: mode !== 'Eco', sheep: mode === 'Comfort' };
      woolM.color.set('#f8f6f2').multiplyScalar(.35 + .65 * day);
      Object.entries(sets).forEach(([kind, g]) => { g.visible = show[kind]; if (!g.visible) return;
        g.userData.items.forEach(o => { o.position.z -= v * dt; if (o.position.z < -LZ / 2) o.position.z += LZ;
          if (kind === 'trees') o.visible = o.userData.r < amt.trees;
          o.position.y = kind === 'lamps' ? 0 : Math.max(0, hillHJS(o.position.x, o.position.z + off)); }); });
      return true;
    },
  };
}
// the same hill height as the shader, for placing trees on the slopes
function hillHJS(x, z) { const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const far = sm(10, 45, -x), farther = sm(70, 260, -x);
  const h = Math.sin(z * .021 + Math.sin(z * .007) * 2) * 3 + Math.sin(z * .047 + 1.3) * 1.5 + Math.sin(x * .031 + z * .013) * 2.4 + 3.2;
  return far * h * (1 + farther * 1.6) + sm(5.8, 14, -x) * Math.sin(z * .09) * .25; }

/* ---------- viewers ---------- */
const VIEWS = {   // camera position, target, field of view
  qc:   { p: [0, 16.2, -.001], t: [0, 0, .2], fov: 23.5, up: [0, 0, 1] },   // straight down, nose up (locked)
  qcwinL: { p: [4.7, 2.9, -6.4], t: [0, .7, -.35], fov: 36, up: [0, 1, 0] },   // left windows: seen from the left rear
  qcwinR: { p: [-4.7, 2.9, -6.4], t: [0, .7, -.35], fov: 36, up: [0, 1, 0] },  // right windows: seen from the right rear  // while the Windows menu is open: three-quarter rear view, so the glass is seen going down
  ty:   { p: [0, 15.5, -.001], t: [0, 0, -.05], fov: 26, up: [0, 0, 1] },   // straight down, nose up
  side: { p: [7.4, 1.05, .1], t: [-.4, .72, .1], fov: 27, ls: 2.4 },        // driver's side, whole car (ride height shown 2.4× so it reads)
  home: { p: [-4.9, 1.85, 8.6], t: [0, .72, 0], fov: 32, shift: [.17, .07] },   // front three-quarter; orbits the car itself, drawn right of centre (clear of the Next card)
  chg:  { p: [0, 16.2, -.001], t: [.5, 0, .2], fov: 25, up: [0, 0, 1] },   // Charging: the same top view as Quick controls              // Charging: rear three-quarter from the left, so the port and cable are in view
  lock: { p: [7.3, 2.2, 7.7], t: [0, 1.45, .2], fov: 28 },                   // car in the lower half, under the clock
};
const viewers = new Set();
let loopOn = false;
function loop() {
  loopOn = true; let busy = false; const now = performance.now();
  viewers.forEach(v => { if (v.tick(now)) busy = true; });
  if (busy) requestAnimationFrame(loop); else loopOn = false;
}
const kick = () => { if (!loopOn) requestAnimationFrame(loop); };

/* One WebGL renderer for every view. Phones and tablets allow only a few WebGL contexts per page; past that the oldest
   are dropped. So each view keeps a plain 2D canvas and the shared renderer draws into it, one view at a time. */
const PR = Math.min(2, window.devicePixelRatio || 1);
let R = null, RW = 0, RH = 0, ENV = null;
function shared() {
  if (R) return R;
  R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true });
  R.setPixelRatio(PR); R.localClippingEnabled = true; R.autoClear = false;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  ENV = window.ET9_ZEBRA ? zebraEnv(R) : studioEnv(R);
  M.paint.envMap = M.paintD.envMap = ENV;   // the paint always sees the full sky, however dim a scene keeps its own lighting
  return R;
}
/* a photo-studio light set baked into the reflection map: soft gradient dome, long overhead soft boxes and side strips.
   These are what draw the clean highlight lines along the paint and glass. */
function zebraEnv(r) {   // debug only: parallel light bands, the way designers check a surface is fair
  const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ color: '#222', side: THREE.BackSide })));
  for (let i = -12; i <= 12; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 140, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) })); m.rotation.z = Math.PI / 2; m.position.set(0, i * 4.2, -40); s.add(m.clone()); m.position.z = 40; s.add(m); }
  return new THREE.PMREMGenerator(r).fromScene(s, 0).texture;
}
function studioEnv(r) {
  // outdoor light like a salt flat: deep-to-pale blue sky, a bright horizon, light ground just below it, a hot sun
  const s = new THREE.Scene(), dome = new THREE.SphereGeometry(60, 96, 48), col = [], p = dome.attributes.position, c = new THREE.Color();
  const zen = new THREE.Color('#6f97d6'), sky = new THREE.Color('#cfe0f4'), hor = new THREE.Color('#ffffff'), gnd = new THREE.Color('#77747f'), far = new THREE.Color('#c4c2cb'), deep = new THREE.Color('#3b3942');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 60;
    if (y >= 0) { c.copy(hor).lerp(sky, Math.min(1, y * 7)); if (y > .15) c.lerp(zen, Math.pow((y - .15) / .85, .8)); }
    else { c.copy(far).lerp(gnd, Math.min(1, -y * 4)); const b = Math.exp(-Math.pow((-y - .04) / .02, 2)); c.lerp(deep, b * .9); if (y < -.3) c.lerp(deep, (-y - .3) / .7); }   // a dark band just under the horizon draws the crisp shoulder line
    c.multiplyScalar(1.25); col.push(c.r, c.g, c.b); }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 38, 34) })); sunM.position.set(-26, 38, 28); s.add(sunM);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 2), transparent: true, opacity: .5 })); glow.position.copy(sunM.position); s.add(glow);
  return new THREE.PMREMGenerator(r).fromScene(s, .006, .1, 100, { size: 1024 }).texture;   // sharper reflection map
}
function _unused() {
  return R;
}
const PAINT_MATS = new Set();
function drawTo(ctx, scene, cam, w, h, clear = true) {
  { const k = Math.min(1.2, (scene.environmentIntensity ?? 1) / .5) * PAINTS[paintKey].e; M.paint.envMapIntensity = M.paintD.envMapIntensity = k; PAINT_MATS.forEach(m => { m.envMapIntensity = k; }); }   // the paint's sky follows each scene's light (dim at night)
  const r = shared(), pw = Math.round(w * PR), ph = Math.round(h * PR);
  if (pw > RW || ph > RH) { RW = Math.max(RW, pw); RH = Math.max(RH, ph); r.setSize(RW / PR, RH / PR, false); }
  r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
  if (ctx.canvas.width !== pw || ctx.canvas.height !== ph) { ctx.canvas.width = pw; ctx.canvas.height = ph; }
  if (clear) ctx.clearRect(0, 0, pw, ph); ctx.drawImage(r.domElement, 0, RH - ph, pw, ph, 0, 0, pw, ph);
}

let queue = Promise.resolve();
const mc = new MessageChannel(), waiting = []; mc.port1.onmessage = () => { const f = waiting.shift(); if (f) f(); };
const yieldNow = () => new Promise(r => { waiting.push(r); mc.port2.postMessage(0); });   // lets the page draw; unlike setTimeout it isn't slowed down in background tabs
const turn = () => (queue = queue.then(yieldNow));
/* the lock screen and Home are built first, on their own; Quick controls, Tyres and Driving start only after them, so you can unlock sooner */
let primeDone, primeN = 0; const primeP = new Promise(r => { primeDone = r; setTimeout(r, 9000); });
export async function mount(el, opt = {}) {
  if (opt.view !== 'lock' && opt.view !== 'home') await primeP;
  const tM = performance.now(); (window.__et9t = window.__et9t || []).push(['mount:' + opt.view + ':start', Math.round(tM)]);
  const cv = document.createElement('canvas'); cv.className = 'c3d'; el.appendChild(cv); const ctx = cv.getContext('2d');
  shared();
  const scene = new THREE.Scene();
  scene.environment = ENV;
  const key = new THREE.DirectionalLight('#ffffff', .9); key.position.set(3, 8, 4); scene.add(key);
  const V = VIEWS[opt.view || 'qc'], cam = new THREE.PerspectiveCamera(V.fov, 1, .1, 200); if (V.up) cam.up.set(...V.up);
  const LS = V.ls || 1.6;
  const tgt = new THREE.Vector3(...V.t), home = new THREE.Vector3(...V.p).sub(tgt);
  const sph = new THREE.Spherical().setFromVector3(home), sph0 = sph.clone();
  await loadAssets(); scene.environment = ENV;
  await turn();   // views are built one at a time, letting the page draw in between
  const { car, body, P } = await buildCar(); scene.add(car);
  await turn();
  const world = opt.scene === 'arches' ? hillsScene(scene, HOME) : opt.scene === 'meadow' ? hillsScene(scene, LOCK) : opt.scene === 'drive' ? driveScene(scene) : null;
  if (opt.scene === 'arches' || opt.scene === 'meadow' || opt.scene === 'drive') { cam.far = 900; cam.updateProjectionMatrix(); }
  if (world) { scene.environmentIntensity = .9; }
  // state, animated values
  const S = { chg: 0, plug: 0, lvl: .78, door: { dfl: 0, dfr: 0, drl: 0, drr: 0 }, frunk: 0, boot: 0, port: 0, win: { fl: 0, fr: 0, rl: 0, rr: 0 }, mir: 0, shade: { l: 0, r: 0 }, lift: 0, head: .55, tail: .5, beam: 0, haz: 0, warn: {} };
  const LIN = { plug: 1.4, door: 1.3, frunk: 1.5, boot: 1.7, port: .8, mir: 1 };   // seconds for a full open or close, the same both ways
  const IO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const T = JSON.parse(JSON.stringify(S));
  const doorPaint = {}, dbl = new Map();
  Object.keys(P.doors).forEach(k => { doorPaint[k] = M.paint.clone(); doorPaint[k].side = THREE.DoubleSide;
    P.doors[k].traverse(o => { if (!o.isMesh) return; if (o.material === M.paint) o.material = doorPaint[k];
      else if (o.material.side !== THREE.DoubleSide) { if (!dbl.has(o.material)) { const m = o.material.clone(); m.side = THREE.DoubleSide; dbl.set(o.material, m); } o.material = dbl.get(o.material); } }); });
  [P.frunk, P.boot].forEach(g => g.traverse(o => { if (o.isMesh && o.material === M.paint) o.material = M.paintD; }));
  const tyreMats = {}; Object.entries(P.wheels).forEach(([k, w]) => w.spin.traverse(o => { if (o.isMesh && /tire/i.test(o.material.name || '')) { const m = tyreMats[k] || (tyreMats[k] = o.material.clone()); o.material = m; } }));
  let va = null, vname = opt.view || 'qc';
  let spin = !!opt.spin, wheelA = 0, last = performance.now(), dirty = true, W = 0, H = 0, t0 = performance.now();
  const step = (cur, tar, dt, rate) => { const d = tar - cur; return Math.abs(d) < .0005 ? tar : cur + d * Math.min(1, dt * rate); };
  function apply(now) {
    const D = { dfl: -1, drl: -1, dfr: 1, drr: 1 };
    Object.keys(P.doors).forEach(k => { P.doors[k].rotation.y = D[k] * IO(S.door[k]) * 1.0;
      doorPaint[k].copy(M.paint); PAINT_MATS.add(doorPaint[k]); doorPaint[k].side = THREE.DoubleSide; doorPaint[k].emissive.set('#d23a48'); doorPaint[k].emissiveIntensity = S.door[k] * .13; });
    const PW = { dfl: 'fl', dfr: 'fr', drl: 'rl', drr: 'rr' };
    Object.entries(P.panes).forEach(([k, p]) => { const d = S.win[PW[k]] * .4; p.position.y = -d; p.position.x = (k[2] === 'l' ? 1 : -1) * d * (k[1] === 'f' ? .12 : .3); });   // the glass leans in at the top, so it moves out a little as it drops
    P.frunk.rotation.x = -IO(S.frunk) * .9;
    P.boot.rotation.x = IO(S.boot) * 1.1;
    P.port.rotation.y = IO(S.port) * 1.75; P.port.visible = S.port > .01; P.portGlow.material.opacity = S.port * .7; P.portHalo.material.opacity = S.port * (.75 + .2 * Math.sin(now / 420));
    { const tr = S.chg > .01; P.cabinMats.forEach(m => { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = 1 - S.chg; m.depthWrite = !tr; }); P.cabin.visible = S.chg < .98; }
    P.chg.visible = S.plug > .005 || S.chg > .005;
    if (P.chg.visible) { const k = IO(S.plug), ix = P.chgCable.geometry.index.count; P.chgCable.geometry.setDrawRange(0, Math.max(6, Math.floor(k * ix / 6) * 6));   // the cable glides in from behind and plugs into the port
      const pt = P.chgPath.getPointAt(Math.max(.001, k)), tg = P.chgPath.getTangentAt(Math.max(.001, k)); P.chgPlug.position.copy(pt).addScaledVector(tg, .04); P.chgPlug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tg);
      P.chgRing.visible = S.plug > .98; } if (P.chg.visible) { P.chgU.uA.value = S.chg; P.chgU.uT.value = now / 1000; P.chgU.uL.value = S.lvl; P.chgRing.material.color.setRGB(.35, .9 + .05 * Math.sin(now / 300), .6); }
    P.mirrors.l.rotation.y = IO(S.mir) * 1.02; P.mirrors.r.rotation.y = -IO(S.mir) * 1.02;
    ['l', 'r'].forEach(s => { const sh = P.shades[s], e = -S.shade[s] * 1.6, pr = sh.userData.prof;   // rolls back towards the rear, the roller travelling with the edge
      let y = 0; if (pr) { for (let i = 1; i < pr.length; i++) if (pr[i][0] <= e) { const [z0, y0] = pr[i - 1], [z1, y1] = pr[i]; y = y0 + (y1 - y0) * (e - z0) / (z1 - z0 || 1); break; } }
      const pl = sh.material.clippingPlanes[0]; pl.set(new THREE.Vector3(0, 0, -1), sh.position.z + e); pl.applyMatrix4(body.matrixWorld);
      const r = sh.userData.roll; r.position.set(sh.position.x, sh.position.y + y - .02, sh.position.z + e); r.scale.y = 1; r.visible = true; });
    // ride height (shown larger than life so it reads); when driving the body also floats a little on the air springs
    let bob = 0, pitch = 0;
    if (opt.scene === 'drive') { const t = (now - t0) / 1000, sp = world.speed() / 22; bob = (Math.sin(t * 1.9) * .004 + Math.sin(t * 5.3) * .0015 * sp); pitch = Math.sin(t * 1.3 + 1) * .0025 + Math.sin(t * 4.1) * .001 * sp; }
    body.position.y = S.lift / 1000 * LS + bob; body.rotation.x = pitch;
    P.clip.constant = -(1.115 + body.position.y);
    { const n = new THREE.Vector3(0, -2.6, -1), l = n.length(); P.aclip.set(n.divideScalar(l), (3.92 + .06) / l); body.updateMatrixWorld(); P.aclip.applyMatrix4(body.matrixWorld);
      const fo = S.win.fl > .005 || S.win.fr > .005, want = fo ? 2 : 1; if (P.paneMatF.clippingPlanes.length !== want) { P.paneMatF.clippingPlanes = fo ? [P.clip, P.aclip] : [P.clip]; P.paneMatF.needsUpdate = true; } }   /* the A-pillar cut only while a front window is down, so closed glass is never trimmed */
    M.head.emissiveIntensity = S.head * 2.2 + S.beam * 1.6; M.tail.emissiveIntensity = S.tail * 2 + S.beam;
    { const hh = smooth(.62, 1, S.head) * .35 + S.beam * .6, blink = S.haz * Math.pow(Math.max(0, Math.sin(now / 1000 * Math.PI * 1.5)), .35);
      P.fx.head.forEach(h => h.material.opacity = hh * .9); P.fx.tail.forEach(h => h.material.opacity = smooth(.62, 1, S.tail) * .5 + S.beam * .6);
      P.fx.headPool.material.opacity = S.beam * .6; P.fx.tailPool.material.opacity = S.beam * .3;
      if (beams) { const nt = world.night ? world.night() : 0, on = Math.max(S.beam, hh); beams.poolM.opacity = S.beam * nt * .85; beams.coreM.opacity = 0; beams.glowM.opacity = on * nt * .45;
        beams.tailM.opacity = 0; beams.tailGM.opacity = Math.max(S.beam, smooth(.3, .6, S.tail)) * (.4 + .3 * nt); beams.redM.opacity = S.beam * nt * .4;
        const sp = world.sport ? world.sport() : 0; beams.trailM.opacity = 0; P.fx.head.forEach(h => { h.material.opacity = hh * .5; });  P.fx.headPool.material.opacity = 0; P.fx.tailPool.material.opacity = 0; }
      P.fx.haz.forEach(h => h.material.opacity = blink); P.fx.hazPool.forEach(h => h.material.opacity = blink * .45); }
    Object.entries(P.wglow).forEach(([k, m]) => { m.material.opacity = (S.warn[k] || 0) * (.6 + .3 * Math.sin(now / 260)); });
    Object.entries(tyreMats).forEach(([k, m]) => { m.emissive.set('#e0303f'); m.emissiveIntensity = (S.warn[k] || 0) * (.35 + .25 * Math.sin(now / 260)); });
  }
  function fxTint(dark) { P.fx.head.forEach(h => { h.material.color.set(dark ? '#fff7e2' : '#ffe6a6');  });
    P.fx.headPool.material.color.set(dark ? '#fff0c4' : '#ffd36a'); P.fx.tail.forEach(h => h.material.color.set(dark ? '#ff2f48' : '#ff1f3d')); }
  fxTint(false);
  /* Night driving headlights, the way they look from the roadside in real life: in clear air the beam itself is invisible.
     You see a small, very bright lamp with a tight glow round it, and the light where it lands: a bright patch on the road
     a few metres ahead that stretches out and fades, spilling a little onto the verges. Red tail lamps glow softly behind. */
  let beams = null;
  if (opt.scene === 'drive') {
    const tex = (w, h, f, rgb = [255, 255, 255]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const a = Math.max(0, Math.min(1, f(xx / (w - 1), yy / (h - 1)))), o = (yy * w + xx) * 4; im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; im.data[o + 3] = a * 255; }
      x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    // light on the road: u across, v along (v = 0 at the bumper). Rises fast, brightest 4–12 m out, fades by ~30 m; widens with distance; a sharp-ish cut-off edge to the left like a dipped beam
    const poolT = tex(128, 512, (u, vv) => { const d = vv * 30, along = smooth(0, 1.4, d) * Math.exp(-Math.pow(Math.max(0, d - 6) / 12, 1.6)) * (1 - smooth(24, 30, d));
      const half = 1.3 + d * .19, x = (u - .5) * 9, across = Math.exp(-Math.pow(x / half, 2) * 1.1); return along * across * .85; }, [255, 244, 222]);
    const poolM = new THREE.MeshBasicMaterial({ map: poolT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const roadPool = new THREE.Mesh(new THREE.PlaneGeometry(9, 30), poolM); roadPool.rotation.x = -Math.PI / 2; roadPool.position.set(-.3, .02, 2.55 + 15); roadPool.name = 'fx'; car.add(roadPool);
    // the lamp: a hot core and a small, tight glow
    // soft lamp: no hard dot, just a gentle bright centre that melts into a wide glow
    const coreT = softTex([[0, .9], [.2, .6], [.45, .22], [.75, .05], [1, 0]], 128);
    const coreM = new THREE.SpriteMaterial({ map: coreT, color: '#fbf6ec', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const glowM = new THREE.SpriteMaterial({ map: softTex([[0, .55], [.3, .22], [.65, .06], [1, 0]], 128), color: '#fff0d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    { const g = new THREE.Sprite(glowM); g.position.set(0, .8, 2.95); g.scale.set(3.6, 1.2, 1); g.name = 'fx'; body.add(g); }   // a soft wide glow round the light bar, at night only
    // tail lamps and a faint red wash on the road behind
    const tailM = new THREE.SpriteMaterial({ map: coreT, color: '#ff3a50', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const tailGM = new THREE.SpriteMaterial({ map: softTex([[0, .5], [.35, .18], [1, 0]], 128), color: '#ff3048', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    { tailGM.map = barTex(.05, .32, .5); const g = new THREE.Sprite(tailGM); g.position.set(0, 1.06, -2.8); g.scale.set(2.2, .18, 1); g.name = 'fx'; body.add(g); }   // a soft red glow along the tail lamp, so you can see it's on
    // Sport: a soft red light trail streaming back from the tail lamps, like a long-exposure photo
    const trailT = tex(512, 64, (u, vv) => Math.pow(1 - u, 1.4) * smooth(0, .06, u) * Math.exp(-Math.pow((vv - .5) * 4.2, 2)), [255, 70, 92]);
    const trailM = new THREE.MeshBasicMaterial({ map: trailT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    [1.03, .96].forEach((yy, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(9, .55 + i * .25), trailM); m.rotation.y = Math.PI / 2; m.position.set(.9, yy, -2.9 - 4.5); m.name = 'fx'; body.add(m); });
    const redM = new THREE.MeshBasicMaterial({ map: tex(64, 128, (u, vv) => Math.exp(-Math.pow((u - .5) * 3, 2)) * smooth(0, .15, vv) * Math.pow(1 - vv, 1.8) * .8, [255, 60, 80]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const redPool = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.5), redM); redPool.rotation.x = -Math.PI / 2; redPool.position.set(0, .02, -2.9 - 1.75); redPool.name = 'fx'; car.add(redPool);
    beams = { poolM, coreM, glowM, tailM, tailGM, redM, trailM }; }
  const proj = new THREE.Vector3();
  const v = {
    el, canvas: cv, P, scene, car,
    shot(pos, look, fov, w, h) {   // a still from a camera on the car (used to make the camera-feed images)
      apply(performance.now()); const c = new THREE.PerspectiveCamera(fov, w / h, .05, 900); c.position.set(...pos); c.lookAt(new THREE.Vector3(...look)); car.updateMatrixWorld(true); c.position.applyMatrix4(car.matrixWorld);
      const lk = new THREE.Vector3(...look).applyMatrix4(car.matrixWorld); c.lookAt(lk); const r = shared(); r.setPixelRatio(1); r.setSize(w, h, false); r.setScissorTest(false); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, c); return r.domElement.toDataURL('image/jpeg', .86); },
    tick(now) {
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h || !cv.isConnected) return false;
      if (w !== W || h !== H) { W = w; H = h; cam.aspect = w / h; if (V.shift) cam.setViewOffset(w, h, -V.shift[0] * w, V.shift[1] * h, w, h); cam.updateProjectionMatrix(); dirty = true; if (opt.onResize) setTimeout(() => opt.onResize(v), 0); }
      const dt = Math.min(.05, (now - last) / 1000); last = now; let moving = false;
      const walk = (a, b, rate) => { Object.keys(b).forEach(k => { if (typeof b[k] === 'object') { moving = walk(a[k], b[k], rate) || moving; } else { const n = step(a[k], b[k], dt, rate); if (n !== a[k]) { a[k] = n; moving = true; } } }); return moving; };
      const lin = (a, b, dur) => { const d = b - a; if (!d) return a; const st = dt / dur; return Math.abs(d) <= st ? b : a + Math.sign(d) * st; };
      Object.keys(T).forEach(k => { if (k in LIN) { if (typeof T[k] === 'object') Object.keys(T[k]).forEach(j => { const n = lin(S[k][j], T[k][j], LIN[k]); if (n !== S[k][j]) { S[k][j] = n; moving = true; } });
          else { const n = lin(S[k], T[k], LIN[k]); if (n !== S[k]) { S[k] = n; moving = true; } } }
        else if (typeof T[k] === 'object') walk(S[k], T[k], 4.2); else { const n = step(S[k], T[k], dt, 4.2); if (n !== S[k]) { S[k] = n; moving = true; } } });
      if (S.haz > 0 || S.chg > 0 || S.plug > 0) moving = true;
      if (Object.values(S.warn).some(x => x > 0)) moving = true;
      if (world && world.update(dt, now)) moving = true;
      if (opt.scene === 'drive') { wheelA = (wheelA + Math.min(dt, .05) * Math.min(world.speed() / .4, 5.2)) % (Math.PI * 2); Object.values(P.wheels).forEach(wh => wh.spin.rotation.x = wheelA); }   /* the true spin (up to 55 turns a second) strobes against the screen's frame rate and looks like jitter, so the spokes turn at a calm, readable pace */
      else if (spin) { wheelA += dt * 6; Object.values(P.wheels).forEach(wh => wh.spin.rotation.x = wheelA); moving = true; }
      if (opt.drift) { sph.theta = sph0.theta + Math.sin((now - t0) / 7000) * .22; moving = true; }
      if (drag || inertia) { if (!drag) { sph.theta += vel * dt; vel *= Math.pow(.04, dt); if (Math.abs(vel) < .02) inertia = false; } moving = true; }
      else if (back) { const k = Math.min(1, dt * 3); sph.theta += (sph0.theta - sph.theta) * k; sph.phi += (sph0.phi - sph.phi) * k;
        if (Math.abs(sph.theta - sph0.theta) + Math.abs(sph.phi - sph0.phi) < 1e-4) { sph.theta = sph0.theta; sph.phi = sph0.phi; back = false; } moving = true; }
      if (va) { const k = Math.min(1, (now - va.t0) / 1100), e = IO(k); tgt.lerpVectors(va.t1, va.t2, e); cam.up.lerpVectors(va.u1, va.u2, e).normalize();
        cam.fov = va.f1 + (va.f2 - va.f1) * e; cam.updateProjectionMatrix(); const pp = new THREE.Vector3().lerpVectors(va.p1, va.p2, e).sub(tgt); sph.setFromVector3(pp); sph0.copy(sph);
        if (k >= 1) { va = null; if (opt.onResize) setTimeout(() => opt.onResize(v), 0); } moving = true; }
      if (moving || dirty) { apply(now); cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); drawTo(ctx, scene, cam, w, h); dirty = false; }
      return moving;
    },
    set(st) {
      if (st.open) ['dfl', 'dfr', 'drl', 'drr', 'frunk', 'boot'].forEach(k => { const o = st.open[k] ? 1 : 0; if (k.startsWith('d')) T.door[k] = o; else T[k] = o; });
      if ('port' in st) T.port = st.port ? 1 : 0;
      if ('charge' in st) T.chg = st.charge ? 1 : 0;
      if ('plug' in st) T.plug = st.plug ? 1 : 0;
      if ('lvl' in st) T.lvl = st.lvl;
      if (st.wins) Object.assign(T.win, st.wins);
      if ('mir' in st) T.mir = st.mir === 'fold' ? 1 : 0;
      if (st.shade) { T.shade.l = st.shade.l ? 1 : 0; T.shade.r = st.shade.r ? 1 : 0; }
      if ('lights' in st) { T.head = st.lights === 'on' ? 1 : st.lights === 'off' ? .08 : .55; T.tail = st.lights === 'off' ? .15 : st.lights === 'on' ? 1 : .5; T.beam = st.lights === 'on' ? 1 : 0; }
      if ('hazard' in st) T.haz = st.hazard ? 1 : 0;
      if ('lift' in st) T.lift = st.lift;
      if ('spin' in st) spin = !!st.spin;
      if ('warn' in st) { ['fl', 'fr', 'rl', 'rr'].forEach(k => T.warn[k] = st.warn === k ? 1 : 0); }
      if ('mode' in st && world && world.mode) world.mode(st.mode);
      if ('dark' in st && world && world.theme) world.theme(st.dark);
      if ('dark' in st) fxTint(st.dark);
      if ('view' in st && st.view !== vname && VIEWS[st.view]) { const N = VIEWS[st.view]; vname = st.view;
        va = { t0: performance.now(), p1: cam.position.clone(), p2: new THREE.Vector3(...N.p), t1: tgt.clone(), t2: new THREE.Vector3(...N.t), u1: cam.up.clone(), u2: new THREE.Vector3(...(N.up || [0, 1, 0])), f1: cam.fov, f2: N.fov }; }
      dirty = true; kick();
    },
    snap() { Object.assign(S, JSON.parse(JSON.stringify(T))); dirty = true; kick(); },
    render() { dirty = true; kick(); },
    reset() { back = true; inertia = false; kick(); },
    // where things are on screen (px inside the host): wheel centres and the car's outer edges
    layout() {
      cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); cam.updateMatrixWorld(); const out = {};
      const to2d = p => { proj.copy(p).project(cam); return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * H }; };
      Object.entries(P.wheels).forEach(([k, w]) => { out[k] = to2d(w.hub.getWorldPosition(new THREE.Vector3())); });
      out.left = to2d(new THREE.Vector3(1.02, 0, 0)).x; out.right = to2d(new THREE.Vector3(-1.02, 0, 0)).x;
      out.doors = { dfl: to2d(new THREE.Vector3(1.02, .9, 1.16)), dfr: to2d(new THREE.Vector3(-1.02, .9, 1.16)), drl: to2d(new THREE.Vector3(1.02, .9, -.06)), drr: to2d(new THREE.Vector3(-1.02, .9, -.06)) };   // just ahead of each hinge, clear of the opened door
      return out;
    },
  };
  // drag: 'spring' turns a little and springs back; 'free' spins all the way round and stays (double-tap resets)
  let drag = false, back = false, inertia = false, vel = 0, sx = 0, sy = 0, moved = 0, lt = 0;
  if (opt.orbit) {
    const free = opt.orbit === 'free';
    cv.addEventListener('pointerdown', e => { drag = true; back = false; inertia = false; vel = 0; sx = e.clientX; sy = e.clientY; moved = 0; lt = performance.now(); cv.setPointerCapture(e.pointerId); kick(); });
    cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - sx, dy = e.clientY - sy, n = performance.now(); sx = e.clientX; sy = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      sph.theta -= dx * .008; vel = -dx * .008 / Math.max(.008, (n - lt) / 1000); lt = n;
      sph.phi = free ? Math.min(1.5, Math.max(1.05, sph.phi - dy * .004)) : Math.min(1.45, Math.max(.15, sph.phi - dy * .006)); kick(); });
    const end = e => { if (!drag) return; drag = false;
      if (moved < 8) { vel = 0; if (opt.onPick) pick(e); } else if (free && performance.now() - lt < 80) { inertia = true; vel = Math.max(-6, Math.min(6, vel)); }
      if (!free) setTimeout(() => { back = true; kick(); }, 2200); kick(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', () => { drag = false; if (!free) back = true; kick(); });
    if (free) cv.addEventListener('dblclick', () => { inertia = false; sph.theta = sph0.theta + Math.round((sph.theta - sph0.theta) / (Math.PI * 2)) * Math.PI * 2; back = true; kick(); });
  } else if (opt.onPick) cv.addEventListener('click', pick);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const b = cv.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
    ray.setFromCamera(ndc, cam); const hit = ray.intersectObject(car, true).find(h => h.object.visible); if (!hit) return;
    let o = hit.object; while (o && o !== car) { const n = o.name || ''; if (/^d[fr][lr]$|^frunk$|^boot$|^port$/.test(n)) return opt.onPick(n); if (/^mir-/.test(n)) return opt.onPick('mir'); if (/^hub-/.test(n)) return opt.onPick('wheel-' + n.slice(4)); o = o.parent; }
    // otherwise go by where on the car the tap landed (from above you mostly see roof and glass)
    const p = car.worldToLocal(hit.point.clone()); p.y -= body.position.y;
    if (p.x > .8 && p.z < -1.85 && p.z > -2.35 && p.y > .8 && p.y < 1.2) return opt.onPick('port');
    if (opt.view === 'ty') { const k = (p.z > 0 ? 'f' : 'r') + (p.x > 0 ? 'l' : 'r'); return opt.onPick('wheel-' + k); }
    if (p.z > 1.3) return opt.onPick('frunk');
    if (p.z < -1.8) return opt.onPick('boot');
    const s = p.x > 0 ? 'l' : 'r';
    if (p.z > -.165 && p.z < 1.3) return opt.onPick('df' + s);
    return opt.onPick('dr' + s);
  }
  viewers.add(v); v.render();
  if ((opt.view === 'lock' || opt.view === 'home') && ++primeN >= 2) primeDone();
  window.__et9t.push(['mount:' + opt.view + ':done', Math.round(performance.now() - tM)]);
  /* redraw whenever the view's box appears or changes size (a page opening, a pane sliding in): without this a view that was
     built while hidden kept a stale picture until something was tapped */
  if (window.ResizeObserver) new ResizeObserver(() => { dirty = true; kick(); }).observe(el);
  if (window.IntersectionObserver) new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { dirty = true; kick(); } }).observe(el);
  await turn();
  try { apply(performance.now()); cam.position.setFromSpherical(sph).add(tgt); cam.lookAt(tgt); cam.aspect = 1.6; cam.updateProjectionMatrix(); R.compile(scene, cam); } catch (e) {}   // build the shaders now, not on first view
  return v;
}

/* a still top-down picture of the car (map marker); px = pixels per metre. mask: white silhouette only (for the 2D drawings) */
export async function snapshot(px = 40, o = {}) {
  const { car, P } = await buildCar(); car.traverse(c => { if (c.name === 'shadow' || c.name === 'wglow') c.visible = false; });
  if (o.mask) { const white = new THREE.MeshBasicMaterial({ color: '#ffffff' }); car.traverse(c => { if (c.isMesh) c.material = white; });
    P.port.visible = false; P.portGlow.visible = false; P.portHalo.visible = false; Object.values(P.shades).forEach(s => s.visible = false); if (o.mirrors === false) Object.values(P.mirrors).forEach(m => m.visible = false); }
  const w = 2.3 * px / PR, h = 5.5 * px / PR, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const scene = new THREE.Scene(); shared(); scene.environment = ENV; scene.add(car);
  const l = new THREE.DirectionalLight('#ffffff', 1); l.position.set(2, 8, 3); scene.add(l);
  const cam = new THREE.OrthographicCamera(-1.15, 1.15, 2.75, -2.75, .1, 30); cam.up.set(0, 0, 1); cam.position.set(0, 12, -.1); cam.lookAt(0, 0, -.1);
  const tm = R.toneMapping; if (o.mask) R.toneMapping = THREE.NoToneMapping;
  drawTo(ctx, scene, cam, w, h); R.toneMapping = tm;
  return cv.toDataURL('image/png');
}

const paintHooks = new Set();
export function onPaint(f) { paintHooks.add(f); }
export function setPaint(k) {
  if (!PAINTS[k]) return; paintKey = k; try { localStorage.setItem('nio-paint', k); } catch (e) {}
  applyPaint(); viewers.forEach(v => v.render()); paintHooks.forEach(f => f(k));
}
export const paint = () => paintKey;
export const preload = () => loadRaw();

loadRaw();   // start the download straight away
window.ET9 = { mount, setPaint, paint, PAINTS, preload, snapshot, onPaint, ready };
window.dispatchEvent(new Event('et9-ready'));
