/* Numerical flume preview: linear (Airy) wave kinematics on a particle lattice.
   Only runs on pages that contain <canvas id="vwl-tank">. */
(function () {
  function init() {
    const cv = document.getElementById("vwl-tank");
    if (!cv || cv.dataset.ready) return;
    cv.dataset.ready = "1";
    const ctx = cv.getContext("2d");
    const W = cv.width, Hc = cv.height;
    const g = 9.81, depth = 0.60, Ltank = 12.0;
    const x0 = 70, x1 = W - 20, sx = (x1 - x0) / Ltank;
    const yBed = Hc - 46, sz = 300, ySWL = yBed - depth * sz;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const $ = id => document.getElementById(id);
    const inH = $("vwl-H"), inT = $("vwl-T");
    const gauges = [{ x: 2.5, n: "WG1" }, { x: 5.0, n: "WG2" }, { x: 8.6, n: "WG3" }];
    const struct = { x: 7.0, w: 0.45, h: 0.30 }, beachStart = 10.0;
    let H = +inH.value, T = +inT.value, k = 1, omega = 1;

    function solveK() {
      omega = 2 * Math.PI / T;
      let kk = omega * omega / g;
      for (let i = 0; i < 60; i++) kk = omega * omega / (g * Math.tanh(kk * depth));
      k = kk;
      $("vwl-outH").textContent = H.toFixed(2) + " m";
      $("vwl-outT").textContent = T.toFixed(1) + " s";
      const L = 2 * Math.PI / k;
      $("vwl-outL").textContent = "L = " + L.toFixed(2) + " m, kh = " + (k * depth).toFixed(2) + ", H/L = " + (H / L).toFixed(3);
    }
    inH.addEventListener("input", () => { H = +inH.value; solveK(); if (reduce) draw(0.3); });
    inT.addEventListener("input", () => { T = +inT.value; solveK(); if (reduce) draw(0.3); });
    solveK();

    const dp = 0.075, parts = [];
    for (let x = dp / 2; x < Ltank; x += dp)
      for (let z = -depth + dp / 2; z < 0; z += dp) {
        if (x > struct.x && x < struct.x + struct.w && z < -depth + struct.h) continue;
        parts.push([x, z]);
      }
    const env = x => { if (x < beachStart) return 1; const r = (x - beachStart) / (Ltank - beachStart); return Math.max(0, 1 - r * r * (3 - 2 * r)); };
    let C = {};
    function readColors() {
      const cs = getComputedStyle(document.body);
      const v = n => cs.getPropertyValue(n).trim();
      C = { ink: v("--vwl-ink"), muted: v("--vwl-muted"), line: v("--vwl-line"), water: v("--vwl-water"), deep: v("--vwl-water-deep"), accent: v("--vwl-accent") };
    }
    readColors();
    new MutationObserver(() => { readColors(); if (reduce) draw(0.3); }).observe(document.body, { attributes: true, attributeFilter: ["data-md-color-scheme"] });

    const eta = (x, t) => env(x) * H / 2 * Math.cos(k * x - omega * t);
    const X = x => x0 + x * sx, Z = z => ySWL - z * sz;
    const mono = "12px 'IBM Plex Mono', monospace";

    function draw(t) {
      ctx.clearRect(0, 0, W, Hc);
      ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 - 8, ySWL - 110); ctx.lineTo(x0 - 8, yBed + 2); ctx.lineTo(x1, yBed + 2); ctx.lineTo(x1, ySWL - 110); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.font = mono; ctx.textAlign = "center";
      for (let m = 0; m <= Ltank; m++) { const px = X(m); ctx.fillRect(px - .5, yBed + 4, 1, m % 2 ? 5 : 9); if (!(m % 2)) ctx.fillText(m + " m", px, yBed + 28); }
      ctx.setLineDash([4, 5]); ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, ySWL); ctx.lineTo(x1, ySWL); ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = "left"; ctx.fillText("SWL", x1 - 34, ySWL - 6);
      const stroke = H / 2 / Math.tanh(k * depth) * .9;
      const px = X(0) - 6 + Math.sin(-omega * t) * stroke * sx * .6;
      ctx.fillStyle = C.accent; ctx.fillRect(px - 6, ySWL - 70, 8, yBed - ySWL + 70);
      ctx.fillStyle = C.muted; ctx.fillRect(px - 46, ySWL - 40, 40, 4);
      ctx.fillStyle = C.line; ctx.beginPath(); ctx.moveTo(X(beachStart), yBed + 2); ctx.lineTo(x1, yBed + 2); ctx.lineTo(x1, ySWL + 10); ctx.closePath(); ctx.fill();
      const shk = Math.sinh(k * depth), a = H / 2;
      for (const [x, z] of parts) {
        const e = env(x), ph = k * x - omega * t;
        const ch = Math.cosh(k * (z + depth)) / shk, sh = Math.sinh(k * (z + depth)) / shk;
        const xp = x - e * a * ch * Math.sin(ph), zp = z + e * a * sh * Math.cos(ph);
        if (x > beachStart && zp < -depth + .15 * (x - beachStart)) continue;
        const s = Math.min(1, e * a * omega * Math.hypot(ch * Math.cos(ph), sh * Math.sin(ph)) / .35);
        ctx.fillStyle = s > .62 ? C.accent : (s > .3 ? C.water : C.deep);
        ctx.fillRect(X(xp) - 2, Z(zp) - 2, 4, 4);
      }
      ctx.fillStyle = C.ink; ctx.fillRect(X(struct.x), Z(-depth + struct.h), struct.w * sx, struct.h * sz);
      for (const gg of gauges) {
        const e = eta(gg.x, t), gx = X(gg.x);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(gx, ySWL - 95); ctx.lineTo(gx, ySWL + 40); ctx.stroke();
        ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(gx, Z(e), 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.fillText(gg.n, gx, ySWL - 118);
        ctx.fillStyle = C.muted; ctx.fillText((e >= 0 ? "+" : "−") + Math.abs(e * 100).toFixed(1) + " cm", gx, ySWL - 102);
      }
      const e2 = eta(gauges[1].x, t);
      $("vwl-outEta").textContent = (e2 >= 0 ? "+" : "−") + Math.abs(e2).toFixed(3) + " m";
    }
    if (reduce) { draw(0.3); return; }
    let t0 = null, visible = true;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
    (function loop(ts) { if (t0 === null) t0 = ts; if (visible) draw((ts - t0) / 1000); requestAnimationFrame(loop); })(performance.now());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
