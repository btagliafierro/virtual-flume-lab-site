/* Run-time estimator. Only runs on pages containing <form id="vwl-est">. */
(function () {
  function init() {
    const form = document.getElementById("vwl-est");
    if (!form || form.dataset.ready) return;
    form.dataset.ready = "1";
    const $ = id => document.getElementById(id);
    let dim = 3, dur = "s", nGPU = 1, last = null;
    const row = $("gpuRow");
    for (let i = 1; i <= 10; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = i; b.dataset.n = i;
      b.setAttribute("aria-label", i + (i === 1 ? " GPU" : " GPUs"));
      row.appendChild(b);
    }
    row.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { nGPU = +b.dataset.n; calc(); } });
    function seg(id, attr, set) {
      $(id).addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
        set(b.dataset[attr]); calc();
      });
    }
    seg("segDim", "dim", v => { dim = +v; });
    seg("segDur", "dur", v => { dur = v; });
    form.addEventListener("input", calc);
    form.addEventListener("submit", e => e.preventDefault());

    const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : NaN; };
    const sig = (x, n = 3) => Number(x.toPrecision(n)).toLocaleString("en-GB");
    const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    function sci(x) {
      if (x < 1e4) return sig(x);
      let e = Math.floor(Math.log10(x)), m = Number((x / Math.pow(10, e)).toPrecision(3));
      if (m >= 10) { m /= 10; e += 1; }
      return m.toFixed(2) + " × 10" + String(e).split("").map(c => SUP[c]).join("");
    }
    function dur2txt(s) {
      if (!isFinite(s)) return "–";
      if (s < 60) return Math.max(1, Math.round(s)) + " s";
      if (s < 3600) return Math.round(s / 60) + " min";
      if (s < 48 * 3600) { const h = Math.floor(s / 3600), m = Math.round((s - h * 3600) / 60); return h + " h " + Math.min(m, 59) + " min"; }
      const d = Math.floor(s / 86400), h = Math.round((s - d * 86400) / 3600); return d + " d " + h + " h";
    }
    const tsmall = s => s < 1e-3 ? sig(s * 1e6) + " µs" : s < 1 ? sig(s * 1e3) + " ms" : sig(s) + " s";
    const ids = ["o-wall", "o-gpuh", "o-N", "o-Npg", "o-h", "o-c", "o-dt", "o-ts", "o-ns", "o-tstep", "o-mem"];

    function calc() {
      row.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.n <= nGPU)));
      $("gpuCount").textContent = nGPU;
      $("e-W").disabled = dim === 2;
      $("durS").hidden = dur !== "s"; $("durP").hidden = dur !== "p";
      const L = num("e-L"), W = num("e-W"), D = num("e-D"), dp = num("e-dp");
      const tsim = dur === "s" ? num("e-ts") : num("e-np") * num("e-T");
      const perf = num("e-perf") * 1e-9, eff = Math.min(100, num("e-eff")) / 100;
      const cs = num("e-cs"), ch = num("e-ch"), cfl = num("e-cfl"), bnd = num("e-bnd") / 100, cap = num("e-cap") * 1e6;
      const note = $("o-note");
      const vals = [L, D, dp, tsim, perf, eff, cs, ch, cfl, cap].concat(dim === 3 ? [W] : []);
      if (vals.some(v => !(v > 0)) || !(bnd >= 0)) {
        ids.forEach(id => { $(id).textContent = "–"; });
        note.className = "note warn"; note.textContent = "Enter positive values in every field to compute the estimate.";
        last = null; return;
      }
      const N = (dim === 3 ? L * W * D / Math.pow(dp, 3) : L * D / Math.pow(dp, 2)) * (1 + bnd);
      const c0 = cs * Math.sqrt(9.81 * D), hs = ch * Math.sqrt(dim) * dp, dt = cfl * hs / c0;
      const steps = tsim / dt;
      const tstep = N * perf / (nGPU === 1 ? 1 : nGPU * eff);
      const wall = steps * tstep, gpuh = wall * nGPU / 3600;
      const gl = nGPU === 1 ? " GPU" : " GPUs";
      $("o-wall").textContent = dur2txt(wall);
      $("o-gpuh").textContent = sig(gpuh) + " GPU-hours on " + nGPU + gl;
      $("o-N").textContent = sci(N);
      $("o-Npg").textContent = sci(N / nGPU);
      $("o-h").textContent = sig(hs * 1000) + " mm";
      $("o-c").textContent = sig(c0) + " m/s";
      $("o-dt").textContent = tsmall(dt);
      $("o-ts").textContent = sig(tsim) + " s";
      $("o-ns").textContent = sci(steps);
      $("o-tstep").textContent = tsmall(tstep);
      const load = N / (cap * nGPU), bar = $("o-membar");
      bar.classList.toggle("over", load > 1);
      bar.firstElementChild.style.width = Math.min(100, load * 100).toFixed(1) + "%";
      $("o-mem").textContent = (load * 100).toFixed(load < 0.1 ? 1 : 0) + "% of the particle capacity of " + nGPU + gl;
      let msg = "", warn = false;
      if (load > 1) { msg = "The model exceeds the particle capacity of the selected GPUs. Add GPUs or increase dp."; warn = true; }
      else if (N > 1.05e9) { msg = "The model exceeds the 10⁹-particle range of the facility."; warn = true; }
      else if (dim === 2 && nGPU > 1) { msg = "2D models normally run on one GPU each. Several GPUs are better used for parallel sea states."; }
      else if (wall > 14 * 86400) { msg = "The run exceeds two weeks of wall-clock time. Consider a coarser dp, a shorter duration or more GPUs."; warn = true; }
      note.className = "note" + (warn ? " warn" : ""); note.textContent = msg;
      last = "About " + sci(N) + " particles at dp " + dp + " m, " + sig(tsim) + " s simulated, about " + dur2txt(wall) + " on " + nGPU + gl + " (" + sig(gpuh) + " GPU-hours)";
    }
    $("o-copy").addEventListener("click", async () => {
      if (!last) return;
      const b = $("o-copy");
      try { await navigator.clipboard.writeText(last); b.textContent = "Estimate copied"; }
      catch (e) { b.textContent = "Copy failed. Select the values manually."; }
      setTimeout(() => { b.textContent = "Copy estimate for my request"; }, 2500);
    });
    calc();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
